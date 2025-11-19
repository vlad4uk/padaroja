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

// --- Хендлер для получения ВСЕХ одобренных постов (для общей ленты) ---
func GetPublicFeed(c *gin.Context) {
	var posts []models.Post

	// Фильтруем только посты, одобренные модератором
	result := database.DB.Where("is_approved = ?", true).
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

func UpdatePost(c *gin.Context) {}
func DeletePost(c *gin.Context) {}
func GetPost(c *gin.Context)    {}
