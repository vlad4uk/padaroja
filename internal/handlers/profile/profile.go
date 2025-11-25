package profile

import (
	"fmt"
	"net/http"
	"strconv"
	"tourist-blog/internal/domain/models"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetCurrentUserProfile - Извлекает полную информацию о профиле авторизованного пользователя.
// Ответ содержит id, username, bio и image_url.
func GetCurrentUserProfile(c *gin.Context) { // ✅ ПЕРЕИМЕНОВАНО
	// 1. Получение UserID из контекста Gin
	userIDValue, exists := c.Get("userID")
	if !exists {
		// Этого не должно случиться после успешной авторизации
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal error: User ID not found."})
		return
	}

	// Приведение типа userID (из middleware: uint -> int для GORM)
	userID := int(userIDValue.(uint))

	// 2. Поиск пользователя в базе данных

	var user models.User

	// !!! ВАЖНО: Выбираем все поля, необходимые для AuthContext

	err := database.DB.Select("id, username, bio, image_url, role_id").First(&user, userID).Error // ✅ ДОБАВЛЕН role_id
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
			return
		}
		fmt.Println("GORM Error fetching user profile:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user profile."})
		return
	}

	// 3. Возвращаем данные в формате, который ожидает React
	c.JSON(http.StatusOK, gin.H{
		"id":        user.ID,
		"username":  user.Username,
		"bio":       user.Bio,
		"image_url": user.ImageUrl,
		"role_id":   user.RoleID, // ✅ ИСПРАВЛЕНО: role_id вместо roleId
	})
}

// UpdateUserProfile - Обновляет профиль пользователя: username, bio, и image_url из Firebase.
func UpdateUserProfile(c *gin.Context) {
	// 1. Получение UserID
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal error: User ID not found."})
		return
	}
	userID := int(userIDValue.(uint))

	// 2. Находим текущего пользователя для сравнения
	var currentUser models.User
	if err := database.DB.First(&currentUser, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 3. Создаем карту обновлений и флаг для отслеживания изменений
	updates := make(map[string]interface{})
	hasUpdate := false

	// 4. Обработка Username
	newUsername, usernameOk := c.GetPostForm("username")
	if usernameOk && newUsername != currentUser.Username {
		if len(newUsername) < 3 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 3 characters long."})
			return
		}

		// Проверка уникальности
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

	// 5. Обработка Bio (текст)
	if bio, bioOk := c.GetPostForm("bio"); bioOk {
		if bio != currentUser.Bio {
			// Ограничение на стороне сервера (до 150 символов)
			if len(bio) > 150 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Bio cannot exceed 150 characters."})
				return
			}
			updates["bio"] = bio
			hasUpdate = true
		}
	}

	// 6. Обработка Image URL (из Firebase)
	// React отправляет полный URL, который нужно сохранить как строку
	if imageUrl, imageUrlOk := c.GetPostForm("image_url"); imageUrlOk {
		if imageUrl != currentUser.ImageUrl {
			updates["image_url"] = imageUrl
			hasUpdate = true
		}
	}

	// 7. Проверка наличия обновлений
	if !hasUpdate {
		c.JSON(http.StatusOK, gin.H{"message": "No changes detected to update."})
		return
	}

	// 8. Обновление базы данных
	err := database.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error
	if err != nil {
		fmt.Println("GORM Error updating profile:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile."})
		return
	}

	// 9. Возвращаем обновленные данные
	var updatedUser models.User
	database.DB.Select("id, username, bio, image_url, role_id").First(&updatedUser, userID) // ✅ ДОБАВЛЕН role_id

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully!",
		// Отдаем обновленный объект пользователя для React-контекста
		"user": gin.H{
			"id":        updatedUser.ID,
			"username":  updatedUser.Username,
			"bio":       updatedUser.Bio,
			"image_url": updatedUser.ImageUrl,
			"role_id":   updatedUser.RoleID, // ✅ ДОБАВЛЕНО
		},
	})
}

// GetUserProfileByID - Получает профиль любого пользователя по ID ✅ ПЕРЕИМЕНОВАНО
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
