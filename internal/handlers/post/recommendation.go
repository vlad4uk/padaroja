package post

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PostRecommendationResponse - структура для ответа с рекомендациями
type PostRecommendationResponse struct {
	ID             uint            `json:"id"`
	Title          string          `json:"title"`
	CreatedAt      string          `json:"created_at"`
	SettlementName string          `json:"settlement_name"`
	SettlementID   uint            `json:"settlement_id"`
	Tags           []string        `json:"tags"`
	Photos         []PhotoResponse `json:"photos"`
	LikesCount     int             `json:"likes_count"`
	UserID         uint            `json:"user_id"`
	UserAvatar     string          `json:"user_avatar"`
	UserName       string          `json:"user_name"`
}

// PhotoResponse - структура для фото в ответе
type PhotoResponse struct {
	URL string `json:"url"`
}

// GetGeoRecommendations - гео-рекомендации (места, похожие на те, что пользователь уже лайкал)
func GetGeoRecommendations(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	var posts []models.Post

	// 1. Какие локации пользователь уже "любит" (лайки/избранное)
	var likedSettlements []uint
	database.DB.Table("posts").
		Select("DISTINCT settlement_id").
		Joins("JOIN likes ON likes.post_id = posts.id").
		Where("likes.user_id = ?", userID).
		Pluck("settlement_id", &likedSettlements)

	var favouritedSettlements []uint
	database.DB.Table("posts").
		Select("DISTINCT settlement_id").
		Joins("JOIN favourites ON favourites.post_id = posts.id").
		Where("favourites.user_id = ?", userID).
		Pluck("settlement_id", &favouritedSettlements)

	allSettlements := append(likedSettlements, favouritedSettlements...)

	if len(allSettlements) == 0 {
		// Если нет истории, показываем популярные посты (исключая свои)
		database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url")
		}).
			Preload("Settlement").
			Preload("Photos", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_approved = true").Order("\"order\" ASC")
			}).
			Preload("Tags").
			Where("is_approved = true").
			Where("user_id != ?", userID).
			Where("id NOT IN (?)",
				database.DB.Table("posts").Select("id").Where("user_id = ?", userID),
			).
			Order("likes_count DESC").
			Limit(limit).
			Find(&posts)
	} else {
		// 2. Ищем посты из этих локаций, которые пользователь еще не видел
		err := database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url")
		}).
			Preload("Settlement").
			Preload("Photos", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_approved = true").Order("\"order\" ASC")
			}).
			Preload("Tags").
			Where("is_approved = true").
			Where("settlement_id IN (?)", allSettlements).
			Where("user_id != ?", userID).
			Where("id NOT IN (?)",
				database.DB.Table("likes").Select("post_id").Where("user_id = ?", userID),
			).
			Where("id NOT IN (?)",
				database.DB.Table("favourites").Select("post_id").Where("user_id = ?", userID),
			).
			Where("id NOT IN (?)",
				database.DB.Table("posts").Select("id").Where("user_id = ?", userID),
			).
			Order("likes_count DESC").
			Limit(limit).
			Find(&posts).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Форматируем ответ
	response := formatRecommendationResponse(posts)
	c.JSON(http.StatusOK, gin.H{"posts": response, "type": "geo"})
}

// GetFollowRecommendations - рекомендации от подписок
func GetFollowRecommendations(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	var posts []models.Post

	// Сначала проверяем, есть ли у пользователя подписки
	var followCount int64
	database.DB.Model(&models.Followers{}).
		Where("follower_id = ?", userID).
		Count(&followCount)

	if followCount == 0 {
		// Если нет подписок, показываем популярные посты (исключая свои)
		database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url")
		}).
			Preload("Settlement").
			Preload("Photos", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_approved = true").Order("\"order\" ASC")
			}).
			Preload("Tags").
			Where("is_approved = true").
			Where("user_id != ?", userID).
			Where("id NOT IN (?)",
				database.DB.Table("posts").Select("id").Where("user_id = ?", userID),
			).
			Order("likes_count DESC").
			Limit(limit).
			Find(&posts)
	} else {
		// Основной запрос - посты от подписок
		err := database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url, bio")
		}).
			Preload("Settlement").
			Preload("Photos", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_approved = true").Order("\"order\" ASC")
			}).
			Preload("Tags").
			Joins("JOIN followers ON followers.followed_id = posts.user_id").
			Where("followers.follower_id = ?", userID).
			Where("posts.is_approved = true").
			Where("posts.user_id != ?", userID).
			Where("posts.id NOT IN (?)",
				database.DB.Table("likes").Select("post_id").Where("user_id = ?", userID),
			).
			Where("posts.id NOT IN (?)",
				database.DB.Table("favourites").Select("post_id").Where("user_id = ?", userID),
			).
			Where("posts.id NOT IN (?)",
				database.DB.Table("posts").Select("id").Where("user_id = ?", userID),
			).
			Order("posts.created_at DESC").
			Limit(limit).
			Find(&posts).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Форматируем ответ
	response := formatRecommendationResponse(posts)
	c.JSON(http.StatusOK, gin.H{"posts": response, "type": "follow"})
}

// formatRecommendationResponse - форматирует посты для ответа с рекомендациями
func formatRecommendationResponse(posts []models.Post) []PostRecommendationResponse {
	response := make([]PostRecommendationResponse, 0, len(posts))

	for _, post := range posts {
		// Получаем теги
		tags := make([]string, 0)
		for _, tag := range post.Tags {
			tags = append(tags, tag.Name)
		}

		// Получаем фото
		photos := make([]PhotoResponse, 0)
		if post.Photos != nil {
			for _, photo := range post.Photos {
				photos = append(photos, PhotoResponse{URL: photo.Url})
			}
		}

		// Получаем имя поселения - Settlement это встроенная структура, проверяем по ID
		settlementName := ""
		if post.Settlement.Geonameid != 0 {
			settlementName = post.Settlement.Name
		}

		// Получаем аватар и имя пользователя - User это встроенная структура, проверяем по ID
		userAvatar := ""
		userName := ""
		if post.User.ID != 0 {
			userName = post.User.Username
			userAvatar = post.User.ImageUrl
		}

		response = append(response, PostRecommendationResponse{
			ID:             post.ID,
			Title:          post.Title,
			CreatedAt:      post.CreatedAt.Format("2006-01-02 15:04:05"),
			SettlementName: settlementName,
			SettlementID:   post.SettlementID,
			Tags:           tags,
			Photos:         photos,
			LikesCount:     post.LikesCount,
			UserID:         uint(post.UserID),
			UserAvatar:     userAvatar,
			UserName:       userName,
		})
	}

	return response
}
