// internal/handlers/profile/growing_users.go
package profile

import (
	"net/http"
	database "padaroja/internal/storage/postgres"
	"time"

	"github.com/gin-gonic/gin"
)

type SearchUserResponse struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	Avatar      string `json:"avatar"`
	GrowthScore int    `json:"growth_score"`
}

func SearchUsers(c *gin.Context) {
	limit := 5 // Топ-5 пользователей

	sinceDate := time.Now().AddDate(0, 0, -7) // За последнюю неделю

	var users []SearchUserResponse

	// SQL запрос для получения топ-5 растущих пользователей
	sqlQuery := `
        SELECT 
            u.id,
            u.username,
            u.image_url as avatar,
            (
                COALESCE((
                    SELECT COUNT(*) FROM followers f 
                    WHERE f.followed_id = u.id 
                    AND f.created_at > $1
                ), 0) +
                COALESCE((
                    SELECT COUNT(*) FROM posts p 
                    WHERE p.user_id = u.id 
                    AND p.created_at > $1
                ), 0) +
                COALESCE((
                    SELECT COUNT(*) FROM likes l 
                    INNER JOIN posts p ON p.id = l.post_id 
                    WHERE p.user_id = u.id 
                    AND l.created_at > $1
                ), 0)
            ) as growth_score
        FROM users u
        WHERE u.is_blocked = false
        AND (
            COALESCE((
                SELECT COUNT(*) FROM followers f 
                WHERE f.followed_id = u.id 
                AND f.created_at > $1
            ), 0) > 0
            OR COALESCE((
                SELECT COUNT(*) FROM posts p 
                WHERE p.user_id = u.id 
                AND p.created_at > $1
            ), 0) > 0
            OR COALESCE((
                SELECT COUNT(*) FROM likes l 
                INNER JOIN posts p ON p.id = l.post_id 
                WHERE p.user_id = u.id 
                AND l.created_at > $1
            ), 0) > 0
        )
        ORDER BY growth_score DESC
        LIMIT $2
    `

	err := database.DB.Raw(sqlQuery, sinceDate, limit).Scan(&users).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
	})
}
