// internal/handlers/admin/admin.go
package admin

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

// GetDashboardStats - получение статистики для дашборда
func GetDashboardStats(c *gin.Context) {
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

	// Проверка прав администратора (role_id = 3)
	if currentUser.RoleID != 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Получаем общее количество пользователей
	var totalUsers int64
	database.DB.Model(&models.User{}).Count(&totalUsers)

	// Новые пользователи за неделю
	var newUsersThisWeek int64
	weekAgo := time.Now().AddDate(0, 0, -7)
	database.DB.Model(&models.User{}).Where("created_at >= ?", weekAgo).Count(&newUsersThisWeek)

	// Общее количество постов
	var totalPosts int64
	database.DB.Model(&models.Post{}).Count(&totalPosts)

	// Новые посты за неделю
	var newPostsThisWeek int64
	database.DB.Model(&models.Post{}).Where("created_at >= ?", weekAgo).Count(&newPostsThisWeek)

	// Количество модераторов (role_id = 2)
	var totalModerators int64
	database.DB.Model(&models.User{}).Where("role_id = ?", 2).Count(&totalModerators)

	// Количество администраторов (role_id = 3)
	var totalAdmins int64
	database.DB.Model(&models.User{}).Where("role_id = ?", 3).Count(&totalAdmins)

	// Вычисляем процент роста пользователей
	var usersLastWeek int64
	twoWeeksAgo := time.Now().AddDate(0, 0, -14)
	database.DB.Model(&models.User{}).Where("created_at >= ? AND created_at < ?", twoWeeksAgo, weekAgo).Count(&usersLastWeek)

	usersGrowthPercent := 0.0
	if usersLastWeek > 0 {
		usersGrowthPercent = float64(newUsersThisWeek-usersLastWeek) / float64(usersLastWeek) * 100
	}

	// Процент роста постов
	var postsLastWeek int64
	database.DB.Model(&models.Post{}).Where("created_at >= ? AND created_at < ?", twoWeeksAgo, weekAgo).Count(&postsLastWeek)

	postsGrowthPercent := 0.0
	if postsLastWeek > 0 {
		postsGrowthPercent = float64(newPostsThisWeek-postsLastWeek) / float64(postsLastWeek) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"total_users":          totalUsers,
		"new_users_this_week":  newUsersThisWeek,
		"users_growth_percent": int(usersGrowthPercent),
		"total_posts":          totalPosts,
		"new_posts_this_week":  newPostsThisWeek,
		"posts_growth_percent": int(postsGrowthPercent),
		"total_moderators":     totalModerators,
		"total_admins":         totalAdmins,
	})
}

