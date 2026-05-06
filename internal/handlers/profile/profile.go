package profile

import (
	"fmt"
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetCurrentUserProfile(c *gin.Context) {

	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal error: User ID not found."})
		return
	}

	userID := int(userIDValue.(uint))

	var user models.User

	err := database.DB.Select("id, username, bio, image_url, role_id").First(&user, userID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
			return
		}
		fmt.Println("GORM Error fetching user profile:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user profile."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":        user.ID,
		"username":  user.Username,
		"bio":       user.Bio,
		"image_url": user.ImageUrl,
		"role_id":   user.RoleID,
	})
}

func UpdateUserProfile(c *gin.Context) {

	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal error: User ID not found."})
		return
	}
	userID := int(userIDValue.(uint))

	var currentUser models.User
	if err := database.DB.First(&currentUser, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	updates := make(map[string]interface{})
	hasUpdate := false

	newUsername, usernameOk := c.GetPostForm("username")
	if usernameOk && newUsername != currentUser.Username {
		if len(newUsername) < 3 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 3 characters long."})
			return
		}

		var existingUser models.User
		err := database.DB.Where("username = ?", newUsername).First(&existingUser).Error

		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Username is already taken"})
			return
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking username uniqueness."})
			return
		}

		updates["username"] = newUsername
		hasUpdate = true
	}

	if bio, bioOk := c.GetPostForm("bio"); bioOk {
		if bio != currentUser.Bio {
			if len(bio) > 150 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Bio cannot exceed 150 characters."})
				return
			}
			updates["bio"] = bio
			hasUpdate = true
		}
	}

	if imageUrl, imageUrlOk := c.GetPostForm("image_url"); imageUrlOk {
		if imageUrl != currentUser.ImageUrl {
			updates["image_url"] = imageUrl
			hasUpdate = true
		}
	}

	if !hasUpdate {
		c.JSON(http.StatusOK, gin.H{"message": "No changes detected to update."})
		return
	}

	err := database.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error
	if err != nil {
		fmt.Println("GORM Error updating profile:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile."})
		return
	}

	var updatedUser models.User
	database.DB.Select("id, username, bio, image_url, role_id").First(&updatedUser, userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully!",
		"user": gin.H{
			"id":        updatedUser.ID,
			"username":  updatedUser.Username,
			"bio":       updatedUser.Bio,
			"image_url": updatedUser.ImageUrl,
			"role_id":   updatedUser.RoleID,
		},
	})
}

func GetUserProfileByID(c *gin.Context) {
	userIDStr := c.Param("userID")

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var user models.User
	result := database.DB.Select("id", "username", "bio", "image_url", "role_id").
		Where("id = ?", userID).
		First(&user)

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":        user.ID,
		"username":  user.Username,
		"bio":       user.Bio,
		"image_url": user.ImageUrl,
		"role_id":   user.RoleID,
	})
}

// SearchUsersForInvite - поиск пользователей для приглашения в соавторы
func SearchUsersForInvite(c *gin.Context) {
	query := c.Query("q")
	if len(query) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query too short, minimum 2 characters"})
		return
	}

	currentUserIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	currentUserID := int(currentUserIDValue.(uint))

	var users []struct {
		ID          int    `json:"id"`
		Username    string `json:"username"`
		ImageUrl    string `json:"image_url"`
		IsFollowed  bool   `json:"is_followed"`
	}

	// Ищем среди всех пользователей, исключая текущего
	// С сортировкой: сначала подписчики, потом остальные
	err := database.DB.Table("users").
		Select(`users.id, users.username, users.image_url,
				CASE 
					WHEN EXISTS (SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = users.id) THEN true 
					ELSE false 
				END as is_followed`,
			currentUserID).
		Where("users.id != ?", currentUserID).
		Where("users.username ILIKE ?", "%"+query+"%").
		Order("is_followed DESC, users.username ASC").
		Limit(15).
		Scan(&users).Error

	if err != nil {
		fmt.Println("Database error searching users for invite:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	// Форматируем ответ
	results := make([]gin.H, 0)
	for _, u := range users {
		results = append(results, gin.H{
			"id":          u.ID,
			"username":    u.Username,
			"image_url":   u.ImageUrl,
			"is_followed": u.IsFollowed,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"count":   len(results),
	})
}