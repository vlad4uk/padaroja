package post

import (
	"encoding/json"
	"log"
	"net/http"
	"padaroja/internal/domain/models"
	"padaroja/internal/sse"
	database "padaroja/internal/storage/postgres"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetCollaborators(c *gin.Context) {
	postID, err := strconv.ParseUint(c.Param("postID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	// Получаем владельца поста
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	var collaborators []models.PostCollaborator
	err = database.DB.
		Preload("User").
		Where("post_id = ?", postID).
		Find(&collaborators).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch collaborators"})
		return
	}

	// Форматируем ответ для фронтенда
	result := make([]gin.H, 0)
	for _, collab := range collaborators {
		result = append(result, gin.H{
			"id":        collab.ID,
			"user_id":   collab.UserID,
			"username":  collab.User.Username,
			"avatar":    collab.User.ImageUrl,
			"role":      collab.Role,
			"joined_at": collab.JoinedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"post_title":    post.Title,
		"collaborators": result,
		"count":         len(result),
	})
}

func RemoveCollaborator(c *gin.Context) {
	currentUserID, _ := c.Get("userID")
	currentID := int(currentUserID.(uint))

	postID, err := strconv.ParseUint(c.Param("postID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	collaboratorID, err := strconv.Atoi(c.Param("userID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Проверяем, что текущий пользователь - владелец поста
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	if post.UserID != currentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only post owner can remove collaborators"})
		return
	}

	// Удаляем соавтора
	result := database.DB.Where("post_id = ? AND user_id = ?", postID, collaboratorID).Delete(&models.PostCollaborator{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove collaborator"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Collaborator removed"})
}

// Улучшенная функция AcceptInvite с уведомлением автору
func AcceptInvite(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentID int
	switch v := userIDVal.(type) {
	case uint:
		currentID = int(v)
	case int:
		currentID = v
	case float64:
		currentID = int(v)
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID type"})
		return
	}

	inviteID, err := strconv.ParseUint(c.Param("inviteID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite ID"})
		return
	}

	var invite models.CollaborationInvite
	if err := database.DB.Preload("Post").Preload("Inviter").First(&invite, inviteID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
		return
	}

	// Проверяем, что приглашение адресовано текущему пользователю
	if invite.InviteeID != currentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "This invite is not for you"})
		return
	}

	if invite.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invite already " + invite.Status})
		return
	}

	// Получаем информацию о пользователе, который принимает приглашение
	var invitee models.User
	if err := database.DB.First(&invitee, currentID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Обновляем статус приглашения
		now := time.Now()
		if err := tx.Model(&invite).Updates(map[string]interface{}{
			"status":       "accepted",
			"responded_at": &now,
		}).Error; err != nil {
			return err
		}

		// Добавляем пользователя как соавтора
		collaborator := models.PostCollaborator{
			PostID:   invite.PostID,
			UserID:   invite.InviteeID,
			Role:     invite.Role,
			JoinedAt: now,
		}
		if err := tx.Create(&collaborator).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		log.Printf("Ошибка при принятии приглашения: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept invite", "details": err.Error()})
		return
	}

	// Отправляем уведомление автору приглашения через SSE
	go func() {
		notification := map[string]interface{}{
			"type": "INVITE_RESPONSE",
			"data": map[string]interface{}{
				"invite_id":    invite.ID,
				"post_id":      invite.PostID,
				"post_title":   invite.Post.Title,
				"status":       "accepted",
				"user_id":      invitee.ID,
				"username":     invitee.Username,
				"user_avatar":  invitee.ImageUrl,
				"role":         invite.Role,
				"responded_at": time.Now(),
			},
		}

		data, _ := json.Marshal(notification)

		if sse.GlobalHub != nil {
			// Отправляем уведомление автору приглашения (InviterID)
			sse.GlobalHub.BroadcastUser <- sse.UserMessage{
				UserID: invite.InviterID,
				Data:   data,
			}
			log.Printf("📢 Уведомление об ACCEPT отправлено пользователю %d", invite.InviterID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Invite accepted"})
}

// Улучшенная функция DeclineInvite с уведомлением автору
func DeclineInvite(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentID int
	switch v := userIDVal.(type) {
	case uint:
		currentID = int(v)
	case int:
		currentID = v
	case float64:
		currentID = int(v)
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID type"})
		return
	}

	inviteID, err := strconv.ParseUint(c.Param("inviteID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite ID"})
		return
	}

	var invite models.CollaborationInvite
	if err := database.DB.Preload("Post").Preload("Inviter").First(&invite, inviteID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
		return
	}

	if invite.InviteeID != currentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "This invite is not for you"})
		return
	}

	if invite.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invite already " + invite.Status})
		return
	}

	// Получаем информацию о пользователе, который отклоняет приглашение
	var invitee models.User
	if err := database.DB.First(&invitee, currentID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&invite).Updates(map[string]interface{}{
		"status":       "declined",
		"responded_at": &now,
	}).Error; err != nil {
		log.Printf("Ошибка при отклонении приглашения: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decline invite", "details": err.Error()})
		return
	}

	// Отправляем уведомление автору приглашения через SSE
	go func() {
		notification := map[string]interface{}{
			"type": "INVITE_RESPONSE",
			"data": map[string]interface{}{
				"invite_id":    invite.ID,
				"post_id":      invite.PostID,
				"post_title":   invite.Post.Title,
				"status":       "declined",
				"user_id":      invitee.ID,
				"username":     invitee.Username,
				"user_avatar":  invitee.ImageUrl,
				"responded_at": time.Now(),
			},
		}

		data, _ := json.Marshal(notification)

		if sse.GlobalHub != nil {
			// Отправляем уведомление автору приглашения (InviterID)
			sse.GlobalHub.BroadcastUser <- sse.UserMessage{
				UserID: invite.InviterID,
				Data:   data,
			}
			log.Printf("📢 Уведомление об DECLINE отправлено пользователю %d", invite.InviterID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Invite declined"})
}

func GetPendingInvites(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentID int
	switch v := userIDVal.(type) {
	case uint:
		currentID = int(v)
	case int:
		currentID = v
	case float64:
		currentID = int(v)
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID type"})
		return
	}

	var invites []models.CollaborationInvite
	err := database.DB.
		Preload("Post").
		Preload("Post.Photos", func(db *gorm.DB) *gorm.DB {
			return db.Order("\"order\" ASC")
		}).
		Preload("Post.Paragraphs", func(db *gorm.DB) *gorm.DB {
			return db.Order("paragraphs.order ASC")
		}).
		Preload("Inviter").
		Where("invitee_id = ? AND status = ?", currentID, "pending").
		Order("invited_at DESC").
		Find(&invites).Error

	if err != nil {
		log.Printf("Ошибка получения приглашений: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invites"})
		return
	}

	// Форматируем ответ с превью поста
	result := make([]gin.H, 0)
	for _, inv := range invites {
		// Получаем первый параграф для превью текста
		var previewText string
		if len(inv.Post.Paragraphs) > 0 {
			previewText = inv.Post.Paragraphs[0].Content
			if len(previewText) > 200 {
				previewText = previewText[:200] + "..."
			}
		}

		// Получаем первую фотографию для превью
		var previewPhoto string
		if len(inv.Post.Photos) > 0 {
			previewPhoto = inv.Post.Photos[0].Url
		}

		result = append(result, gin.H{
			"id":         inv.ID,
			"post_id":    inv.PostID,
			"post_title": inv.Post.Title,
			"post_preview": gin.H{
				"text":            previewText,
				"photo":           previewPhoto,
				"created_at":      inv.Post.CreatedAt,
				"settlement_name": inv.Post.SettlementName,
			},
			"inviter_id":     inv.InviterID,
			"inviter_name":   inv.Inviter.Username,
			"inviter_avatar": inv.Inviter.ImageUrl,
			"role":           inv.Role,
			"invited_at":     inv.InvitedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"invites": result,
		"count":   len(result),
	})
}

type InviteCollaboratorRequest struct {
	UserID int    `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"oneof=editor viewer"`
}

func InviteCollaborator(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	currentID := int(userID)

	postID, err := strconv.ParseUint(c.Param("postID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var input InviteCollaboratorRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем, что пост существует и текущий пользователь - владелец
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	if post.UserID != currentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only post owner can invite collaborators"})
		return
	}

	// Проверяем, что приглашаемый существует
	var invitee models.User
	if err := database.DB.First(&invitee, input.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Нельзя пригласить самого себя
	if input.UserID == currentID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot invite yourself"})
		return
	}

	// Проверяем, не является ли уже соавтором
	var existingCollab models.PostCollaborator
	err = database.DB.Where("post_id = ? AND user_id = ?", postID, input.UserID).First(&existingCollab).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a collaborator"})
		return
	}

	// Проверяем, нет ли уже ожидающего приглашения
	var existingInvite models.CollaborationInvite
	err = database.DB.Where("post_id = ? AND invitee_id = ? AND status = ?",
		postID, input.UserID, "pending").First(&existingInvite).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Invite already sent and pending"})
		return
	}

	// Создаём новое приглашение
	invite := models.CollaborationInvite{
		PostID:    uint(postID),
		InviterID: currentID,
		InviteeID: input.UserID,
		Role:      input.Role,
		Status:    "pending",
		InvitedAt: time.Now(),
	}

	if err := database.DB.Create(&invite).Error; err != nil {
		log.Printf("Ошибка создания приглашения: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":   "Invite sent successfully",
		"invite_id": invite.ID,
	})
}

func LeaveCollaboration(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	currentID := int(userID)

	postID, err := strconv.ParseUint(c.Param("postID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	// Проверяем, что пост существует
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Владелец не может выйти, только удалить пост
	if post.UserID == currentID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Owner cannot leave the post. Only delete it."})
		return
	}

	// Удаляем соавтора
	result := database.DB.Where("post_id = ? AND user_id = ?", postID, currentID).Delete(&models.PostCollaborator{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave post"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "You are not a collaborator of this post"})
		return
	}

	// Проверяем, остались ли ещё соавторы
	var count int64
	database.DB.Model(&models.PostCollaborator{}).Where("post_id = ?", postID).Count(&count)

	if count == 0 {
		database.DB.Model(&models.Post{}).Where("id = ?", postID).Update("is_collaborative", false)
	}

	c.JSON(http.StatusOK, gin.H{"message": "You have left the post"})
}

// В internal/handlers/post/collaborators.go
func CheckCollaboratorStatus(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	currentID := int(userID)

	postID, err := strconv.ParseUint(c.Param("postID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	// Проверяем, является ли пользователь владельцем
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	if post.UserID == currentID {
		c.JSON(http.StatusOK, gin.H{
			"is_collaborator": false,
			"is_owner":        true,
			"role":            nil,
		})
		return
	}

	// Проверяем, является ли соавтором
	var collaborator models.PostCollaborator
	err = database.DB.Where("post_id = ? AND user_id = ?", postID, currentID).First(&collaborator).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"is_collaborator": false,
			"is_owner":        false,
			"role":            nil,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"is_collaborator": true,
		"is_owner":        false,
		"role":            collaborator.Role,
	})
}

// post.go - добавьте новую функцию
func GetPendingInvitesCount(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentID int
	switch v := userIDVal.(type) {
	case uint:
		currentID = int(v)
	case int:
		currentID = v
	case float64:
		currentID = int(v)
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID type"})
		return
	}

	var count int64
	if err := database.DB.Model(&models.CollaborationInvite{}).
		Where("invitee_id = ? AND status = ?", currentID, "pending").
		Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count invites"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}

func GetSentInvites(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var currentID int
	switch v := userIDVal.(type) {
	case uint:
		currentID = int(v)
	case int:
		currentID = v
	case float64:
		currentID = int(v)
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID type"})
		return
	}

	var invites []models.CollaborationInvite
	err := database.DB.
		Preload("Post").
		Preload("Invitee").
		Where("inviter_id = ?", currentID).
		Order("invited_at DESC").
		Find(&invites).Error

	if err != nil {
		log.Printf("Ошибка получения отправленных приглашений: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sent invites"})
		return
	}

	result := make([]gin.H, 0)
	for _, inv := range invites {
		result = append(result, gin.H{
			"id":             inv.ID,
			"post_id":        inv.PostID,
			"post_title":     inv.Post.Title,
			"invitee_id":     inv.InviteeID,
			"invitee_name":   inv.Invitee.Username,
			"invitee_avatar": inv.Invitee.ImageUrl,
			"role":           inv.Role,
			"status":         inv.Status,
			"invited_at":     inv.InvitedAt,
			"responded_at":   inv.RespondedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"invites": result,
		"count":   len(result),
	})
}
