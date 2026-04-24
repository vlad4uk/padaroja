package post

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"padaroja/internal/domain/models"
	"padaroja/internal/sse"
	database "padaroja/internal/storage/postgres"
	"padaroja/utils"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PostCreationRequest struct {
	Title          string             `json:"title" binding:"required"`
	SettlementID   uint               `json:"settlement_id" binding:"required"`   // Изменено: settlement_id
	SettlementName string             `json:"settlement_name" binding:"required"` // Изменено: settlement_name
	Tags           []string           `json:"tags"`
	Paragraphs     []models.Paragraph `json:"paragraphs"`
	Photos         []models.PostPhoto `json:"photos"`
}

type PostResponse struct {
	ID             uint               `json:"id"`
	UserID         uint               `json:"user_id"`
	Title          string             `json:"title"`
	Date           time.Time          `json:"created_at"`
	SettlementName string             `json:"settlement_name"`
	SettlementID   uint               `json:"settlement_id"`
	Tags           []string           `json:"tags"`
	Photos         []models.PostPhoto `json:"photos"`
	LikesCount     int                `json:"likes_count"`
	UserAvatar     string             `json:"user_avatar"`
	UserName       string             `json:"user_name"`
}

type DetailPostResponse struct {
	ID               uint               `json:"id"`
	UserID           uint               `json:"user_id"`
	Title            string             `json:"title"`
	Date             time.Time          `json:"created_at"`
	SettlementName   string             `json:"settlement_name"`
	SettlementID     uint               `json:"settlement_id"`
	Tags             []string           `json:"tags"`
	PreviewText      string             `json:"preview_text"`
	Paragraphs       []models.Paragraph `json:"paragraphs"`
	Photos           []models.PostPhoto `json:"photos"`
	LikesCount       int                `json:"likes_count"`
	CommentsDisabled bool               `json:"comments_disabled"`
}

type PostUpdateRequest struct {
	Title          string             `json:"title"`
	SettlementID   uint               `json:"settlement_id"`
	SettlementName string             `json:"settlement_name"`
	Tags           []string           `json:"tags"`
	Paragraphs     []models.Paragraph `json:"paragraphs"`
	Photos         []models.PostPhoto `json:"photos"`
}

type ReportRequest struct {
	Reason string `json:"reason" binding:"required"`
}

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

func extractRussianName(alternatenames string) string {
	parts := strings.Split(alternatenames, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		for _, r := range part {
			if (r >= 'А' && r <= 'я') || r == 'Ё' || r == 'ё' || r == 'і' || r == 'ў' {
				return part
			}
		}
	}
	if len(parts) > 0 {
		return strings.TrimSpace(parts[0])
	}
	return ""
}

func validateSettlement(tx *gorm.DB, settlementID uint, inputName string) (string, error) {
	log.Printf("Валидация settlement: ID=%d, Name=%s", settlementID, inputName)

	var settlement models.Settlement
	if err := tx.First(&settlement, "geonameid = ?", settlementID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Printf("Settlement с ID %d не найден в БД", settlementID)
			return "", fmt.Errorf("settlement with ID %d not found", settlementID)
		}
		log.Printf("Ошибка при поиске settlement: %v", err)
		return "", err
	}

	log.Printf("Найден settlement: ID=%d, Name=%s, Alternatenames=%s",
		settlement.Geonameid, settlement.Name, settlement.Alternatenames)

	// Извлекаем русское/белорусское название из alternatenames
	correctName := extractRussianName(settlement.Alternatenames)
	log.Printf("Извлеченное русское название: %s", correctName)

	// Если введенное название не совпадает с корректным, используем корректное
	if inputName != correctName && correctName != "" {
		log.Printf("Заменяем название '%s' на '%s'", inputName, correctName)
		return correctName, nil
	}

	return inputName, nil
}

