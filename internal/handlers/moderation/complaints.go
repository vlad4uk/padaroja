package moderation

import (
	"fmt"
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetComplaints - получение списка жалоб для модератора (объединённые посты и комментарии)
func GetComplaints(c *gin.Context) {
	// Проверка прав модератора
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем жалобы на посты
	postComplaints := []struct {
		models.Complaint
		PostTitle      string `json:"post_title"`
		CommentContent string `json:"comment_content"`
		AuthorUsername string `json:"author"`
		ComplaintCount int    `json:"complaint_count"`
		IsApproved     bool   `json:"is_approved"`
	}{}

	postQuery := database.DB.Table("complaints").
		Select(`
			complaints.*,
			COALESCE(posts.title, '') as post_title,
			'' as comment_content,
			COALESCE(post_users.username, '') as author_username,
			COALESCE(posts.is_approved, true) as is_approved,
			(SELECT COUNT(*) FROM complaints c2 WHERE c2.post_id = complaints.post_id 
				AND c2.type = 'POST' AND c2.status IN ('NEW', 'PROCESSING')) as complaint_count
		`).
		Joins("LEFT JOIN posts ON posts.id = complaints.post_id").
		Joins("LEFT JOIN users post_users ON post_users.id = posts.user_id").
		Where("complaints.type = ? AND complaints.status IN (?, ?)",
			models.ComplaintTypePost, models.StatusNew, models.StatusProcessing)

	// Получаем жалобы на комментарии
	commentQuery := database.DB.Table("complaints").
		Select(`
			complaints.*,
			COALESCE(posts.title, '') as post_title,
			COALESCE(comments.content, '') as comment_content,
			COALESCE(comment_users.username, '') as author_username,
			COALESCE(comments.is_approved, true) as is_approved,
			(SELECT COUNT(*) FROM complaints c2 WHERE c2.comment_id = complaints.comment_id 
				AND c2.type = 'COMMENT' AND c2.status IN ('NEW', 'PROCESSING')) as complaint_count
		`).
		Joins("LEFT JOIN comments ON comments.id = complaints.comment_id").
		Joins("LEFT JOIN users comment_users ON comment_users.id = comments.user_id").
		Joins("LEFT JOIN posts ON posts.id = comments.post_id").
		Where("complaints.type = ? AND complaints.status IN (?, ?)",
			models.ComplaintTypeComment, models.StatusNew, models.StatusProcessing)

	// Объединяем результаты
	unionQuery := database.DB.Raw("? UNION ? ORDER BY created_at DESC", postQuery, commentQuery)

	if err := unionQuery.Scan(&postComplaints).Error; err != nil {
		fmt.Println("Database error fetching complaints:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch complaints"})
		return
	}

	// Форматируем результат
	var result []gin.H
	for _, complaint := range postComplaints {
		item := gin.H{
			"id":              complaint.ID,
			"type":            complaint.Type,
			"post_id":         complaint.PostID,
			"comment_id":      complaint.CommentID,
			"post_title":      complaint.PostTitle,
			"comment_content": complaint.CommentContent,
			"author":          complaint.AuthorUsername,
			"reason":          complaint.Reason,
			"status":          complaint.Status,
			"complaint_count": complaint.ComplaintCount,
			"is_approved":     complaint.IsApproved,
			"created_at":      complaint.CreatedAt.Format(time.RFC3339),
		}

		// Если это жалоба на комментарий, обрезаем контент
		if complaint.Type == models.ComplaintTypeComment {
			if len(complaint.CommentContent) > 100 {
				item["comment_content"] = complaint.CommentContent[:100] + "..."
			}
		}

		result = append(result, item)
	}

	if result == nil {
		result = []gin.H{}
	}

	c.JSON(http.StatusOK, result)
}

