package post

import (
	"fmt"
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"
	"time"

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
	ID         uint               `json:"id"`
	UserID     uint               `json:"user_id"`
	Title      string             `json:"title"`
	Date       time.Time          `json:"created_at"`
	PlaceName  string             `json:"place_name"`
	Tags       []string           `json:"tags"`
	Photos     []models.PostPhoto `json:"photos"`
	LikesCount int                `json:"likes_count"`
	UserAvatar string             `json:"user_avatar"` // Добавьте это поле
	UserName   string             `json:"user_name"`   // Добавьте это поле
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
func getUserIDFromContext(c *gin.Context) (uint, bool) {
	val, exists := c.Get("userID")
	if !exists {
		return 0, false
	}

	var userID uint
	switch v := val.(type) {
	case uint:
		userID = v
	case int:
		if v > 0 {
			userID = uint(v)
		}
	case int64:
		if v > 0 {
			userID = uint(v)
		}
	case float64:
		if v > 0 {
			userID = uint(v)
		}
	default:
		return 0, false
	}

	if userID == 0 {
		return 0, false
	}

	return userID, true
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

		// B. Создание поста (Post) - теперь IsApproved = true по умолчанию
		newPost := models.Post{
			UserID:     int(userID),
			PlaceID:    newPlace.ID,
			Title:      input.Title,
			IsApproved: true,
			CreatedAt:  time.Now(),
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

// В функции GetUserPosts добавьте предзагрузку User и обновите формирование ответа
func GetUserPosts(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)

	if !exists || userID == 0 {
		fmt.Println("GetUserPosts DEBUG: UserID not found (exists:", exists, ", ID:", userID, "). Returning 401.")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: User ID not found or invalid in context"})
		return
	}

	fmt.Printf("GetUserPosts DEBUG: Fetching posts for **UserID: %d**\n", userID)

	var posts []models.Post
	result := database.DB.
		Where("user_id = ?", userID).
		Preload("User"). // Добавьте предзагрузку пользователя
		Preload("Photos").
		Preload("Paragraphs").
		Preload("Place"). // Добавьте предзагрузку места
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	response := make([]PostResponse, 0)
	for _, p := range posts {

		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", p.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		// Получаем данные пользователя
		userAvatar := ""
		userName := "Неизвестный пользователь"
		if p.User.ID != 0 {
			userAvatar = p.User.ImageUrl
			userName = p.User.Username
		}

		respItem := PostResponse{
			ID:         p.ID,
			UserID:     uint(p.UserID),
			Title:      p.Title,
			Date:       p.CreatedAt,
			PlaceName:  p.Place.Name,
			Tags:       tags,
			Photos:     p.Photos,
			LikesCount: p.LikesCount,
			UserAvatar: userAvatar, // Добавляем аватар
			UserName:   userName,   // Добавляем имя пользователя
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
		Preload("User"). // ← ДОБАВЬТЕ ЭТУ СТРОКУ
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
		LikesCount:  post.LikesCount,
	}

	c.JSON(http.StatusOK, response)
}

// =========================================================================
// GET PUBLIC FEED (Публичная лента: все одобренные посты, кроме постов текущего пользователя)
// =========================================================================

// post.go - только обновленная функция GetPublicFeed
func GetPublicFeed(c *gin.Context) {
	var posts []models.Post

	// Базовый запрос для всех пользователей - показываем все одобренные посты
	db := database.DB.Model(&models.Post{}).Where("is_approved = ?", true)

	// Проверяем, авторизован ли пользователь через OptionalAuthMiddleware
	userID, exists := c.Get("userID")
	if exists && userID != nil {
		// Если авторизован, показываем все одобренные посты (можно добавить фильтры по блокировке)
		uid, ok := userID.(uint)
		if ok && uid != 0 {
			// Можно добавить логику исключения постов заблокированных пользователей
			// db = db.Where("user_id NOT IN (SELECT blocked_user_id FROM blocked_users WHERE blocker_id = ?)", uid)
		}
	}

	// Обработка общего поиска
	searchQuery := c.Query("search")
	if searchQuery != "" {
		searchTerm := "%" + searchQuery + "%"
		db = db.Joins("JOIN places ON places.id = posts.place_id").
			Where(
				database.DB.Where("posts.title ILIKE ?", searchTerm).
					Or("places.name ILIKE ?", searchTerm),
			)
	}

	// Обработка поиска по тегам
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

	result := db.
		Preload("User").
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
		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", p.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		// Получаем данные пользователя
		userAvatar := ""
		userName := "Неизвестный пользователь"

		// Проверяем, что пользователь загружен (ID не равен 0)
		if p.User.ID != 0 {
			userAvatar = p.User.ImageUrl
			userName = p.User.Username
		}

		respItem := PostResponse{
			ID:         p.ID,
			UserID:     uint(p.UserID),
			Title:      p.Title,
			Date:       p.CreatedAt,
			PlaceName:  p.Place.Name,
			Tags:       tags,
			Photos:     p.Photos,
			LikesCount: p.LikesCount,
			UserAvatar: userAvatar,
			UserName:   userName,
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

		// 6. Обновление теги
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
		// ✅ Используем прямую проверку с First
		result := tx.Where("id = ? AND user_id = ?", postID, userID).First(&post)
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				return fmt.Errorf("post not found or unauthorized")
			}
			return result.Error
		}

		fmt.Printf("DEBUG: Found post ID: %d, PlaceID: %d\n", post.ID, post.PlaceID)

		// 2. Удаляем все зависимости ПЕРЕД удалением поста

		// A. Удаляем лайки (добавим отладочный вывод)
		if err := tx.Debug().Where("post_id = ?", post.ID).Delete(&models.Like{}).Error; err != nil {
			fmt.Printf("DEBUG: Error deleting likes: %v\n", err)
			return err
		}

		// B. Удаляем комментарии
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Comment{}).Error; err != nil {
			return err
		}

		// C. Удаляем избранное
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Favourite{}).Error; err != nil {
			return err
		}

		// D. Удаляем жалобы на пост (ВАЖНО: перед удалением поста)
		// ✅ Используем сырой SQL если GORM не работает
		if err := tx.Exec("DELETE FROM complaints WHERE post_id = ?", post.ID).Error; err != nil {
			fmt.Printf("DEBUG: Error deleting complaints with SQL: %v\n", err)
			// Пробуем через GORM
			if err := tx.Where("post_id = ?", post.ID).Delete(&models.Complaint{}).Error; err != nil {
				fmt.Printf("DEBUG: Error deleting complaints with GORM: %v\n", err)
				return err
			}
		}

		// E. Удаляем параграфы
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{}).Error; err != nil {
			return err
		}

		// F. Удаляем фотографии
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{}).Error; err != nil {
			return err
		}

		// G. Удаляем связь места с тегами (сначала проверяем существование места)
		if post.PlaceID != 0 {
			if err := tx.Where("place_id = ?", post.PlaceID).Delete(&models.PlaceTags{}).Error; err != nil {
				return err
			}
		}

		// H. Удаляем сам Пост
		fmt.Printf("DEBUG: Deleting post ID: %d\n", post.ID)
		if err := tx.Delete(&post).Error; err != nil {
			fmt.Printf("DEBUG: Error deleting post: %v\n", err)
			return err
		}

		// I. Проверяем, используется ли место другими постами
		var otherPostsCount int64
		tx.Model(&models.Post{}).Where("place_id = ?", post.PlaceID).Count(&otherPostsCount)

		fmt.Printf("DEBUG: Other posts using place ID %d: %d\n", post.PlaceID, otherPostsCount)

		// J. Удаляем место только если оно не используется другими постами
		if otherPostsCount == 0 && post.PlaceID != 0 {
			fmt.Printf("DEBUG: Deleting place ID: %d\n", post.PlaceID)
			if err := tx.Where("id = ?", post.PlaceID).Delete(&models.Place{}).Error; err != nil {
				fmt.Printf("DEBUG: Error deleting place: %v\n", err)
				return err
			}
		}

		return nil
	})

	if err != nil {
		if err.Error() == "post not found or unauthorized" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found or unauthorized"})
		} else {
			fmt.Printf("Delete Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed", "details": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post and associated data deleted successfully"})
}

// =========================================================================
// REPORT POST
// =========================================================================

func ReportPost(c *gin.Context) {
	// 1. Проверка авторизации и получение UserID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

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

	// Объявляем переменную вне транзакции
	var newComplaint models.Complaint

	// 4. Создание новой жалобы (БЕЗ автоматического скрытия поста)
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Инициализируем жалобу
		newComplaint = models.Complaint{
			ID:     uuid.New(),
			UserID: reporterID,
			PostID: uint(postID),
			Reason: req.Reason,
			Status: models.StatusNew,
		}

		if err := tx.Create(&newComplaint).Error; err != nil {
			return err
		}

		// ❌ УБИРАЕМ автоматическое скрытие поста
		// Пост остается видимым до решения модератора

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create complaint"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Complaint successfully reported",
		"complaint_id": newComplaint.ID,
	})
}

