package favourite

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func AddToFavourites(c *gin.Context) {
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

	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	var existingFavourite models.Favourite
	err = database.DB.Where("user_id = ? AND post_id = ?", userID, postID).First(&existingFavourite).Error

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Post already in favourites"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	favourite := models.Favourite{
		UserID: userID,
		PostID: postID,
	}

	if err := database.DB.Create(&favourite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to favourites"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Post added to favourites"})
}

func RemoveFromFavourites(c *gin.Context) {
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

	result := database.DB.Where("user_id = ? AND post_id = ?", userID, postID).Delete(&models.Favourite{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from favourites"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Favourite not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post removed from favourites"})
}

func GetFavourites(c *gin.Context) {
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

	var favourites []models.Favourite
	if err := database.DB.
		Where("user_id = ?", userID).
		Preload("Post").
		Preload("Post.User").
		Preload("Post.Photos").
		Preload("Post.Place").
		Preload("Post.Paragraphs").
		Find(&favourites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch favourites"})
		return
	}

	response := make([]gin.H, 0)
	for _, fav := range favourites {
		if fav.Post.ID == 0 {
			continue
		}

		var tags []string
		database.DB.Table("tags").
			Joins("JOIN place_tags ON place_tags.tag_id = tags.id").
			Where("place_tags.place_id = ?", fav.Post.PlaceID).
			Pluck("tags.name", &tags)

		if tags == nil {
			tags = []string{}
		}

		userAvatar := ""
		userName := "Неизвестный пользователь"
		if fav.Post.User.ID != 0 {
			userAvatar = fav.Post.User.ImageUrl
			userName = fav.Post.User.Username
		}

		response = append(response, gin.H{
			"id":           fav.Post.ID,
			"user_id":      fav.Post.UserID,
			"title":        fav.Post.Title,
			"created_at":   fav.Post.CreatedAt,
			"place_name":   fav.Post.Place.Name,
			"tags":         tags,
			"photos":       fav.Post.Photos,
			"likes_count":  fav.Post.LikesCount,
			"user_avatar":  userAvatar,
			"user_name":    userName,
			"is_favourite": true,
		})
	}

	c.JSON(http.StatusOK, response)
}

func CheckFavourite(c *gin.Context) {
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

	var favourite models.Favourite
	err = database.DB.Where("user_id = ? AND post_id = ?", userID, postID).First(&favourite).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{"is_favourite": false})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_favourite": true})
}

func CheckMultipleFavourites(c *gin.Context) {
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

	postIDsParam := c.Query("post_ids")
	if postIDsParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_ids parameter is required"})
		return
	}

	var postIDs []int
	postIDStrs := strings.Split(postIDsParam, ",")
	for _, idStr := range postIDStrs {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID in list"})
			return
		}
		postIDs = append(postIDs, id)
	}

	if len(postIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	var favouritePostIDs []int
	if err := database.DB.
		Model(&models.Favourite{}).
		Where("user_id = ? AND post_id IN (?)", userID, postIDs).
		Pluck("post_id", &favouritePostIDs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check favourites"})
		return
	}

	favouriteMap := make(map[int]bool)
	for _, postID := range postIDs {
		favouriteMap[postID] = false
	}

	for _, postID := range favouritePostIDs {
		favouriteMap[postID] = true
	}

	c.JSON(http.StatusOK, favouriteMap)
}
