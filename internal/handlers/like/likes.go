package like

import (
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
		c.JSON(http.StatusConflict, gin.H{"error": "Post already liked"})
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

	c.JSON(http.StatusCreated, gin.H{"message": "Post liked successfully"})
}

func UnlikePost(c *gin.Context) {
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

	if err := tx.Model(&models.Post{}).Where("id = ? AND likes_count > 0", postID).
		Update("likes_count", gorm.Expr("likes_count - ?", 1)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update likes count"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Post unliked successfully"})
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
		Preload("Post.Place").
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
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", like.Post.PlaceID).
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
			"place_name":  like.Post.Place.Name,
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