func CreatePost(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: User ID not found in context."})
		return
	}

	// Логируем входящий запрос для отладки
	body, _ := io.ReadAll(c.Request.Body)
	log.Printf("Входящий запрос: %s", string(body))
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	var input PostCreationRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("Ошибка парсинга JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	log.Printf("Распарсенные данные: SettlementID=%d, SettlementName=%s",
		input.SettlementID, input.SettlementName)

	// Валидация
	if input.SettlementID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SettlementID is required and cannot be 0"})
		return
	}

	if input.SettlementName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SettlementName is required"})
		return
	}

	// Очищаем название от лишних символов
	input.SettlementName = utils.CleanSettlementName(input.SettlementName)

	var newPost models.Post // Объявляем здесь, чтобы использовать после транзакции

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Проверяем существование settlement
		var settlement models.Settlement
		if err := tx.First(&settlement, "geonameid = ?", input.SettlementID).Error; err != nil {
			log.Printf("Населенный пункт с ID %d не найден", input.SettlementID)
			return fmt.Errorf("settlement with ID %d not found", input.SettlementID)
		}

		// Создаем пост с явным указанием likes_count = 0
		newPost = models.Post{
			UserID:         int(userID),
			SettlementID:   input.SettlementID,
			SettlementName: input.SettlementName,
			Title:          input.Title,
			IsApproved:     true,
			CreatedAt:      time.Now(),
			LikesCount:     0, // Явно устанавливаем 0
		}

		if result := tx.Create(&newPost); result.Error != nil {
			return result.Error
		}

		log.Printf("✅ Пост создан с ID: %d, LikesCount: %d", newPost.ID, newPost.LikesCount)

		// Создаем параграфы
		if len(input.Paragraphs) > 0 {
			for i := range input.Paragraphs {
				input.Paragraphs[i].PostID = newPost.ID
			}
			if err := tx.Create(&input.Paragraphs).Error; err != nil {
				return err
			}
		}

		// Создаем фото
		if len(input.Photos) > 0 {
			for i := range input.Photos {
				input.Photos[i].PostID = newPost.ID
				input.Photos[i].IsApproved = true
			}
			if err := tx.Create(&input.Photos).Error; err != nil {
				return err
			}
		}

		// Создаем теги
		if len(input.Tags) > 0 {
			var postTags []models.PostTag
			for _, tagName := range input.Tags {
				if tagName == "" {
					continue
				}

				var tag models.Tags
				if err := tx.Where("name = ?", tagName).FirstOrCreate(&tag, models.Tags{Name: tagName}).Error; err != nil {
					return err
				}

				postTags = append(postTags, models.PostTag{
					PostID: newPost.ID,
					TagID:  tag.ID,
				})
			}

			if len(postTags) > 0 {
				if err := tx.Create(&postTags).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		log.Printf("❌ Ошибка создания поста: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create post",
			"details": err.Error(),
		})
		return
	}

	// Загружаем пользователя для получения имени и аватара
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		log.Printf("Предупреждение: не удалось загрузить данные пользователя: %v", err)
	}

	// Формируем данные для отправки
	postData := gin.H{
		"id":              newPost.ID,
		"user_id":         newPost.UserID,
		"title":           newPost.Title,
		"created_at":      newPost.CreatedAt,
		"settlement_name": newPost.SettlementName,
		"settlement_id":   newPost.SettlementID,
		"tags":            input.Tags,
		"photos":          newPost.Photos,
		"likes_count":     0, // Явно указываем 0 в SSE сообщении
		"user_name":       user.Username,
		"user_avatar":     user.ImageUrl,
	}

	// Создаем SSE сообщение
	message := map[string]interface{}{
		"type": "NEW_POST",
		"data": postData,
	}

	data, _ := json.Marshal(message)

	// Отправляем через глобальный хаб (асинхронно)
	go func() {
		if sse.GlobalHub != nil {
			// Всем подписчикам
			sse.GlobalHub.BroadcastAll <- data

			// Конкретному пользователю
			sse.GlobalHub.BroadcastUser <- sse.UserMessage{
				UserID: int(userID),
				Data:   data,
			}
			log.Printf("📢 SSE broadcast sent for post %d", newPost.ID)
		} else {
			log.Printf("⚠️ GlobalHub is nil, SSE not sent")
		}
	}()

	log.Printf("✅ Post creation completed successfully for post ID: %d", newPost.ID)
	c.JSON(http.StatusCreated, gin.H{
		"message": "Post created successfully",
		"id":      newPost.ID,
	})
}

