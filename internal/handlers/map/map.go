package maps

import (
	"net/http"
	"strconv"
	"tourist-blog/internal/domain/models"
	reviews "tourist-blog/internal/handlers/reviews"
	dto "tourist-blog/internal/handlers/reviews/dto"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
)

// GetUserMapData - Получение всех данных пользователя для карты (отзывы + посты)
func GetUserMapData(c *gin.Context) {
	userID, exists := reviews.GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Получаем отзывы пользователя
	var userReviews []models.Review
	reviewResult := database.DB.
		Where("user_id = ?", userID).
		Preload("Place").
		Preload("User").
		Find(&userReviews)

	if reviewResult.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user reviews"})
		return
	}

	// Формируем ответ для отзывов
	reviewsResponse := make([]dto.MapReviewResponse, len(userReviews))
	for i, rev := range userReviews {
		reviewsResponse[i] = dto.MapReviewResponse{
			ID:         rev.ID,
			UserID:     rev.UserID,
			PlaceID:    rev.PlaceID,
			Rating:     rev.Rating,
			Content:    rev.Content,
			CreatedAt:  rev.CreatedAt,
			PlaceName:  rev.Place.Name,
			Latitude:   rev.Place.Latitude,
			Longitude:  rev.Place.Longitude,
			UserName:   rev.User.Username,
			UserAvatar: rev.User.ImageUrl,
		}
	}

	// Получаем посты пользователя
	var userPosts []models.Post
	postResult := database.DB.
		Where("user_id = ?", userID).
		Preload("Place").
		Preload("Photos").
		Find(&userPosts)

	if postResult.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	// Формируем ответ для постов
	postsResponse := make([]dto.MapPostResponse, len(userPosts))
	for i, p := range userPosts {
		// Берем URLs первых фотографий
		photoURLs := make([]string, 0)
		for _, photo := range p.Photos {
			if len(photoURLs) < 3 { // Максимум 3 фото для превью
				photoURLs = append(photoURLs, photo.Url)
			}
		}

		postsResponse[i] = dto.MapPostResponse{
			ID:         p.ID,
			Title:      p.Title,
			PlaceID:    p.PlaceID,
			PlaceName:  p.Place.Name,
			Latitude:   p.Place.Latitude,
			Longitude:  p.Place.Longitude,
			CreatedAt:  p.CreatedAt,
			Photos:     photoURLs,
			LikesCount: p.LikesCount,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"reviews": reviewsResponse,
		"posts":   postsResponse,
	})
}

// GetPlaceDetails - Получение детальной информации о месте (все отзывы и посты)
func GetPlaceDetails(c *gin.Context) {
	placeIDStr := c.Param("placeID")
	placeID, err := strconv.ParseUint(placeIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid place ID"})
		return
	}

	// Получаем информацию о месте
	var place models.Place
	if err := database.DB.First(&place, placeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Place not found"})
		return
	}

	// Получаем публичные отзывы о месте
	var reviews []models.Review
	reviewResult := database.DB.
		Where("place_id = ? AND is_public = ?", placeID, true).
		Preload("User").
		Order("created_at DESC").
		Find(&reviews)

	if reviewResult.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviews"})
		return
	}

	// Получаем посты связанные с этим местом
	var posts []models.Post
	postResult := database.DB.
		Where("place_id = ?", placeID).
		Preload("User").
		Preload("Photos").
		Order("created_at DESC").
		Find(&posts)

	if postResult.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	// Формируем ответы
	reviewsResponse := make([]dto.ReviewResponse, len(reviews))
	for i, rev := range reviews {
		reviewsResponse[i] = dto.ReviewResponse{
			ID:         rev.ID,
			UserID:     rev.UserID,
			PlaceID:    rev.PlaceID,
			Rating:     rev.Rating,
			Content:    rev.Content,
			IsPublic:   rev.IsPublic,
			CreatedAt:  rev.CreatedAt,
			UserName:   rev.User.Username,
			UserAvatar: rev.User.ImageUrl,
			PlaceName:  place.Name,
		}
	}

	postsResponse := make([]dto.MapPostResponse, len(posts))
	for i, p := range posts {
		photoURLs := make([]string, 0)
		for _, photo := range p.Photos {
			if len(photoURLs) < 3 {
				photoURLs = append(photoURLs, photo.Url)
			}
		}

		postsResponse[i] = dto.MapPostResponse{
			ID:         p.ID,
			Title:      p.Title,
			PlaceID:    p.PlaceID,
			PlaceName:  place.Name,
			Latitude:   place.Latitude,
			Longitude:  place.Longitude,
			CreatedAt:  p.CreatedAt,
			Photos:     photoURLs,
			LikesCount: p.LikesCount,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"place":   place,
		"reviews": reviewsResponse,
		"posts":   postsResponse,
	})
}