// CreatePostComplaint - создание жалобы на пост
func CreatePostComplaint(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	postIDStr := c.Param("postID")
	var postID uint
	if _, err := fmt.Sscanf(postIDStr, "%d", &postID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var request struct {
		Reason string `json:"reason" binding:"required,min=10,max=500"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Проверяем существование поста
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Проверяем, не оставил ли пользователь уже жалобу на этот пост
	var existingComplaint models.Complaint
	err := database.DB.Where("user_id = ? AND post_id = ? AND type = ?",
		userIDValue, postID, models.ComplaintTypePost).
		First(&existingComplaint).Error

	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You have already reported this post"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Создаем жалобу
	complaint := models.Complaint{
		UserID: userIDValue.(uint),
		Type:   models.ComplaintTypePost,
		PostID: &postID,
		Reason: request.Reason,
		Status: models.StatusNew,
	}

	if err := database.DB.Create(&complaint).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create complaint"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Complaint submitted successfully",
		"complaint": complaint,
	})
}

// CreateCommentComplaint - создание жалобы на комментарий
func CreateCommentComplaint(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	commentID := c.Param("commentID")
	var commentIDUint uint
	if _, err := fmt.Sscanf(commentID, "%d", &commentIDUint); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	var request struct {
		Reason string `json:"reason" binding:"required,min=10,max=500"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Проверяем существование комментария
	var comment models.Comment
	if err := database.DB.Preload("Post").First(&comment, commentIDUint).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Проверяем, не оставил ли пользователь уже жалобу на этот комментарий
	var existingComplaint models.Complaint
	err := database.DB.Where("user_id = ? AND comment_id = ? AND type = ?",
		userIDValue, commentIDUint, models.ComplaintTypeComment).
		First(&existingComplaint).Error

	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You have already reported this comment"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Создаем жалобу
	postID := comment.PostID
	complaint := models.Complaint{
		UserID:    userIDValue.(uint),
		Type:      models.ComplaintTypeComment,
		CommentID: &commentIDUint,
		PostID:    &postID, // Связываем с постом для удобства
		Reason:    request.Reason,
		Status:    models.StatusNew,
	}

	if err := database.DB.Create(&complaint).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create complaint"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Complaint submitted successfully",
		"complaint": complaint,
	})
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

	// Если жалоба решена или отклонена, можно выполнить дополнительные действия
	if request.Status == models.StatusResolved {
		// Здесь можно автоматически скрыть контент, если нужно
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Complaint status updated",
		"complaint": complaint,
	})
}

// TogglePostVisibility - изменение видимости поста
func TogglePostVisibility(c *gin.Context) {
	postID := c.Param("postID")

	var request struct {
		IsApproved bool `json:"is_approved"`
	}

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
		// Обновляем статус всех активных жалоб на этот пост
		database.DB.Model(&models.Complaint{}).
			Where("post_id = ? AND status IN (?, ?)", postID, models.StatusNew, models.StatusProcessing).
			Update("status", models.StatusResolved)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Post successfully " + action,
		"post":    post,
	})
}

