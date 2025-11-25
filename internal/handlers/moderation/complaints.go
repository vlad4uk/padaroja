package moderation

import (
	"net/http"
	"tourist-blog/internal/domain/models"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
)

// GetComplaints - получение списка жалоб для модератора
func GetComplaints(c *gin.Context) {
	var complaints []struct {
		models.Complaint
		PostTitle      string `json:"post_title"`
		Author         string `json:"author"`
		ComplaintCount int    `json:"complaint_count"`
		IsApproved     bool   `json:"is_approved"`
	}

	// Получаем жалобы с информацией о посте и авторе
	err := database.DB.Table("complaints").
		Select("complaints.*, posts.title as post_title, users.username as author, "+
			"(SELECT COUNT(*) FROM complaints c2 WHERE c2.post_id = complaints.post_id AND c2.status = 'NEW') as complaint_count, "+
			"posts.is_approved as is_approved").
		Joins("LEFT JOIN posts ON posts.id = complaints.post_id").
		Joins("LEFT JOIN users ON users.id = posts.user_id").
		Where("complaints.status IN (?, ?)", models.StatusNew, models.StatusProcessing).
		Order("complaints.created_at DESC").
		Find(&complaints).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch complaints"})
		return
	}

	c.JSON(http.StatusOK, complaints)
}

// UpdateComplaintStatus - обновление статуса жалобы
func UpdateComplaintStatus(c *gin.Context) {
	complaintID := c.Param("complaintID")

	var request struct {
		Status models.ComplaintStatus `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Валидация статуса
	validStatuses := map[models.ComplaintStatus]bool{
		models.StatusNew:        true,
		models.StatusProcessing: true,
		models.StatusResolved:   true,
		models.StatusRejected:   true,
	}

	if !validStatuses[request.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	var complaint models.Complaint
	if err := database.DB.Where("id = ?", complaintID).First(&complaint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Complaint not found"})
		return
	}

	// Обновляем статус жалобы
	if err := database.DB.Model(&complaint).Update("status", request.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update complaint"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Complaint status updated",
		"complaint": complaint,
	})
}

// internal/handlers/moderation/complaints.go

func TogglePostVisibility(c *gin.Context) {
	postID := c.Param("postID")

	var request struct {
		IsApproved bool `json:"is_approved"`
	}

	// Убираем binding:required, так как мы можем получать и true и false
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	var post models.Post
	if err := database.DB.Where("id = ?", postID).First(&post).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Обновляем видимость поста
	if err := database.DB.Model(&post).Update("is_approved", request.IsApproved).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update post visibility"})
		return
	}

	action := "shown"
	if !request.IsApproved {
		action = "hidden"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Post successfully " + action,
		"post":    post,
	})
}

// GetPostComplaints - получение всех жалоб на конкретный пост
func GetPostComplaints(c *gin.Context) {
	postID := c.Param("postID")

	var complaints []models.Complaint
	if err := database.DB.Where("post_id = ?", postID).Order("created_at DESC").Find(&complaints).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post complaints"})
		return
	}

	c.JSON(http.StatusOK, complaints)
}
