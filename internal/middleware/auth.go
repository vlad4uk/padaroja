package middleware

import (
	"fmt"
	"net/http"
	utils "padaroja/utils/auth"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("jwt")

		if err != nil {
			fmt.Println("AuthMiddleware: Cookie 'jwt' не найден:", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: No token provided."})
			c.Abort()
			return
		}

		fmt.Println("AuthMiddleware: Найдена кука, валидируем токен:", tokenString)

		userID, err := utils.ValidateJWT(tokenString)

		if err != nil {
			fmt.Println("AuthMiddleware: Ошибка валидации токена:", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid or expired token."})
			c.Abort()
			return
		}

		c.Set("userID", userID)
		c.Next()
	}
}

// OptionalAuthMiddleware - для публичных маршрутов (гость или авторизованный)
func OptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("jwt")

		// Если токен есть и он валиден, устанавливаем userID
		if err == nil && tokenString != "" {
			userID, err := utils.ValidateJWT(tokenString)
			if err == nil {
				c.Set("userID", userID)
			}
		}

		// Если токена нет или он невалиден - продолжаем как гость
		c.Next()
	}
}
