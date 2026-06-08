package maps

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
)

func GetMapDataByUserID(c *gin.Context) {
	userIDStr := c.Param("userID")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var posts []models.Post
	if err := database.DB.
		Where("user_id = ? AND is_approved = ?", userID, true).
		Preload("Photos").
		Preload("Settlement").
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	var markers []gin.H
	for _, post := range posts {
		var photoURLs []string
		for _, photo := range post.Photos {
			photoURLs = append(photoURLs, photo.Url)
		}

		markers = append(markers, gin.H{
			"id":          post.ID,
			"title":       post.Title,
			"place_id":    post.SettlementID,
			"place_name":  post.SettlementName,
			"latitude":    post.Settlement.Latitude,
			"longitude":   post.Settlement.Longitude,
			"created_at":  post.CreatedAt,
			"photos":      photoURLs,
			"likes_count": post.LikesCount,
			"user_id":     post.UserID,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"posts": markers,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"avatar":   user.ImageUrl,
		},
	})
}

func GetUserMapData(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID := userIDValue.(uint)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var posts []models.Post
	if err := database.DB.
		Where("user_id = ? AND is_approved = ?", userID, true).
		Preload("Photos").
		Preload("Settlement").
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	var markers []gin.H
	for _, post := range posts {
		var photoURLs []string
		for _, photo := range post.Photos {
			photoURLs = append(photoURLs, photo.Url)
		}

		markers = append(markers, gin.H{
			"id":          post.ID,
			"title":       post.Title,
			"place_id":    post.SettlementID,
			"place_name":  post.SettlementName,
			"latitude":    post.Settlement.Latitude,
			"longitude":   post.Settlement.Longitude,
			"created_at":  post.CreatedAt,
			"photos":      photoURLs,
			"likes_count": post.LikesCount,
			"user_id":     post.UserID,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"posts": markers,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"avatar":   user.ImageUrl,
		},
	})
}

func GetAllPostsMapData(c *gin.Context) {
	var posts []models.Post

	if err := database.DB.
		Preload("Settlement").
		Preload("Photos").
		Where("is_approved = ?", true).
		Order("created_at DESC").
		Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch posts"})
		return
	}

	var postMarkers []gin.H
	for _, post := range posts {
		if post.SettlementID == 0 || post.Settlement.Latitude == 0 || post.Settlement.Longitude == 0 {
			continue
		}

		var photoUrls []string
		for _, photo := range post.Photos {
			if photo.Url != "" {
				photoUrls = append(photoUrls, photo.Url)
			}
		}

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
