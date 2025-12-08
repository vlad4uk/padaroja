package moderation

import (
	"fmt"
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

// ✅ НОВЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ МОДЕРАТОРАМИ

// SearchUsers - поиск пользователей по имени или email
func SearchUsers(c *gin.Context) {
	// Проверяем, что пользователь - админ (role_id = 2)
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Получаем текущего пользователя
	var currentUser models.User
	if err := database.DB.First(&currentUser, userIDValue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	// Проверяем, что пользователь - модератор/админ
	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Получаем поисковый запрос
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	// Поиск пользователей
	var users []models.User
	searchPattern := "%" + query + "%"

	err := database.DB.Select("id", "username", "email", "role_id", "is_blocked").
		Where("username ILIKE ? OR email ILIKE ?", searchPattern, searchPattern).
		Limit(20).
		Find(&users).Error

	if err != nil {
		fmt.Println("Database error searching users:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Формируем ответ
	var result []gin.H
	for _, user := range users {
		result = append(result, gin.H{
			"id":         user.ID,
			"username":   user.Username,
			"email":      user.Email,
			"role_id":    user.RoleID,
			"is_blocked": user.Is_blocked,
		})
	}

	c.JSON(http.StatusOK, result)
}

// AssignModeratorRole - назначение роли модератора пользователю
func AssignModeratorRole(c *gin.Context) {
	// Проверяем, что пользователь - админ
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, userIDValue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	// Только админы могут назначать модераторов
	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Получаем ID пользователя, которому назначаем роль
	userIDStr := c.Param("userID")
	var targetUserID int
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Нельзя изменить роль самому себе
	if targetUserID == int(currentUser.ID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change your own role"})
		return
	}

	// Находим пользователя
	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Проверяем, не заблокирован ли пользователь
	if targetUser.Is_blocked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot assign moderator role to blocked user"})
		return
	}

	// Проверяем, не является ли уже модератором
	if targetUser.RoleID == 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already a moderator"})
		return
	}

	// Назначаем роль модератора (role_id = 2)
	if err := database.DB.Model(&targetUser).Update("role_id", 2).Error; err != nil {
		fmt.Println("Error updating user role:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign moderator role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Moderator role assigned successfully",
		"user": gin.H{
			"id":       targetUser.ID,
			"username": targetUser.Username,
			"role_id":  2,
		},
	})
}

// internal/handlers/moderation/moderation.go (дополнить)

// RemoveModeratorRole - снятие роли модератора с пользователя
func RemoveModeratorRole(c *gin.Context) {
	// Проверяем, что пользователь - админ
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, userIDValue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	// Только админы могут снимать модераторов
	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Получаем ID пользователя
	userIDStr := c.Param("userID")
	var targetUserID int
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Нельзя изменить роль самому себе
	if targetUserID == int(currentUser.ID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change your own role"})
		return
	}

	// Находим пользователя
	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Проверяем, является ли модератором
	if targetUser.RoleID != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not a moderator"})
		return
	}

	// Возвращаем обычную роль пользователя (role_id = 1)
	if err := database.DB.Model(&targetUser).Update("role_id", 1).Error; err != nil {
		fmt.Println("Error updating user role:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove moderator role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Moderator role removed successfully",
		"user": gin.H{
			"id":       targetUser.ID,
			"username": targetUser.Username,
			"role_id":  1,
		},
	})
}

// internal/handlers/moderation/moderation.go (исправленная функция GetUsersWithComplaints)

// GetUsersWithComplaints - получение списка пользователей с жалобами
func GetUsersWithComplaints(c *gin.Context) {
	// Проверяем, что пользователь - модератор/админ
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, userIDValue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем пользователей с жалобами
	var usersWithComplaints []gin.H

	// Находим всех пользователей, у которых есть жалобы на их посты
	rows, err := database.DB.Raw(`
        SELECT 
            u.id,
            u.username,
            u.email,
            u.role_id,
            u.is_blocked,
            COUNT(DISTINCT c.id) as total_complaints,
            SUM(CASE WHEN c.status IN ('NEW', 'PROCESSING') THEN 1 ELSE 0 END) as active_complaints,
            SUM(CASE WHEN c.status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_complaints,
            SUM(CASE WHEN c.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_complaints,
            MAX(c.created_at) as last_complaint_date
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        LEFT JOIN complaints c ON p.id = c.post_id
        WHERE c.id IS NOT NULL
        GROUP BY u.id, u.username, u.email, u.role_id, u.is_blocked
        HAVING COUNT(DISTINCT c.id) > 0
        ORDER BY total_complaints DESC, last_complaint_date DESC
    `).Rows()

	if err != nil {
		fmt.Println("Database error fetching users with complaints:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users with complaints"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID int
		var username, email string
		var roleID int
		var isBlocked bool
		var totalComplaints, activeComplaints, resolvedComplaints, rejectedComplaints int
		var lastComplaintDate *time.Time

		err := rows.Scan(&userID, &username, &email, &roleID, &isBlocked,
			&totalComplaints, &activeComplaints, &resolvedComplaints, &rejectedComplaints,
			&lastComplaintDate)

		if err != nil {
			fmt.Println("Error scanning row:", err)
			continue
		}

		var lastComplaintStr string
		if lastComplaintDate != nil {
			lastComplaintStr = lastComplaintDate.Format(time.RFC3339)
		}

		usersWithComplaints = append(usersWithComplaints, gin.H{
			"id":                  userID,
			"username":            username,
			"email":               email,
			"role_id":             roleID,
			"is_blocked":          isBlocked,
			"total_complaints":    totalComplaints,
			"active_complaints":   activeComplaints,
			"resolved_complaints": resolvedComplaints,
			"rejected_complaints": rejectedComplaints,
			"last_complaint_date": lastComplaintStr,
		})
	}

	if usersWithComplaints == nil {
		usersWithComplaints = []gin.H{} // Пустой массив вместо nil
	}

	c.JSON(http.StatusOK, usersWithComplaints)
}

// BlockUser - блокировка пользователя
func BlockUser(c *gin.Context) {
	// Проверяем, что пользователь - модератор/админ
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, userIDValue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем ID пользователя для блокировки
	userIDStr := c.Param("userID")
	var targetUserID int
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Нельзя заблокировать самого себя
	if targetUserID == int(currentUser.ID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot block yourself"})
		return
	}

	// Находим пользователя
	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Нельзя заблокировать другого модератора/админа
	if targetUser.RoleID == 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot block another moderator/admin"})
		return
	}

	// Проверяем, не заблокирован ли уже
	if targetUser.Is_blocked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already blocked"})
		return
	}

	// Блокируем пользователя
	if err := database.DB.Model(&targetUser).Update("is_blocked", true).Error; err != nil {
		fmt.Println("Error blocking user:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to block user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User blocked successfully",
		"user": gin.H{
			"id":         targetUser.ID,
			"username":   targetUser.Username,
			"is_blocked": true,
		},
	})
}

// UnblockUser - разблокировка пользователя
func UnblockUser(c *gin.Context) {
	// Проверяем, что пользователь - модератор/админ
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, userIDValue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем ID пользователя для разблокировки
	userIDStr := c.Param("userID")
	var targetUserID int
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Находим пользователя
	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Проверяем, не разблокирован ли уже
	if !targetUser.Is_blocked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not blocked"})
		return
	}

	// Разблокируем пользователя
	if err := database.DB.Model(&targetUser).Update("is_blocked", false).Error; err != nil {
		fmt.Println("Error unblocking user:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unblock user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User unblocked successfully",
		"user": gin.H{
			"id":         targetUser.ID,
			"username":   targetUser.Username,
			"is_blocked": false,
		},
	})
}