// SearchSettlements - хендлер для поиска населенных пунктов (адаптированный из вашего working кода)
// SearchSettlements - хендлер для поиска населенных пунктов
// SearchSettlements - поиск населенных пунктов с использованием GORM
func SearchSettlements(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter q is required"})
		return
	}

	log.Printf("Поиск населенного пункта: '%s'", query)

	var settlements []models.Settlement

	// Используем сырой SQL для полнотекстового поиска с similarity
	// PostgreSQL расширение pg_trgm должно быть установлено
	err := database.DB.Raw(`
		SELECT geonameid, name, asciiname, alternatenames, latitude, longitude,
			   similarity(alternatenames, ?) as sim
		FROM settlements 
		WHERE alternatenames % ? 
		   OR alternatenames ILIKE '%' || ? || '%'
		   OR name ILIKE '%' || ? || '%'
		ORDER BY sim DESC NULLS LAST
		LIMIT 15
	`, query, query, query, query).Scan(&settlements).Error

	if err != nil {
		log.Printf("Ошибка поиска с similarity: %v", err)

		// Пробуем без similarity, если расширение не установлено
		err = database.DB.Where("alternatenames ILIKE ? OR name ILIKE ?",
			"%"+query+"%", "%"+query+"%").
			Limit(15).
			Find(&settlements).Error

		if err != nil {
			log.Printf("Ошибка поиска: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
			return
		}
	}

	var results []gin.H
	seen := make(map[string]bool) // для избежания дубликатов

	for _, s := range settlements {
		// Извлекаем русское название
		russianName := utils.ExtractRussianName(s.Alternatenames)
		if russianName == "" {
			russianName = s.Name
		}

		// Проверяем на дубликаты (по ID)
		if seen[russianName] {
			continue
		}
		seen[russianName] = true

		results = append(results, gin.H{
			"id":             s.Geonameid,
			"name":           russianName,
			"display_name":   russianName, // для отображения
			"original_name":  s.Name,      // оригинальное название
			"alternatenames": s.Alternatenames,
			"latitude":       s.Latitude,
			"longitude":      s.Longitude,
		})
	}

	log.Printf("Найдено %d результатов для запроса '%s'", len(results), query)

	c.JSON(http.StatusOK, gin.H{
		"search_term": query,
		"results":     results,
	})
}

