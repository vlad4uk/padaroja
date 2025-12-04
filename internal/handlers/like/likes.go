package like

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// LikePost - добавление лайка к посту
func LikePost(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем userID к правильному типу
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

	// Проверяем, существует ли пост
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Проверяем, не лайкнул ли уже пользователь этот пост
	var existingLike models.Like
	err = database.DB.Where("user_id = ? AND post_id = ?", userID, postID).First(&existingLike).Error

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Post already liked"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Используем транзакцию для атомарности
	tx := database.DB.Begin()

	// Создаем новую запись лайка
	like := models.Like{
		UserID: userID,
		PostID: postID,
	}

	if err := tx.Create(&like).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to like post"})
		return
	}

	// Обновляем счетчик лайков в посте
	if err := tx.Model(&models.Post{}).Where("id = ?", postID).
		Update("likes_count", gorm.Expr("likes_count + ?", 1)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update likes count"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{"message": "Post liked successfully"})
}

// UnlikePost - удаление лайка
func UnlikePost(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем userID к правильному типу
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

	// Используем транзакцию для атомарности
	tx := database.DB.Begin()

	result := tx.Where("user_id = ? AND post_id = ?", userID, postID).Delete(&models.Like{})
	if result.Error != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlike post"})
		return
	}

	if result.RowsAffected == 0 {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Like not found"})
		return
	}

	// Обновляем счетчик лайков в посте (не даем уйти в минус)
	if err := tx.Model(&models.Post{}).Where("id = ? AND likes_count > 0", postID).
		Update("likes_count", gorm.Expr("likes_count - ?", 1)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update likes count"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Post unliked successfully"})
}

// GetUserLikes - получение постов, которые лайкнул пользователь
func GetUserLikes(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем userID к правильному типу
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
		Preload("Post.Place").
		Preload("Post.Paragraphs").
		Find(&likes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch liked posts"})
		return
	}

	// Преобразуем в формат, аналогичный PostResponse
	response := make([]gin.H, 0)
	for _, like := range likes {
		if like.Post.ID == 0 {
			continue // Пропускаем если пост не загружен
		}

		// Получаем теги для поста
		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", like.Post.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		// Получаем данные пользователя
		userAvatar := ""
		userName := "Неизвестный пользователь"
		if like.Post.User.ID != 0 {
			userAvatar = like.Post.User.ImageUrl
			userName = like.Post.User.Username
		}

		// Используем сохраненное количество лайков из поста
		response = append(response, gin.H{
			"id":          like.Post.ID,
			"user_id":     like.Post.UserID,
			"title":       like.Post.Title,
			"created_at":  like.Post.CreatedAt,
			"place_name":  like.Post.Place.Name,
			"tags":        tags,
			"photos":      like.Post.Photos,
			"likes_count": like.Post.LikesCount, // Используем сохраненное значение
			"user_avatar": userAvatar,
			"user_name":   userName,
			"is_liked":    true, // Помечаем как лайкнутый
		})
	}

	c.JSON(http.StatusOK, response)
}

// CheckLike - проверка, лайкнул ли пользователь пост
func CheckLike(c *gin.Context) {
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем userID к правильному типу
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

	var like models.Like
	err = database.DB.Where("user_id = ? AND post_id = ?", userID, postID).First(&like).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{"is_liked": false})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_liked": true})
}

// GetPostLikesCount - получение количества лайков для поста
func GetPostLikesCount(c *gin.Context) {
	postIDStr := c.Param("postID")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	// Получаем пост с сохраненным количеством лайков
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
