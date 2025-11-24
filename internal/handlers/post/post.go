package post

import (
	"fmt"
	"net/http"
	"time"
	"tourist-blog/internal/domain/models"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
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
	Tags       []string           `json:"tags"` // Принимаем массив строк для тегов
	Paragraphs []models.Paragraph `json:"paragraphs"`
	Photos     []models.PostPhoto `json:"photos"`
}

type PostResponse struct {
	ID          string             `json:"id"`
	UserID      uint               `json:"user_id"` // ID автора
	Title       string             `json:"title"`
	Date        time.Time          `json:"created_at"`
	PlaceName   string             `json:"place_name"`
	Tags        []string           `json:"tags"`
	PreviewText string             `json:"preview_text"` // Текст первого слайда
	Photos      []models.PostPhoto `json:"photos"`
	LikesCount  int                `json:"likes_count"` // Заглушка
}

type DetailPostResponse struct {
	ID          string    `json:"id"`
	UserID      uint      `json:"user_id"`
	Title       string    `json:"title"`
	Date        time.Time `json:"created_at"`
	PlaceName   string    `json:"place_name"`
	Tags        []string  `json:"tags"`
	PreviewText string    `json:"preview_text"`
	// Добавляем полные данные для детального просмотра
	Paragraphs []models.Paragraph `json:"paragraphs"`
	Photos     []models.PostPhoto `json:"photos"`
	LikesCount int                `json:"likes_count"`
}

type PostUpdateRequest struct {
	Title      string             `json:"title"`
	PlaceData  PlaceCreationData  `json:"place_data"`
	Tags       []string           `json:"tags"`
	Paragraphs []models.Paragraph `json:"paragraphs"`
	Photos     []models.PostPhoto `json:"photos"`
}

func CreatePost(c *gin.Context) {
	// 1. Извлечение UserID из контекста
	userIDFromContext, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: User ID not found in context."})
		return
	}

	var userID int
	// ✅ ФИКС: Более надежное приведение типов с использованием switch
	switch v := userIDFromContext.(type) {
	case int:
		userID = v
	case uint: // Поддержка uint
		userID = int(v)
	case float64: // Поддержка float64 (наиболее частый случай для JWT)
		userID = int(v)
	case int64: // Поддержка int64 (иногда используется для ID)
		userID = int(v)
	default:
		// Если ни один тип не подошел, возвращаем детальную ошибку
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "User ID type assertion failed",
			"details": fmt.Sprintf("Unexpected type: %T", v),
		})
		return
	}

	var input PostCreationRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid request data: %v", err.Error())})
		return
	}

	// 2. Выполнение транзакции
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
			UserID:     userID,
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
				input.Photos[i].ID = ""
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
				// FirstOrCreate: Ищет тег по Name, если не находит, создает новый.
				if err := tx.Where("name = ?", tagName).FirstOrCreate(&tag, models.Tags{Name: tagName}).Error; err != nil {
					return err
				}

				// Создаем связь PlaceTags
				placeTagsToCreate = append(placeTagsToCreate, models.PlaceTags{
					PlaceID: newPlace.ID,
					TagID:   tag.ID,
				})
			}

			// Массовая вставка связей
			if len(placeTagsToCreate) > 0 {
				if result := tx.Create(&placeTagsToCreate); result.Error != nil {
					return result.Error
				}
			}
		}

		return nil // Commit транзакции
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post transactionally", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Post created successfully"})
}

// --- Хендлер для получения постов текущего пользователя ---
func GetUserPosts(c *gin.Context) {
	userIDFromContext, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var userID int
	switch v := userIDFromContext.(type) {
	case int:
		userID = v
	case uint:
		userID = int(v)
	case float64:
		userID = int(v)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID type error"})
		return
	}

	var posts []models.Post

	result := database.DB.Where("user_id = ?", userID).
		Preload("Place").
		// Сортируем параграфы, чтобы первый был первым
		Preload("Paragraphs", func(db *gorm.DB) *gorm.DB {
			return db.Order("paragraphs.order ASC")
		}).
		Preload("Photos").
		Order("created_at desc").
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts", "details": result.Error.Error()})
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

		// ВАЖНОЕ ИСПРАВЛЕНИЕ: Если тегов нет, делаем пустой массив, а не null
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

func GetPost(c *gin.Context) {
	postID := c.Param("postID")
	var post models.Post

	result := database.DB.Where("id = ?", postID).
		Preload("Place").
		// С параграфами обычно работает, так как модель Paragraph -> paragraphs
		Preload("Paragraphs", func(db *gorm.DB) *gorm.DB {
			return db.Order("paragraphs.order ASC")
		}).
		// ИСПРАВЛЕНИЕ: Убираем жесткую привязку к алиасу "photos" или меняем на "post_photos"
		Preload("Photos", func(db *gorm.DB) *gorm.DB {
			// Вариант А (безопасный):
			return db.Order("\"order\" ASC")
			// Вариант Б (если таблица называется post_photos):
			// return db.Order("post_photos.order ASC")
		}).
		First(&post)

	if result.Error != nil {
		// Добавьте логирование ошибки, чтобы видеть её в терминале!
		fmt.Println("Error fetching post:", result.Error)

		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "details": result.Error.Error()})
		}
		return
	}
	// Получаем теги
	var tags []string
	database.DB.Table("tags").
		Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
		Where("place_tags.place_id = ?", post.PlaceID).
		Pluck("tags.name", &tags)

	// Формируем ответ
	response := DetailPostResponse{
		ID:          post.ID,
		UserID:      uint(post.UserID),
		Title:       post.Title,
		Date:        post.CreatedAt,
		PlaceName:   post.Place.Name,
		Tags:        tags,
		PreviewText: "",              // Для одиночного поста превью не обязательно, у нас есть Paragraphs
		Paragraphs:  post.Paragraphs, // ✅ Отдаем все параграфы
		Photos:      post.Photos,     // ✅ Отдаем все фото
		LikesCount:  12,              // Заглушка по дизайну
	}

	c.JSON(http.StatusOK, response)
}

