package post

import (
	"fmt"
	"net/http"
	"strconv"
	"time"
	"tourist-blog/internal/domain/models"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PlaceCreationData - DTO для данных Места
type PlaceCreationData struct {
	Name      string  `json:"name" binding:"required"`
	Desc      string  `json:"desc"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// PostCreationRequest - DTO для всего запроса на создание Поста
type PostCreationRequest struct {
	Title      string             `json:"title" binding:"required"`
	PlaceData  PlaceCreationData  `json:"place_data" binding:"required"`
	Tags       []string           `json:"tags"`
	Paragraphs []models.Paragraph `json:"paragraphs"`
	Photos     []models.PostPhoto `json:"photos"`
}

// PostResponse - DTO для ответа (ID теперь uint)
type PostResponse struct {
	ID          uint               `json:"id"`
	UserID      uint               `json:"user_id"`
	Title       string             `json:"title"`
	Date        time.Time          `json:"created_at"`
	PlaceName   string             `json:"place_name"`
	Tags        []string           `json:"tags"`
	PreviewText string             `json:"preview_text"`
	Photos      []models.PostPhoto `json:"photos"`
	LikesCount  int                `json:"likes_count"`
}

// DetailPostResponse - DTO для детального ответа (ID теперь uint)
type DetailPostResponse struct {
	ID          uint               `json:"id"`
	UserID      uint               `json:"user_id"`
	Title       string             `json:"title"`
	Date        time.Time          `json:"created_at"`
	PlaceName   string             `json:"place_name"`
	Tags        []string           `json:"tags"`
	PreviewText string             `json:"preview_text"`
	Paragraphs  []models.Paragraph `json:"paragraphs"`
	Photos      []models.PostPhoto `json:"photos"`
	LikesCount  int                `json:"likes_count"`
}

type PostUpdateRequest struct {
	Title      string             `json:"title"`
	PlaceData  PlaceCreationData  `json:"place_data"`
	Tags       []string           `json:"tags"`
	Paragraphs []models.Paragraph `json:"paragraphs"`
	Photos     []models.PostPhoto `json:"photos"`
}

type ReportRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// Вспомогательная функция для безопасного извлечения userID
// В post.go
// Helper для безопасного извлечения userID из контекста
// В post.go
// Helper для безопасного извлечения userID из контекста
func getUserIDFromContext(c *gin.Context) (uint, bool) {
	val, exists := c.Get("userID")
	if !exists {
		return 0, false // Ключ "userID" не найден
	}

	var userID uint
	// Проверяем все возможные типы, которые Gin или middleware могли сохранить (особенно int64 из JWT)
	switch v := val.(type) {
	case uint:
		userID = v
	case int:
		if v > 0 {
			userID = uint(v)
		}
	case int64: // Тип, наиболее часто используемый для claims в Go JWT
		if v > 0 {
			userID = uint(v)
		}
	case float64:
		if v > 0 {
			userID = uint(v)
		}
	default:
		// ID найден, но имеет неверный тип
		return 0, false
	}

	if userID == 0 {
		return 0, false
	}

	return userID, true // Успешно извлекли валидный ID
}

// =========================================================================
// CREATE POST
// =========================================================================

func CreatePost(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: User ID not found in context."})
		return
	}

	var input PostCreationRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid request data: %v", err.Error())})
		return
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {

		// A. Создание места (Place)
		newPlace := models.Place{
			Name:      input.PlaceData.Name,
			Desc:      input.PlaceData.Desc,
			Latitude:  input.PlaceData.Latitude,
			Longitude: input.PlaceData.Longitude,
		}
		if result := tx.Create(&newPlace); result.Error != nil {
			return result.Error
		}

		// B. Создание поста (Post)
		newPost := models.Post{
			UserID:     int(userID),
			PlaceID:    newPlace.ID,
			Title:      input.Title,
			IsApproved: false,
		}
		if result := tx.Create(&newPost); result.Error != nil {
			return result.Error
		}

		// C. Создание параграфов (Paragraphs)
		if len(input.Paragraphs) > 0 {
			for i := range input.Paragraphs {
				input.Paragraphs[i].PostID = newPost.ID
				input.Paragraphs[i].ID = 0
			}
			if result := tx.Create(&input.Paragraphs); result.Error != nil {
				return result.Error
			}
		}

		// D. Создание фотографий (PostPhotos)
		if len(input.Photos) > 0 {
			for i := range input.Photos {
				input.Photos[i].PostID = newPost.ID
				input.Photos[i].ID = 0
				input.Photos[i].IsApproved = true
			}
			if result := tx.Create(&input.Photos); result.Error != nil {
				return result.Error
			}
		}

		// E. Обработка тегов (Tags)
		if len(input.Tags) > 0 {
			var placeTagsToCreate []models.PlaceTags

			for _, tagName := range input.Tags {
				if tagName == "" {
					continue
				}

				var tag models.Tags
				if err := tx.Where("name = ?", tagName).FirstOrCreate(&tag, models.Tags{Name: tagName}).Error; err != nil {
					return err
				}

				placeTagsToCreate = append(placeTagsToCreate, models.PlaceTags{
					PlaceID: newPlace.ID,
					TagID:   tag.ID,
				})
			}

			if len(placeTagsToCreate) > 0 {
				if result := tx.Create(&placeTagsToCreate); result.Error != nil {
					return result.Error
				}
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post transactionally", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Post created successfully"})
}

// =========================================================================
// GET USER POSTS (Личный кабинет: только посты текущего пользователя)
// =========================================================================

func GetUserPosts(c *gin.Context) {
	// 1. Извлекаем ID пользователя
	userID, exists := getUserIDFromContext(c)

	// 🛑 КРИТИЧЕСКИ ВАЖНАЯ ПРОВЕРКА и ЛОГИРОВАНИЕ
	if !exists || userID == 0 {
		fmt.Println("GetUserPosts DEBUG: UserID not found (exists:", exists, ", ID:", userID, "). Returning 401.")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: User ID not found or invalid in context"})
		return
	}

	// 💡 КРИТИЧЕСКИЙ ЛОГ: ДОЛЖЕН БЫТЬ ВИДЕН В КОНСОЛИ
	fmt.Printf("GetUserPosts DEBUG: Fetching posts for **UserID: %d**\n", userID)

	var posts []models.Post
	// 2. Фильтруем посты СТРОГО по ID текущего пользователя
	// GORM: Where("поле_в_БД = ?", значение)
	result := database.DB.
		Where("user_id = ?", userID). // userID теперь гарантированно > 0 и типа uint
		Preload("Photos").
		Preload("Paragraphs").
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	response := make([]PostResponse, 0)
	for _, p := range posts {
		previewText := ""
		if len(p.Paragraphs) > 0 {
			previewText = p.Paragraphs[0].Content
		}

		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", p.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		respItem := PostResponse{
			ID:          p.ID,
			UserID:      uint(p.UserID),
			Title:       p.Title,
			Date:        p.CreatedAt,
			PlaceName:   p.Place.Name,
			Tags:        tags,
			PreviewText: previewText,
			Photos:      p.Photos,
			LikesCount:  0,
		}
		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

// =========================================================================
// GET SINGLE POST
// =========================================================================

func GetPost(c *gin.Context) {
	postIDStr := c.Param("postID")

	postID, err := strconv.ParseUint(postIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID format"})
		return
	}

	var post models.Post

	result := database.DB.Where("id = ?", postID).
		Preload("Place").
		Preload("Paragraphs", func(db *gorm.DB) *gorm.DB {
			return db.Order("paragraphs.order ASC")
		}).
		Preload("Photos", func(db *gorm.DB) *gorm.DB {
			return db.Order("\"order\" ASC")
		}).
		First(&post)

	if result.Error != nil {
		fmt.Println("Error fetching post:", result.Error)

		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "details": result.Error.Error()})
		}
		return
	}

	var tags []string
	database.DB.Table("tags").
		Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
		Where("place_tags.place_id = ?", post.PlaceID).
		Pluck("tags.name", &tags)

	response := DetailPostResponse{
		ID:          post.ID,
		UserID:      uint(post.UserID),
		Title:       post.Title,
		Date:        post.CreatedAt,
		PlaceName:   post.Place.Name,
		Tags:        tags,
		PreviewText: "",
		Paragraphs:  post.Paragraphs,
		Photos:      post.Photos,
		LikesCount:  12,
	}

	c.JSON(http.StatusOK, response)
}

// =========================================================================
// GET PUBLIC FEED (Публичная лента: все одобренные посты, кроме постов текущего пользователя)
// =========================================================================

func GetPublicFeed(c *gin.Context) {
	var posts []models.Post
	// ✅ ИСПРАВЛЕНО: Начальный запрос: ВСЕ посты (для целей отладки)
	db := database.DB.Model(&models.Post{}) // <--- Заменить на этот

	// 2. Логика исключения постов текущего пользователя остается
	userID, exists := getUserIDFromContext(c)
	if exists && userID != 0 {
		db = db.Where("user_id != ?", userID)
	}

	// 1. Обработка общего поиска
	searchQuery := c.Query("search")
	if searchQuery != "" {
		searchTerm := "%" + searchQuery + "%"
		db = db.Joins("JOIN places ON places.id = posts.place_id").
			Where(
				database.DB.Where("posts.title ILIKE ?", searchTerm).
					Or("places.name ILIKE ?", searchTerm),
			)
	}

	// 2. Обработка поиска по тегам
	tagsQuery := c.Query("tags")
	if tagsQuery != "" {
		tagSearchTerm := "%" + tagsQuery + "%"

		var placeIDsWithTags []uint
		database.DB.Table("place_tags").
			Select("place_id").
			Joins("JOIN tags ON tags.id = place_tags.tag_id").
			Where("tags.name ILIKE ?", tagSearchTerm).
			Group("place_id").
			Pluck("place_id", &placeIDsWithTags)

		if len(placeIDsWithTags) > 0 {
			db = db.Where("posts.place_id IN (?)", placeIDsWithTags)
		} else {
			db = db.Where("1 = 0")
		}
	}

	// Основной запрос
	result := db.
		Preload("Place").
		Preload("Paragraphs", func(db *gorm.DB) *gorm.DB {
			return db.Order("paragraphs.order ASC")
		}).
		Preload("Photos").
		Order("created_at desc").
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch public feed", "details": result.Error.Error()})
		return
	}

	var response []PostResponse
	for _, p := range posts {
		previewText := ""
		if len(p.Paragraphs) > 0 {
			previewText = p.Paragraphs[0].Content
		}

		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", p.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		respItem := PostResponse{
			ID:          p.ID,
			UserID:      uint(p.UserID),
			Title:       p.Title,
			Date:        p.CreatedAt,
			PlaceName:   p.Place.Name,
			Tags:        tags,
			PreviewText: previewText,
			Photos:      p.Photos,
			LikesCount:  0,
		}
		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

// =========================================================================
// UPDATE POST
// =========================================================================

func UpdatePost(c *gin.Context) {
	postIDStr := c.Param("postID")

	postID, err := strconv.ParseUint(postIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID format"})
		return
	}

	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input PostUpdateRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var post models.Post
		// 1. Проверяем, существует ли пост и принадлежит ли автору
		if err := tx.First(&post, "id = ? AND user_id = ?", postID, userID).Error; err != nil {
			return err
		}

		// 2. Обновляем заголовок
		post.Title = input.Title
		if err := tx.Save(&post).Error; err != nil {
			return err
		}

		// 3. Обновляем Место (Place)
		var place models.Place
		if err := tx.First(&place, "id = ?", post.PlaceID).Error; err == nil {
			place.Name = input.PlaceData.Name
			if saveResult := tx.Save(&place); saveResult.Error != nil {
				return saveResult.Error
			}
		} else if err != gorm.ErrRecordNotFound {
			return err
		}

		// 4. Полная перезапись Параграфов
		tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{})
		if len(input.Paragraphs) > 0 {
			for i := range input.Paragraphs {
				input.Paragraphs[i].PostID = post.ID
				input.Paragraphs[i].ID = 0
			}
			if err := tx.Create(&input.Paragraphs).Error; err != nil {
				return err
			}
		}

		// 5. Полная перезапись Фото
		tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{})
		if len(input.Photos) > 0 {
			for i := range input.Photos {
				input.Photos[i].PostID = post.ID
				input.Photos[i].ID = 0
				input.Photos[i].IsApproved = true
			}
			if err := tx.Create(&input.Photos).Error; err != nil {
				return err
			}
		}

		// 6. Обновление тегов
		tx.Where("place_id = ?", post.PlaceID).Delete(&models.PlaceTags{})
		if len(input.Tags) > 0 {
			for _, tagName := range input.Tags {
				if tagName == "" {
					continue
				}
				var tag models.Tags
				if err := tx.Where("name = ?", tagName).FirstOrCreate(&tag, models.Tags{Name: tagName}).Error; err != nil {
					return err
				}
				if err := tx.Create(&models.PlaceTags{PlaceID: post.PlaceID, TagID: tag.ID}).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post updated successfully"})
}

// =========================================================================
// DELETE POST
// =========================================================================

func DeletePost(c *gin.Context) {
	postIDStr := c.Param("postID")
	postID, err := strconv.ParseUint(postIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID format"})
		return
	}

	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var post models.Post

		// 1. Проверяем существование поста и права пользователя
		if err := tx.Where("id = ? AND user_id = ?", postID, userID).First(&post).Error; err != nil {
			return err
		}

		// 2. Удаляем связанные сущности
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{}).Error; err != nil {
			return err
		}

		if err := tx.Where("place_id = ?", post.PlaceID).Delete(&models.PlaceTags{}).Error; err != nil {
			return err
		}

		// 3. Удаляем сам Пост
		if err := tx.Delete(&post).Error; err != nil {
			return err
		}

		// 4. Удаляем Место
		if err := tx.Where("id = ?", post.PlaceID).Delete(&models.Place{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found or unauthorized"})
		} else {
			fmt.Printf("Delete Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed", "details": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post and associated data deleted successfully"})
}

// post.go (добавить в post package)

// ReportPost обрабатывает запрос на создание новой жалобы на пост
func ReportPost(c *gin.Context) {
	// 1. Проверка авторизации и получение UserID
	userID, exists := c.Get("userID")
	if !exists {
		// Middleware должен был это обработать, но для надежности
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	// Преобразование userID в uint, если нужно (зависит от вашей реализации AuthMiddleware)
	reporterID, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID type error"})
		return
	}

	// 2. Получение PostID из URL-параметра
	postIDStr := c.Param("postID")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID format"})
		return
	}

	// 3. Получение данных запроса (Reason)
	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 4. Создание новой жалобы
	newComplaint := models.Complaint{
		UserID: reporterID,
		PostID: uint(postID),
		Reason: req.Reason,
		Status: models.StatusNew,
	}

	// Генерируем новый UUID (если он не генерируется автоматически gorm'ом)
	newComplaint.ID = uuid.New()

	// 5. Сохранение в базе данных
	if err := database.DB.Create(&newComplaint).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create complaint"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Complaint successfully reported", "complaint_id": newComplaint.ID})
}