func GetUserPostsByID(c *gin.Context) {
	userIDStr := c.Param("userID")

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	fmt.Printf("GetUserPostsByID DEBUG: Fetching posts for user ID: %d\n", userID) // ✅ Добавьте этот лог

	var posts []models.Post
	result := database.DB.
		Where("user_id = ?", userID). // ✅ Убедитесь, что используется переданный userID
		Preload("User").
		Preload("Photos").
		Preload("Paragraphs").
		Preload("Place").
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	response := make([]PostResponse, 0)
	for _, p := range posts {
		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", p.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		// Получаем данные пользователя
		userAvatar := ""
		userName := "Неизвестный пользователь"
		if p.User.ID != 0 {
			userAvatar = p.User.ImageUrl
			userName = p.User.Username
		}

		respItem := PostResponse{
			ID:         p.ID,
			UserID:     uint(p.UserID),
			Title:      p.Title,
			Date:       p.CreatedAt,
			PlaceName:  p.Place.Name,
			Tags:       tags,
			Photos:     p.Photos,
			LikesCount: p.LikesCount,
			UserAvatar: userAvatar,
			UserName:   userName,
		}
		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

type AttachPostRequest struct {
	PlaceID   uint    `json:"place_id" binding:"required"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

func AttachPostToPlace(c *gin.Context) {
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

	var input AttachPostRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid request data: %v", err.Error())})
		return
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Проверяем, существует ли пост и принадлежит ли пользователю
		var post models.Post
		if err := tx.First(&post, "id = ? AND user_id = ?", postID, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("post not found or unauthorized")
			}
			return err
		}

		// 2. Проверяем, существует ли место
		var place models.Place
		if err := tx.First(&place, "id = ?", input.PlaceID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("place not found")
			}
			return err
		}

		// 3. Обновляем пост - привязываем к новому месту
		post.PlaceID = input.PlaceID
		if err := tx.Save(&post).Error; err != nil {
			return err
		}

		// 4. Обновляем координаты места (если переданы)
		if input.Latitude != 0 && input.Longitude != 0 {
			place.Latitude = input.Latitude
			place.Longitude = input.Longitude
			if err := tx.Save(&place).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		if err.Error() == "post not found or unauthorized" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found or unauthorized"})
		} else if err.Error() == "place not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Place not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to attach post to place", "details": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post successfully attached to place"})
}
