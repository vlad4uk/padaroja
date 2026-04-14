package maps

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Найдите функцию GetUserMapData или GetMapDataByUserID
// И добавьте Preload("Photos") в запрос:

func GetUserMapData(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := userID.(uint)

	var posts []models.Post
	if err := database.DB.
		Preload("Settlement").
		Preload("Photos"). // ВАЖНО: добавляем загрузку фото
		Where("user_id = ?", uid).
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch posts"})
		return
	}

	var postMarkers []gin.H
	for _, post := range posts {
		if post.SettlementID == 0 {
			continue
		}

		// Формируем массив URL фото
		var photoUrls []string
		for _, photo := range post.Photos {
			photoUrls = append(photoUrls, photo.Url)
		}

		postMarkers = append(postMarkers, gin.H{
			"id":          post.ID,
			"title":       post.Title,
			"place_id":    post.SettlementID,
			"place_name":  post.SettlementName,
			"latitude":    post.Settlement.Latitude,
			"longitude":   post.Settlement.Longitude,
			"created_at":  post.CreatedAt,
			"photos":      photoUrls, // теперь передаем массив URL
			"likes_count": post.LikesCount,
			"user_id":     post.UserID,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"reviews": []interface{}{},
		"posts":   postMarkers,
		"user": gin.H{
			"id":       uid,
			"username": "", // можно подгрузить из БД
			"avatar":   "",
		},
	})
}

// GetMapDataByUserID - возвращает посты любого пользователя по его ID
func GetMapDataByUserID(c *gin.Context) {
	userIDStr := c.Param("userID")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Получаем все посты пользователя с координатами из settlements
	var posts []models.Post
	if err := database.DB.
		Preload("Settlement").
		Where("user_id = ?", uint(userID)).
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch posts"})
		return
	}

	// Формируем ответ для карты
	var postMarkers []gin.H
	for _, post := range posts {
		if post.SettlementID == 0 {
			continue
		}

		var photos []string
		for _, photo := range post.Photos {
			photos = append(photos, photo.Url)
		}

		postMarkers = append(postMarkers, gin.H{
			"id":          post.ID,
			"title":       post.Title,
			"place_id":    post.SettlementID,
			"place_name":  post.SettlementName,
			"latitude":    post.Settlement.Latitude,
			"longitude":   post.Settlement.Longitude,
			"created_at":  post.CreatedAt,
			"photos":      photos,
			"likes_count": post.LikesCount,
			"user_id":     post.UserID,
		})
	}

	// Информация о пользователе
	var user models.User
	database.DB.Select("id, username, image_url").First(&user, userID)

	c.JSON(http.StatusOK, gin.H{
		"reviews": []interface{}{},
		"posts":   postMarkers,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"avatar":   user.ImageUrl,
		},
	})
}

func GetAllPostsMapData(c *gin.Context) {
	var posts []models.Post

	// Загружаем все одобренные посты с их поселениями и фото
	if err := database.DB.
		Preload("Settlement").
		Preload("Photos").
		Where("is_approved = ?", true). // Только одобренные посты
		Order("created_at DESC").
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch posts"})
		return
	}

	// Формируем ответ для карты
	var postMarkers []gin.H
	for _, post := range posts {
		if post.SettlementID == 0 || post.Settlement.Latitude == 0 || post.Settlement.Longitude == 0 {
			continue
		}

		// Формируем массив URL фото
		var photoUrls []string
		for _, photo := range post.Photos {
			if photo.Url != "" {
				photoUrls = append(photoUrls, photo.Url)
			}
		}

		// Получаем имя пользователя
		var user models.User
		userName := ""
		if err := database.DB.Select("username").First(&user, post.UserID).Error; err == nil {
			userName = user.Username
		}

		postMarkers = append(postMarkers, gin.H{
			"id":          post.ID,
			"title":       post.Title,
			"place_id":    post.SettlementID,
			"place_name":  post.SettlementName,
			"latitude":    post.Settlement.Latitude,
			"longitude":   post.Settlement.Longitude,
			"created_at":  post.CreatedAt,
			"photos":      photoUrls,
			"likes_count": post.LikesCount,
			"user_id":     post.UserID,
			"user_name":   userName,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"posts": postMarkers,
		"total": len(postMarkers),
	})
}
