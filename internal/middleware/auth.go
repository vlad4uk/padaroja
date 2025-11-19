package middleware

import (
	"fmt"
	"net/http"
	utils "tourist-blog/utils/auth" // Используем пакет с ValidateJWT

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("jwt")

		if err != nil {
			// Логируем, если куки не найдены (хотя вы сказали, что они есть)
			fmt.Println("AuthMiddleware: Cookie 'jwt' не найден:", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: No token provided."})
			c.Abort()
			return
		}

		// Логируем, какой токен мы пытаемся валидировать
		fmt.Println("AuthMiddleware: Найдена кука, валидируем токен:", tokenString)

		userID, err := utils.ValidateJWT(tokenString)

		if err != nil {
			// Логируем, почему ValidateJWT вернул ошибку
			fmt.Println("AuthMiddleware: Ошибка валидации токена:", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid or expired token."})
			c.Abort()
			return
		}

		// 3. Сохранение UserID в контексте
		c.Set("userID", userID)

		c.Next()
	}
}