// GetAllUsers - получение всех пользователей
func GetAllUsers(c *gin.Context) {
	if !checkAdminRights(c) {
		return
	}

	var users []models.User
	err := database.DB.Select("id, username, email, role_id, is_blocked, created_at, image_url").
		Order("created_at DESC").
		Find(&users).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// GetModerators - получение списка модераторов с историей назначений
// GetModerators - получение списка модераторов (упрощенная версия)
func GetModerators(c *gin.Context) {
	// Проверяем права администратора
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

	// Проверяем, что пользователь - администратор (role_id = 3)
	if currentUser.RoleID != 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return
	}

	// Получаем всех пользователей с ролью модератора (role_id = 2)
	var moderators []models.User
	err := database.DB.Where("role_id = ?", 2).Find(&moderators).Error

	if err != nil {
		fmt.Printf("Error fetching moderators: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch moderators"})
		return
	}

	// Формируем ответ
	type ModeratorInfo struct {
		ID        int    `json:"id"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		RoleID    int    `json:"role_id"`
		IsBlocked bool   `json:"is_blocked"`
	}

	result := make([]ModeratorInfo, 0)
	for _, moderator := range moderators {
		result = append(result, ModeratorInfo{
			ID:        moderator.ID,
			Username:  moderator.Username,
			Email:     moderator.Email,
			RoleID:    moderator.RoleID,
			IsBlocked: moderator.Is_blocked,
		})
	}

	c.JSON(http.StatusOK, result)
}

// SearchUsersForAdmin - поиск пользователей для администратора
func SearchUsersForAdmin(c *gin.Context) {
	if !checkAdminRights(c) {
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	var users []models.User
	searchPattern := "%" + strings.TrimSpace(query) + "%"

	err := database.DB.Select("id, username, email, role_id, is_blocked, image_url").
		Where("username ILIKE ? OR email ILIKE ?", searchPattern, searchPattern).
		Limit(20).
		Find(&users).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// AssignModeratorByAdmin - назначение модератора админом
func AssignModeratorByAdmin(c *gin.Context) {
	if !checkAdminRights(c) {
		return
	}

	adminID := getUserID(c)
	if adminID == 0 {
		return
	}

	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if targetUser.Is_blocked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot assign moderator role to blocked user"})
		return
	}

	if targetUser.RoleID == 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already a moderator"})
		return
	}

	if targetUser.RoleID == 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change admin role"})
		return
	}

	// Начинаем транзакцию
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Обновляем роль пользователя
		if err := tx.Model(&targetUser).Update("role_id", 2).Error; err != nil {
			return err
		}

		// Логируем назначение
		assignment := models.ModeratorAssignment{
			UserID:            int(targetUserID),
			AssignedByAdminID: int(adminID),
			Action:            "assign",
			AssignedAt:        time.Now(),
		}
		if err := tx.Create(&assignment).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
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

// RemoveModeratorByAdmin - снятие модератора админом
func RemoveModeratorByAdmin(c *gin.Context) {
	if !checkAdminRights(c) {
		return
	}

	adminID := getUserID(c)
	if adminID == 0 {
		return
	}

	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if targetUser.RoleID != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not a moderator"})
		return
	}

	// Начинаем транзакцию
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Обновляем роль пользователя на обычного пользователя (role_id = 1)
		if err := tx.Model(&targetUser).Update("role_id", 1).Error; err != nil {
			return err
		}

		// Логируем снятие
		assignment := models.ModeratorAssignment{
			UserID:            int(targetUserID),
			AssignedByAdminID: int(adminID),
			Action:            "revoke",
			AssignedAt:        time.Now(),
		}
		if err := tx.Create(&assignment).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
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

// BlockUserByAdmin - блокировка пользователя админом
func BlockUserByAdmin(c *gin.Context) {
	if !checkAdminRights(c) {
		return
	}

	adminID := getUserID(c)
	if adminID == 0 {
		return
	}

	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if targetUserID == adminID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot block yourself"})
		return
	}

	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if targetUser.RoleID == 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot block another admin"})
		return
	}

	if targetUser.Is_blocked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already blocked"})
		return
	}

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

// UnblockUserByAdmin - разблокировка пользователя админом
func UnblockUserByAdmin(c *gin.Context) {
	if !checkAdminRights(c) {
		return
	}

	userIDStr := c.Param("userID")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var targetUser models.User
	if err := database.DB.First(&targetUser, targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if !targetUser.Is_blocked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not blocked"})
		return
	}

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

// Вспомогательные функции

// В функции checkAdminRights измените:
// В admin.go
func checkAdminRights(c *gin.Context) bool {
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return false
	}

	currentUserID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return false
	}

	var currentUser models.User
	if err := database.DB.First(&currentUser, currentUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
		return false
	}

	// Только администраторы (role_id=3)
	if currentUser.RoleID != 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. Admin rights required."})
		return false
	}

	return true
}

func getUserID(c *gin.Context) uint {
	userIDValue, exists := c.Get("userID")
	if !exists {
		return 0
	}
	userID, ok := userIDValue.(uint)
	if !ok {
		return 0
	}
	return userID
}
