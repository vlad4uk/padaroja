package reviews

import (
	"fmt"
	"net/http"
	"padaroja/internal/domain/models"
	dto "padaroja/internal/handlers/reviews/dto"
	database "padaroja/internal/storage/postgres"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetUserIDFromContext(c *gin.Context) (uint, bool) {
	val, exists := c.Get("userID")
	if !exists {
		return 0, false
	}

	var userID uint
	switch v := val.(type) {
	case uint:
		userID = v
	case int:
		if v > 0 {
			userID = uint(v)
		}
	case int64:
		if v > 0 {
			userID = uint(v)
		}
	case float64:
		if v > 0 {
			userID = uint(v)
		}
	default:
		return 0, false
	}

	if userID == 0 {
		return 0, false
	}

	return userID, true
}

func CreateReview(c *gin.Context) {
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input dto.CreateReviewRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid input: %v", err.Error())})
		return
	}

	var place models.Place
	if err := database.DB.First(&place, input.PlaceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Place not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	var existingReview models.Review
	err := database.DB.Where("user_id = ? AND place_id = ?", userID, input.PlaceID).First(&existingReview).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "You have already reviewed this place"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	review := models.Review{
		UserID:   int(userID),
		PlaceID:  input.PlaceID,
		Rating:   input.Rating,
		Content:  input.Content,
		IsPublic: input.IsPublic,
	}

	if err := database.DB.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Review created successfully",
		"review": gin.H{
			"id":       review.ID,
			"place_id": review.PlaceID,
		},
	})
}

func GetUserReviews(c *gin.Context) {
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var reviews []models.Review
	result := database.DB.
		Where("user_id = ?", userID).
		Preload("Place").
		Preload("User").
		Order("created_at DESC").
		Find(&reviews)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
		return
	}

	response := make([]dto.ReviewResponse, len(reviews))
	for i, review := range reviews {
		response[i] = dto.ReviewResponse{
			ID:         review.ID,
			UserID:     review.UserID,
			PlaceID:    review.PlaceID,
			Rating:     review.Rating,
			Content:    review.Content,
			IsPublic:   review.IsPublic,
			CreatedAt:  review.CreatedAt,
			UserName:   review.User.Username,
			UserAvatar: review.User.ImageUrl,
			PlaceName:  review.Place.Name,
		}
	}

	c.JSON(http.StatusOK, response)
}

func UpdateReview(c *gin.Context) {
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	reviewID := c.Param("reviewID")

	var input dto.UpdateReviewRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid input: %v", err.Error())})
		return
	}

	var review models.Review
	if err := database.DB.Where("id = ? AND user_id = ?", reviewID, userID).First(&review).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Review not found or access denied"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	updates := make(map[string]interface{})
	if input.Rating != 0 {
		updates["rating"] = input.Rating
	}
	if input.Content != "" {
		updates["content"] = input.Content
	}
	if input.IsPublic != nil {
		updates["is_public"] = *input.IsPublic
	}

	if err := database.DB.Model(&review).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update review"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Review updated successfully"})
}

func DeleteReview(c *gin.Context) {
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	reviewID := c.Param("reviewID")

	var review models.Review
	if err := database.DB.Where("id = ? AND user_id = ?", reviewID, userID).First(&review).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Review not found or access denied"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	if err := database.DB.Delete(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete review"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Review deleted successfully"})
}

func GetPlaceReviews(c *gin.Context) {
	placeIDStr := c.Param("placeID")
	placeID, err := strconv.ParseUint(placeIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid place ID"})
		return
	}

	var reviews []models.Review
	result := database.DB.
		Where("place_id = ? AND is_public = ?", placeID, true).
		Preload("User").
		Order("created_at DESC").
		Find(&reviews)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
		return
	}

	response := make([]dto.ReviewResponse, len(reviews))
	for i, review := range reviews {
		response[i] = dto.ReviewResponse{
			ID:         review.ID,
			UserID:     review.UserID,
			PlaceID:    review.PlaceID,
			Rating:     review.Rating,
			Content:    review.Content,
			IsPublic:   review.IsPublic,
			CreatedAt:  review.CreatedAt,
			UserName:   review.User.Username,
			UserAvatar: review.User.ImageUrl,
			PlaceName:  "",
		}
	}

	c.JSON(http.StatusOK, response)
}

func CreateReviewWithPlace(c *gin.Context) {
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		PlaceData struct {
			Name      string  `json:"name" binding:"required"`
			Desc      string  `json:"desc"`
			Latitude  float64 `json:"latitude" binding:"required"`
			Longitude float64 `json:"longitude" binding:"required"`
		} `json:"place_data" binding:"required"`

		ReviewData struct {
			Rating   int    `json:"rating" binding:"required,min=1,max=5"`
			Content  string `json:"content" binding:"max=1000"`
			IsPublic bool   `json:"is_public"`
		} `json:"review_data" binding:"required"`

		PostID *uint `json:"post_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid input: %v", err.Error())})
		return
	}

	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	place := models.Place{
		Name:      input.PlaceData.Name,
		Desc:      input.PlaceData.Desc,
		Latitude:  input.PlaceData.Latitude,
		Longitude: input.PlaceData.Longitude,
	}

	if err := tx.Create(&place).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create place"})
		return
	}

	review := models.Review{
		UserID:   int(userID),
		PlaceID:  place.ID,
		Rating:   input.ReviewData.Rating,
		Content:  input.ReviewData.Content,
		IsPublic: input.ReviewData.IsPublic,
	}

	if err := tx.Create(&review).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	if input.PostID != nil {
		var post models.Post
		if err := tx.Where("id = ? AND user_id = ?", *input.PostID, userID).First(&post).Error; err != nil {
			tx.Rollback()
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Post not found or unauthorized"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			}
			return
		}

		if err := tx.Model(&post).Update("place_id", place.ID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to attach post to place"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Place and review created successfully",
		"data": gin.H{
			"place": gin.H{
				"id":   place.ID,
				"name": place.Name,
			},
			"review": gin.H{
				"id": review.ID,
			},
			"post_attached": input.PostID != nil,
		},
	})
}