// ToggleCommentVisibility - изменение видимости комментария
func ToggleCommentVisibility(c *gin.Context) {
	commentID := c.Param("commentID")

	var request struct {
		IsApproved bool `json:"is_approved"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var comment models.Comment
	if err := database.DB.Where("id = ?", commentID).First(&comment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	// Обновляем видимость комментария
	if err := database.DB.Model(&comment).Update("is_approved", request.IsApproved).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment visibility"})
		return
	}

	action := "shown"
	if !request.IsApproved {
		action = "hidden"
		// Обновляем статус всех активных жалоб на этот комментарий
		database.DB.Model(&models.Complaint{}).
			Where("comment_id = ? AND status IN (?, ?)", commentID, models.StatusNew, models.StatusProcessing).
			Update("status", models.StatusResolved)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Comment successfully " + action,
		"comment": comment,
	})
}

// GetPostComplaints - получение всех жалоб на конкретный пост
func GetPostComplaints(c *gin.Context) {
	postID := c.Param("postID")

	var complaints []models.Complaint
	if err := database.DB.
		Where("post_id = ? AND type = ?", postID, models.ComplaintTypePost).
		Order("created_at DESC").
		Find(&complaints).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post complaints"})
		return
	}

	c.JSON(http.StatusOK, complaints)
}

// GetCommentComplaints - получение всех жалоб на конкретный комментарий
func GetCommentComplaints(c *gin.Context) {
	commentID := c.Param("commentID")

	var complaints []models.Complaint
	if err := database.DB.
		Where("comment_id = ? AND type = ?", commentID, models.ComplaintTypeComment).
		Order("created_at DESC").
		Find(&complaints).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comment complaints"})
		return
	}

	c.JSON(http.StatusOK, complaints)
}

// SearchUsers - поиск пользователей по имени или email
func SearchUsers(c *gin.Context) {
	// Проверка прав
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

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
	searchPattern := "%" + strings.TrimSpace(query) + "%"

	err := database.DB.Select("id", "username", "email", "role_id", "is_blocked").
		Where("username ILIKE ? OR email ILIKE ?", searchPattern, searchPattern).
		Where("id != ?", currentUserID). // Не показываем текущего пользователя
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
		// Подсчитываем жалобы пользователя
		var totalComplaints int64
		database.DB.Model(&models.Complaint{}).
			Joins("LEFT JOIN posts ON posts.id = complaints.post_id").
			Joins("LEFT JOIN comments ON comments.id = complaints.comment_id").
			Where("(posts.user_id = ? OR comments.user_id = ?)", user.ID, user.ID).
			Count(&totalComplaints)

		result = append(result, gin.H{
			"id":               user.ID,
			"username":         user.Username,
			"email":            user.Email,
			"role_id":          user.RoleID,
			"is_blocked":       user.Is_blocked,
			"total_complaints": totalComplaints,
		})
	}

	c.JSON(http.StatusOK, result)
}

// AssignModeratorRole - назначение роли модератора
func AssignModeratorRole(c *gin.Context) {
	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Проверка прав текущего пользователя
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Нельзя изменить роль самому себе
	if targetUserID == currentUserID {
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

	// Назначаем роль модератора
	if err := database.DB.Model(&targetUser).Update("role_id", 2).Error; err != nil {
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

// RemoveModeratorRole - снятие роли модератора
func RemoveModeratorRole(c *gin.Context) {
	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Проверка прав текущего пользователя
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Нельзя изменить роль самому себе
	if targetUserID == currentUserID {
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

	// Возвращаем обычную роль пользователя
	if err := database.DB.Model(&targetUser).Update("role_id", 1).Error; err != nil {
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

// GetUsersWithComplaints - получение списка пользователей с жалобами
// GetUsersWithComplaints - получение списка пользователей с жалобами
func GetUsersWithComplaints(c *gin.Context) {
	// Проверка прав
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем пользователей с жалобами
	usersWithComplaints := []gin.H{} // ИСПРАВЛЕНИЕ 1: Сразу инициализируем пустым массивом

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
        LEFT JOIN comments cm ON u.id = cm.user_id
        LEFT JOIN complaints c ON (
            (c.post_id = p.id AND c.type = 'POST') OR 
            (c.comment_id = cm.id AND c.type = 'COMMENT')
        )
        GROUP BY u.id, u.username, u.email, u.role_id, u.is_blocked
        HAVING COUNT(DISTINCT c.id) > 0
        ORDER BY total_complaints DESC, last_complaint_date DESC
    `).Rows()

	if err != nil {
		fmt.Println("Database error fetching users with complaints:", err)
		c.JSON(http.StatusOK, usersWithComplaints) // ИСПРАВЛЕНИЕ 2: Возвращаем пустой массив при ошибке
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID uint
		var username, email string
		var roleID int
		var isBlocked bool
		var totalComplaints, activeComplaints, resolvedComplaints, rejectedComplaints *int // ИСПРАВЛЕНИЕ 3: указатели для NULL значений
		var lastComplaintDate *time.Time

		err := rows.Scan(&userID, &username, &email, &roleID, &isBlocked,
			&totalComplaints, &activeComplaints, &resolvedComplaints, &rejectedComplaints,
			&lastComplaintDate)

		if err != nil {
			fmt.Println("Error scanning row:", err)
			continue
		}

		// ИСПРАВЛЕНИЕ 4: Обработка NULL значений
		total := 0
		if totalComplaints != nil {
			total = *totalComplaints
		}

		active := 0
		if activeComplaints != nil {
			active = *activeComplaints
		}

		resolved := 0
		if resolvedComplaints != nil {
			resolved = *resolvedComplaints
		}

		rejected := 0
		if rejectedComplaints != nil {
			rejected = *rejectedComplaints
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
			"total_complaints":    total,
			"active_complaints":   active,
			"resolved_complaints": resolved,
			"rejected_complaints": rejected,
			"last_complaint_date": lastComplaintStr,
		})
	}

	// ИСПРАВЛЕНИЕ 5: Убираем проверку на nil, так как мы уже инициализировали массив
	c.JSON(http.StatusOK, usersWithComplaints)
}

// BlockUser - блокировка пользователя
func BlockUser(c *gin.Context) {
	// Проверка прав
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем ID пользователя для блокировки
	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Нельзя заблокировать самого себя
	if targetUserID == currentUserID {
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
	// Проверка прав
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return
	}

	if currentUser.RoleID != 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Moderator rights required."})
		return
	}

	// Получаем ID пользователя для разблокировки
	userIDStr := c.Param("userID")
	var targetUserID uint
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
