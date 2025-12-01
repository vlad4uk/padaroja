package places

import (
	"fmt"
	"net/http"
	"tourist-blog/internal/domain/models"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
)

type CreatePlaceRequest struct {
	Name      string  `json:"name" binding:"required"`
	Desc      string  `json:"desc"`
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
}

// CreatePlace - Создание нового места
func CreatePlace(c *gin.Context) {
	var input CreatePlaceRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid input: %v", err.Error())})
		return
	}

	// Создаем место
	place := models.Place{
		Name:      input.Name,
		Desc:      input.Desc,
		Latitude:  input.Latitude,
		Longitude: input.Longitude,
	}

	if err := database.DB.Create(&place).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create place"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Place created successfully",
		"place": gin.H{
			"id":        place.ID,
			"name":      place.Name,
			"desc":      place.Desc,
			"latitude":  place.Latitude,
			"longitude": place.Longitude,
		},
	})
}

// GetPlaces - Получение списка мест
func GetPlaces(c *gin.Context) {
	var places []models.Place
	result := database.DB.Find(&places)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch places"})
		return
	}

	c.JSON(http.StatusOK, places)
}