// Остальные функции (GetUserPosts, GetPost, GetPublicFeed, UpdatePost, DeletePost, ReportPost, GetUserPostsByID, ToggleComments)
// остаются без изменений, но для полноты я их тоже включу

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
		Where("user_id = ? AND is_approved = ?", userID, true). // Добавлен фильтр is_approved
		Preload("User").
		Preload("Photos").
		Preload("Paragraphs").
		Preload("Settlement").
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	response := make([]PostResponse, 0)
	for _, p := range posts {
		var tags []string
		database.DB.Table("tags").
			Joins("JOIN post_tags ON post_tags.tag_id = tags.id").
			Where("post_tags.post_id = ?", p.ID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		userAvatar := ""
		userName := "Неизвестный пользователь"
		if p.User.ID != 0 {
			userAvatar = p.User.ImageUrl
			userName = p.User.Username
		}

		respItem := PostResponse{
			ID:             p.ID,
			UserID:         uint(p.UserID),
			Title:          p.Title,
			Date:           p.CreatedAt,
			SettlementName: p.SettlementName,
			SettlementID:   p.SettlementID,
			Tags:           tags,
			Photos:         p.Photos,
			LikesCount:     p.LikesCount,
			UserAvatar:     userAvatar,
			UserName:       userName,
		}
		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

func GetPost(c *gin.Context) {
	postIDStr := c.Param("postID")

	postID, err := strconv.ParseUint(postIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID format"})
		return
	}

	var post models.Post

	result := database.DB.Where("id = ?", postID).
		Preload("User").
		Preload("Settlement").
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
		Joins("JOIN post_tags ON post_tags.tag_id = tags.id").
		Where("post_tags.post_id = ?", post.ID).
		Pluck("tags.name", &tags)

	response := DetailPostResponse{
		ID:               post.ID,
		UserID:           uint(post.UserID),
		Title:            post.Title,
		Date:             post.CreatedAt,
		SettlementName:   post.SettlementName,
		SettlementID:     post.SettlementID,
		Tags:             tags,
		PreviewText:      "",
		Paragraphs:       post.Paragraphs,
		Photos:           post.Photos,
		LikesCount:       post.LikesCount,
		CommentsDisabled: post.CommentsDisabled,
	}

	c.JSON(http.StatusOK, response)
}

func GetPublicFeed(c *gin.Context) {
	var posts []models.Post

	db := database.DB.Model(&models.Post{}).Where("is_approved = ?", true)

	searchQuery := c.Query("search")
	if searchQuery != "" {
		searchTerm := "%" + searchQuery + "%"
		// Ищем по названию поста или названию населенного пункта
		db = db.Where(
			database.DB.Where("posts.title ILIKE ?", searchTerm).
				Or("posts.settlement_name ILIKE ?", searchTerm),
		)
	}

	tagsQuery := c.Query("tags")
	if tagsQuery != "" {
		tagSearchTerm := "%" + tagsQuery + "%"

		var postIDsWithTags []uint
		database.DB.Table("post_tags").
			Select("post_id").
			Joins("JOIN tags ON tags.id = post_tags.tag_id").
			Where("tags.name ILIKE ?", tagSearchTerm).
			Group("post_id").
			Pluck("post_id", &postIDsWithTags)

		if len(postIDsWithTags) > 0 {
			db = db.Where("posts.id IN (?)", postIDsWithTags)
		} else {
			db = db.Where("1 = 0")
		}
	}

	// НОВЫЙ КОД: Сортировка
	sortBy := c.Query("sort")
	switch sortBy {
	case "popular":
		db = db.Order("likes_count DESC, created_at DESC")
	case "trending":
		// Актуальные: лайки за последние 24 часа
		db = db.Joins(`
            LEFT JOIN (
                SELECT post_id, COUNT(*) as recent_likes 
                FROM likes 
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY post_id
            ) recent ON recent.post_id = posts.id
        `).Order("COALESCE(recent.recent_likes, 0) DESC, posts.created_at DESC")
	default: // "new" или любой другой
		db = db.Order("created_at DESC")
	}

	result := db.
		Preload("User").
		Preload("Settlement").
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
			Joins("JOIN post_tags ON post_tags.tag_id = tags.id").
			Where("post_tags.post_id = ?", p.ID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		userAvatar := ""
		userName := "Неизвестный пользователь"

		if p.User.ID != 0 {
			userAvatar = p.User.ImageUrl
			userName = p.User.Username
		}

		respItem := PostResponse{
			ID:             p.ID,
			UserID:         uint(p.UserID),
			Title:          p.Title,
			Date:           p.CreatedAt,
			SettlementName: p.SettlementName,
			SettlementID:   p.SettlementID,
			Tags:           tags,
			Photos:         p.Photos,
			LikesCount:     p.LikesCount,
			UserAvatar:     userAvatar,
			UserName:       userName,
		}
		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

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
		if err := tx.First(&post, "id = ? AND user_id = ?", postID, userID).Error; err != nil {
			return err
		}

		// Если меняется settlement, проверяем его существование и корректируем название
		if input.SettlementID != 0 {
			correctedName, err := validateSettlement(tx, input.SettlementID, input.SettlementName)
			if err != nil {
				return err
			}
			post.SettlementID = input.SettlementID
			post.SettlementName = correctedName
		}

		if input.Title != "" {
			post.Title = input.Title
		}

		if err := tx.Save(&post).Error; err != nil {
			return err
		}

		// Обновляем параграфы
		if len(input.Paragraphs) > 0 {
			tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{})
			for i := range input.Paragraphs {
				input.Paragraphs[i].PostID = post.ID
				input.Paragraphs[i].ID = 0
			}
			if err := tx.Create(&input.Paragraphs).Error; err != nil {
				return err
			}
		}

		// Обновляем фото
		if len(input.Photos) > 0 {
			tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{})
			for i := range input.Photos {
				input.Photos[i].PostID = post.ID
				input.Photos[i].ID = 0
				input.Photos[i].IsApproved = true
			}
			if err := tx.Create(&input.Photos).Error; err != nil {
				return err
			}
		}

		// Обновляем теги
		if len(input.Tags) > 0 {
			tx.Where("post_id = ?", post.ID).Delete(&models.PostTag{})
			for _, tagName := range input.Tags {
				if tagName == "" {
					continue
				}
				var tag models.Tags
				if err := tx.Where("name = ?", tagName).FirstOrCreate(&tag, models.Tags{Name: tagName}).Error; err != nil {
					return err
				}
				if err := tx.Create(&models.PostTag{PostID: post.ID, TagID: tag.ID}).Error; err != nil {
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

		result := tx.Where("id = ? AND user_id = ?", postID, userID).First(&post)
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				return fmt.Errorf("post not found or unauthorized")
			}
			return result.Error
		}

		fmt.Printf("DEBUG: Found post ID: %d, SettlementID: %d\n", post.ID, post.SettlementID)

		// Удаляем связанные данные
		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Like{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Comment{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Favourite{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Complaint{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.Paragraph{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.PostPhoto{}).Error; err != nil {
			return err
		}

		if err := tx.Where("post_id = ?", post.ID).Delete(&models.PostTag{}).Error; err != nil {
			return err
		}

		// Удаляем пост
		fmt.Printf("DEBUG: Deleting post ID: %d\n", post.ID)
		if err := tx.Delete(&post).Error; err != nil {
			fmt.Printf("DEBUG: Error deleting post: %v\n", err)
			return err
		}

		// Примечание: settlement не удаляется, так как может использоваться другими постами

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

func ReportPost(c *gin.Context) {
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

	postIDStr := c.Param("postID")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID format"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required,min=10,max=500"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var existingComplaint models.Complaint
	err = database.DB.Where("user_id = ? AND post_id = ?", reporterID, postID).
		First(&existingComplaint).Error

	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You have already reported this post"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	postIDUint := uint(postID)
	newComplaint := models.Complaint{
		ID:     uuid.New(),
		UserID: reporterID,
		Type:   models.ComplaintTypePost,
		PostID: &postIDUint,
		Reason: req.Reason,
		Status: models.StatusNew,
	}

	if err := database.DB.Create(&newComplaint).Error; err != nil {
		fmt.Println("Error creating complaint:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create complaint"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Complaint successfully reported",
		"complaint_id": newComplaint.ID,
		"complaint":    newComplaint,
	})
}

func GetUserPostsByID(c *gin.Context) {
	userIDStr := c.Param("userID")

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	fmt.Printf("GetUserPostsByID DEBUG: Fetching posts for user ID: %d\n", userID)

	var posts []models.Post
	result := database.DB.
		Where("user_id = ? AND is_approved = ?", userID, true). // Добавлен фильтр is_approved
		Preload("User").
		Preload("Photos").
		Preload("Paragraphs").
		Preload("Settlement").
		Find(&posts)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	response := make([]PostResponse, 0)
	for _, p := range posts {
		var tags []string
		database.DB.Table("tags").
			Joins("JOIN post_tags ON post_tags.tag_id = tags.id").
			Where("post_tags.post_id = ?", p.ID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		userAvatar := ""
		userName := "Неизвестный пользователь"
		if p.User.ID != 0 {
			userAvatar = p.User.ImageUrl
			userName = p.User.Username
		}

		respItem := PostResponse{
			ID:             p.ID,
			UserID:         uint(p.UserID),
			Title:          p.Title,
			Date:           p.CreatedAt,
			SettlementName: p.SettlementName,
			SettlementID:   p.SettlementID,
			Tags:           tags,
			Photos:         p.Photos,
			LikesCount:     p.LikesCount,
			UserAvatar:     userAvatar,
			UserName:       userName,
		}
		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

func ToggleComments(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := int(userIDValue.(uint))

	postIDStr := c.Param("postID")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var input struct {
		Disabled bool `json:"disabled"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	if post.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only post author can manage comments"})
		return
	}

	if err := database.DB.Model(&post).Update("comments_disabled", input.Disabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comments status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           "Comments status updated",
		"comments_disabled": input.Disabled,
	})
}
