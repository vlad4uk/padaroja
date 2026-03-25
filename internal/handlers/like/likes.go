package like

import (
	"log"
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func LikePost(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDInterface.(int)
	if !ok {
		if userIDUint, ok := userIDInterface.(uint); ok {
			userID = int(userIDUint)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
			return
		}
	}

	postIDStr := c.Param("postID")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	var existingLike models.Like
	err = database.DB.Where("user_id = ? AND post_id = ?", userID, postID).First(&existingLike).Error

	if err == nil {
		// ИСПРАВЛЕНИЕ: Возвращаем 200 OK вместо 409 Conflict
		c.JSON(http.StatusOK, gin.H{
			"message":     "Post already liked",
			"likes_count": post.LikesCount,
		})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	tx := database.DB.Begin()

	like := models.Like{
		UserID: userID,
		PostID: postID,
	}

	if err := tx.Create(&like).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to like post"})
		return
	}

	if err := tx.Model(&models.Post{}).Where("id = ?", postID).
		Update("likes_count", gorm.Expr("likes_count + ?", 1)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update likes count"})
		return
	}

	tx.Commit()

	// Получаем обновленное количество лайков
	var updatedPost models.Post
	database.DB.Select("likes_count").First(&updatedPost, postID)

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Post liked successfully",
		"likes_count": updatedPost.LikesCount,
	})
}

func UnlikePost(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var userID int
	switch v := userIDInterface.(type) {
	case uint:
		userID = int(v)
	case int:
		userID = v
	case int64:
		userID = int(v)
	case float64:
		userID = int(v)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	postIDStr := c.Param("postID")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	log.Printf("Attempting to unlike post %d for user %d", postID, userID)

	// Начинаем транзакцию
	tx := database.DB.Begin()

	// Сначала проверяем существование лайка
	var like models.Like
	result := tx.Where("user_id = ? AND post_id = ?", userID, postID).First(&like)

	if result.Error != nil {
		tx.Rollback()
		if result.Error == gorm.ErrRecordNotFound {
			log.Printf("Like not found for post %d and user %d", postID, userID)

			// Получаем текущее количество лайков
			var post models.Post
			database.DB.Select("likes_count").First(&post, postID)

			// ИСПРАВЛЕНИЕ: возвращаем успех, если лайка нет (идемпотентность)
			c.JSON(http.StatusOK, gin.H{
				"message":     "Post already unliked",
				"likes_count": post.LikesCount,
			})
		} else {
			log.Printf("Error checking like: %v", result.Error)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Удаляем лайк
	if err := tx.Delete(&like).Error; err != nil {
		tx.Rollback()
		log.Printf("Error deleting like: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlike post"})
		return
	}

	// Обновляем счетчик лайков в посте, но не даем уйти в минус
	var post models.Post
	if err := tx.Select("likes_count").First(&post, postID).Error; err != nil {
		tx.Rollback()
		log.Printf("Error fetching post: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post"})
		return
	}

	newLikesCount := post.LikesCount - 1
	if newLikesCount < 0 {
		newLikesCount = 0
	}

	if err := tx.Model(&models.Post{}).Where("id = ?", postID).
		Update("likes_count", newLikesCount).Error; err != nil {
		tx.Rollback()
		log.Printf("Error updating likes count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update likes count"})
		return
	}

	// Подтверждаем транзакцию
	tx.Commit()

	log.Printf("Successfully unliked post %d for user %d", postID, userID)
	c.JSON(http.StatusOK, gin.H{
		"message":     "Post unliked successfully",
		"likes_count": newLikesCount,
	})
}

func GetUserLikes(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDInterface.(int)
	if !ok {
		if userIDUint, ok := userIDInterface.(uint); ok {
			userID = int(userIDUint)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
			return
		}
	}

	var likes []models.Like
	if err := database.DB.
		Where("user_id = ?", userID).
		Preload("Post").
		Preload("Post.User").
		Preload("Post.Photos").
		Preload("Post.Settlement").
		Preload("Post.Paragraphs").
		Find(&likes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch liked posts"})
		return
	}

	response := make([]gin.H, 0)
	for _, like := range likes {
		if like.Post.ID == 0 {
			continue
		}

		var tags []string
		database.DB.Table("tags").
			Joins("JOIN post_tags ON post_tags.tag_id = tags.id").
			Where("post_tags.post_id = ?", like.Post.ID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		userAvatar := ""
		userName := "Неизвестный пользователь"
		if like.Post.User.ID != 0 {
			userAvatar = like.Post.User.ImageUrl
			userName = like.Post.User.Username
		}

		response = append(response, gin.H{
			"id":          like.Post.ID,
			"user_id":     like.Post.UserID,
			"title":       like.Post.Title,
			"created_at":  like.Post.CreatedAt,
			"place_name":  like.Post.SettlementName,
			"tags":        tags,
			"photos":      like.Post.Photos,
			"likes_count": like.Post.LikesCount,
			"user_avatar": userAvatar,
			"user_name":   userName,
			"is_liked":    true,
		})
	}

	c.JSON(http.StatusOK, response)
}

func CheckLike(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDInterface.(int)
	if !ok {
		if userIDUint, ok := userIDInterface.(uint); ok {
			userID = int(userIDUint)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
			return
		}
	}

	postIDStr := c.Param("postID")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var count int64
	err = database.DB.Model(&models.Like{}).
		Where("user_id = ? AND post_id = ?", userID, postID).
		Count(&count).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_liked": count > 0})
}

func GetPostLikesCount(c *gin.Context) {
	postIDStr := c.Param("postID")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var post models.Post
	if err := database.DB.Select("likes_count").First(&post, postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get likes count"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"likes_count": post.LikesCount})
}