func GetPublicFeed(c *gin.Context) {
	var posts []models.Post
	// Начальный запрос: только одобренные посты
	db := database.DB.Where("is_approved = ?", true)

	// 1. Обработка общего поиска (Title, PlaceName)
	searchQuery := c.Query("search")
	if searchQuery != "" {
		searchTerm := "%" + searchQuery + "%"

		// Делаем явный JOIN для поиска по Place.Name
		db = db.Joins("JOIN places ON places.id = posts.place_id").
			Where(
				// Ищем по названию поста ИЛИ названию места (Case-insensitive LIKE)
				database.DB.Where("posts.title ILIKE ?", searchTerm).
					Or("places.name ILIKE ?", searchTerm),
			)
	}

	// 2. Обработка поиска по тегам
	tagsQuery := c.Query("tags")
	if tagsQuery != "" {
		tagSearchTerm := "%" + tagsQuery + "%"

		// Находим PlaceID, связанные с тегами, которые соответствуют поисковому запросу
		var placeIDsWithTags []uint
		database.DB.Table("place_tags").
			Select("place_id").
			Joins("JOIN tags ON tags.id = place_tags.tag_id").
			Where("tags.name ILIKE ?", tagSearchTerm).
			Group("place_id").
			Pluck("place_id", &placeIDsWithTags)

		// Фильтруем посты по найденным PlaceID
		if len(placeIDsWithTags) > 0 {
			db = db.Where("posts.place_id IN (?)", placeIDsWithTags)
		} else {
			// Если теги введены, но ничего не найдено, возвращаем пустой результат
			db = db.Where("1 = 0")
		}
	}

	// Основной запрос (с учетом примененных выше фильтров)
	result := db.
		Preload("Place").
		Preload("Paragraphs", func(db *gorm.DB) *gorm.DB {
			return db.Order("paragraphs.order ASC")
		}).
		Preload("Photos").
		Order("created_at desc"). // Сначала новые
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

func UpdatePost(c *gin.Context) {
	postID := c.Param("postID")
	userIDFromContext, _ := c.Get("userID") // Предполагаем, что middleware отработал
	// Приведение типов userID (как в CreatePost)...
	var userID int
	switch v := userIDFromContext.(type) {
	case int:
		userID = v
	case uint:
		userID = int(v)
	case float64:
		userID = int(v)
	default:
		userID = 0
	}

	var input PostUpdateRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
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
			// place.Desc = ... если нужно
			tx.Save(&place)
		}

		// 4. Полная перезапись Параграфов (Удалить старые -> Создать новые)
		tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{})
		if len(input.Paragraphs) > 0 {
			for i := range input.Paragraphs {
				input.Paragraphs[i].PostID = post.ID
				input.Paragraphs[i].ID = 0 // сброс ID для создания новых
			}
			tx.Create(&input.Paragraphs)
		}

		// 5. Полная перезапись Фото
		tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{})
		if len(input.Photos) > 0 {
			for i := range input.Photos {
				input.Photos[i].PostID = post.ID
				input.Photos[i].ID = ""
				input.Photos[i].IsApproved = true
			}
			tx.Create(&input.Photos)
		}

		// 6. Обновление тегов (удаляем старые связи -> создаем новые)
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
				tx.Create(&models.PlaceTags{PlaceID: post.PlaceID, TagID: tag.ID})
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

func DeletePost(c *gin.Context) {
	postID := c.Param("postID")
	userIDFromContext, exists := c.Get("userID")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Приведение типов userID (как вы делали в других хендлерах)
	var userID int
	switch v := userIDFromContext.(type) {
	case int:
		userID = v
	case uint:
		userID = int(v)
	case float64:
		userID = int(v)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID type error"})
		return
	}

	// ИСПРАВЛЕНИЕ: Используем транзакцию для каскадного удаления
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var post models.Post

		// 1. Проверяем существование поста и права пользователя
		// Используем First, чтобы получить модель для дальнейшего использования
		if err := tx.Where("id = ? AND user_id = ?", postID, userID).First(&post).Error; err != nil {
			return err // Вернет ошибку, если пост не найден или чужой
		}

		// 2. Удаляем связанные ПАРАГРАФЫ (решает ошибку fk_posts_paragraphs)
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{}).Error; err != nil {
			return err
		}

		// 3. Удаляем связанные ФОТО
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{}).Error; err != nil {
			return err
		}

		// 4. (Опционально) Удаляем само МЕСТО (Place) и теги места, если нужно.
		// Судя по логике CreatePost, вы создаете новое Place на каждый пост.
		// Если не удалить Place, база засорится "осиротевшими" местами.

		// Сначала удаляем связи тегов с местом
		if err := tx.Where("place_id = ?", post.PlaceID).Delete(&models.PlaceTags{}).Error; err != nil {
			return err
		}

		// Удаляем сам Пост
		if err := tx.Delete(&post).Error; err != nil {
			return err
		}

		// Удаляем Место (делаем это ПОСЛЕ удаления поста, так как пост ссылается на место)
		if err := tx.Where("id = ?", post.PlaceID).Delete(&models.Place{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found or unauthorized"})
		} else {
			// Логируем ошибку для дебага
			fmt.Printf("Delete Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed", "details": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post and associated data deleted successfully"})
}
