// internal/handlers/comment/comment.go
package comment

import (
	"net/http"
	"strconv"
	"tourist-blog/internal/domain/models"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateComment - создание нового комментария
func CreateComment(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := int(userIDValue.(uint))

	postIDStr := c.Param("postID")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	var input struct {
		Content  string `json:"content" binding:"required"`
		ParentID *uint  `json:"parent_id"` // Опционально, для ответов на комментарии
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: content is required"})
		return
	}

	// Проверяем существование поста
	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Если указан parent_id, проверяем существование родительского комментария
	if input.ParentID != nil {
		var parentComment models.Comment
		if err := database.DB.First(&parentComment, *input.ParentID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parent comment not found"})
			return
		}
		// Проверяем, что родительский комментарий принадлежит тому же посту
		if parentComment.PostID != uint(postID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parent comment does not belong to this post"})
			return
		}
	}

	comment := models.Comment{
		PostID:   uint(postID),
		UserID:   userID,
		ParentID: input.ParentID,
		Content:  input.Content,
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
		return
	}

	// Загружаем данные пользователя для ответа
	database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, image_url")
	}).First(&comment, comment.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Comment created successfully",
		"comment": comment,
	})
}

// GetComments - получение комментариев для поста (с пагинацией)
// internal/handlers/comment/comment.go
// Обновим GetComments чтобы возвращать parent информацию
// internal/handlers/comment/comment.go
// Обновим GetComments чтобы возвращать parent информацию

// Получаем только корневые комментарии
// Получаем ВСЕ комментарии поста (и корневые, и ответы)
func GetComments(c *gin.Context) {
	postIDStr := c.Param("postID")
	postID, err := strconv.ParseUint(postIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100")) // Увеличим лимит
	offset := (page - 1) * limit

	var allComments []models.Comment
	var total int64

	// ✅ ИЗМЕНЕНИЕ: Получаем ВСЕ комментарии поста (не только корневые)
	query := database.DB.
		Where("post_id = ? AND is_approved = ?", postID, true)

	query.Model(&models.Comment{}).Count(&total)

	err = query.
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url")
		}).
		Preload("Parent", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, user_id, content")
		}).
		Preload("Parent.User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username")
		}).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&allComments).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"comments": allComments, // ✅ Теперь здесь все комментарии
		"total":    total,
		"page":     page,
		"limit":    limit,
		"has_more": int64(offset+len(allComments)) < total,
	})
}

// UpdateComment - обновление комментария
func UpdateComment(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := int(userIDValue.(uint))

	commentIDStr := c.Param("commentID")
	commentID, err := strconv.ParseUint(commentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	var input struct {
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: content is required"})
		return
	}

	// Находим комментарий и проверяем владельца
	var comment models.Comment
	if err := database.DB.First(&comment, commentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	if comment.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own comments"})
		return
	}

	// Обновляем комментарий
	updates := map[string]interface{}{
		"content":    input.Content,
		"updated_at": gorm.Expr("CURRENT_TIMESTAMP"),
	}

	if err := database.DB.Model(&comment).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Comment updated successfully",
		"comment": comment,
	})
}

// DeleteComment - удаление комментария
func DeleteComment(c *gin.Context) {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := int(userIDValue.(uint))

	commentIDStr := c.Param("commentID")
	commentID, err := strconv.ParseUint(commentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	var comment models.Comment
	if err := database.DB.First(&comment, commentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	// Проверяем владельца или права модератора
	if comment.UserID != userID {
		// Здесь можно добавить проверку на роль модератора
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own comments"})
		return
	}

	// Мягкое удаление (лучше чем физическое)
	if err := database.DB.Model(&comment).Update("is_approved", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully"})
}

// internal/handlers/comment/comment.go
// Добавляем новый хендлер для загрузки ответов

// GetCommentReplies - получение ответов на конкретный комментарий
// Получение только последнего ответа на комментарий
func GetLatestReply(c *gin.Context) {
	commentIDStr := c.Param("commentID")
	commentID, err := strconv.ParseUint(commentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	var reply models.Comment

	// Берем только последний (новейший) ответ
	err = database.DB.
		Where("parent_id = ? AND is_approved = ?", commentID, true).
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url")
		}).
		Order("created_at DESC"). // Сначала самые новые
		Limit(1).                 // Берем только один
		First(&reply).Error

	if err != nil {
		// Если ответов нет, возвращаем пустой объект
		c.JSON(http.StatusOK, gin.H{"reply": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": reply})
}

// GetCommentReplies - получение всех ответов на комментарий
func GetCommentReplies(c *gin.Context) {
	commentIDStr := c.Param("commentID")
	commentID, err := strconv.ParseUint(commentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	var replies []models.Comment

	// Получаем ВСЕ ответы на комментарий
	err = database.DB.
		Where("parent_id = ? AND is_approved = ?", commentID, true).
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, image_url")
		}).
		Order("created_at ASC"). // Сначала старые, как в YouTube
		Find(&replies).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch replies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"replies": replies,
		"total":   len(replies),
	})
}
