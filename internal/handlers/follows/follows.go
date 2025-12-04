package follows

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// FollowUser - подписаться на пользователя
func FollowUser(c *gin.Context) {
	// Получаем ID пользователя, на которого подписываемся
	followedIDStr := c.Param("userID")
	followedID, err := strconv.Atoi(followedIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Получаем ID подписчика (текущий пользователь)
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	followerID := int(userIDValue.(uint))

	// Нельзя подписаться на самого себя
	if followerID == followedID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot follow yourself"})
		return
	}

	// Проверяем, существует ли пользователь, на которого подписываемся
	var targetUser models.User
	if err := database.DB.First(&targetUser, followedID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User to follow not found"})
		return
	}

	// Проверяем, не подписаны ли уже
	var existingFollow models.Followers
	err = database.DB.Where("follower_id = ? AND followed_id = ?", followerID, followedID).First(&existingFollow).Error

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Already following this user"})
		return
	}

	// Создаем подписку
	follow := models.Followers{
		FollowerID: followerID,
		FollowedID: followedID,
	}

	if err := database.DB.Create(&follow).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to follow user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully followed user",
		"follow":  follow,
	})
}

// UnfollowUser - отписаться от пользователя
func UnfollowUser(c *gin.Context) {
	followedIDStr := c.Param("userID")
	followedID, err := strconv.Atoi(followedIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	followerID := int(userIDValue.(uint))

	// Удаляем подписку
	result := database.DB.Where("follower_id = ? AND followed_id = ?", followerID, followedID).Delete(&models.Followers{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unfollow user"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Follow relationship not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully unfollowed user"})
}

// CheckFollow - проверить, подписан ли текущий пользователь на другого
func CheckFollow(c *gin.Context) {
	targetUserIDStr := c.Param("userID")
	targetUserID, err := strconv.Atoi(targetUserIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	currentUserID := int(userIDValue.(uint))

	var follow models.Followers
	err = database.DB.Where("follower_id = ? AND followed_id = ?", currentUserID, targetUserID).First(&follow).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{"is_following": false})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_following": true})
}

// GetFollowersCount - получить количество подписчиков
func GetFollowersCount(c *gin.Context) {
	userIDStr := c.Param("userID")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var count int64
	database.DB.Model(&models.Followers{}).Where("followed_id = ?", userID).Count(&count)

	c.JSON(http.StatusOK, gin.H{"followers_count": count})
}

// GetFollowingCount - получить количество подписок
func GetFollowingCount(c *gin.Context) {
	userIDStr := c.Param("userID")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var count int64
	database.DB.Model(&models.Followers{}).Where("follower_id = ?", userID).Count(&count)

	c.JSON(http.StatusOK, gin.H{"following_count": count})
}

// GetFollowersList - получить список подписчиков
func GetFollowersList(c *gin.Context) {
	userIDStr := c.Param("userID")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var followers []struct {
		models.User
		FollowID int `json:"follow_id"`
	}

	result := database.DB.
		Table("followers").
		Select("users.*, followers.id as follow_id").
		Joins("LEFT JOIN users ON users.id = followers.follower_id").
		Where("followers.followed_id = ?", userID).
		Find(&followers)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get followers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"followers": followers})
}

// GetFollowingList - получить список подписок
func GetFollowingList(c *gin.Context) {
	userIDStr := c.Param("userID")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var following []struct {
		models.User
		FollowID int `json:"follow_id"`
	}

	result := database.DB.
		Table("followers").
		Select("users.*, followers.id as follow_id").
		Joins("LEFT JOIN users ON users.id = followers.followed_id").
		Where("followers.follower_id = ?", userID).
		Find(&following)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get following"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"following": following})
}
