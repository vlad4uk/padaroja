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

// Вспомогательная функция для получения userID из контекста
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

// CreateReview - Создание отзыва о месте
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

	// Проверяем существование места
	var place models.Place
	if err := database.DB.First(&place, input.PlaceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Place not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Проверяем, не оставлял ли пользователь уже отзыв на это место
	var existingReview models.Review
	err := database.DB.Where("user_id = ? AND place_id = ?", userID, input.PlaceID).First(&existingReview).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "You have already reviewed this place"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Создаем отзыв
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
		"review":  review.ID,
	})
}

// GetUserReviews - Получение всех отзывов пользователя
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

// UpdateReview - Обновление отзыва
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

	// Находим отзыв и проверяем владельца
	var review models.Review
	if err := database.DB.Where("id = ? AND user_id = ?", reviewID, userID).First(&review).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Review not found or access denied"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Обновляем поля
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

// DeleteReview - Удаление отзыва
func DeleteReview(c *gin.Context) {
	userID, exists := GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	reviewID := c.Param("reviewID")

	// Находим отзыв и проверяем владельца
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

// GetPlaceReviews - Получение отзывов о конкретном месте
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
			PlaceName:  "", // Можно добавить если нужно
		}
	}

	c.JSON(http.StatusOK, response)
}
