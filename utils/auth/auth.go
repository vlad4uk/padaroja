package auth

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWT секрет из переменных окружения
var JwtSecret []byte

// Инициализация JWT секрета
func InitJWTSecret() error {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return errors.New("JWT_SECRET not set in environment variables")
	}
	JwtSecret = []byte(secret)
	return nil
}

func GenerateJWT(userID uint) (string, error) {
	// Проверяем инициализацию секрета
	if len(JwtSecret) == 0 {
		if err := InitJWTSecret(); err != nil {
			return "", err
		}
	}

	// Получаем время жизни токена из .env (по умолчанию 24 часа)
	expiryHoursStr := os.Getenv("JWT_EXPIRY_HOURS")
	expiryHours := 24 // значение по умолчанию

	if expiryHoursStr != "" {
		if hours, err := strconv.Atoi(expiryHoursStr); err == nil && hours > 0 {
			expiryHours = hours
		}
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * time.Duration(expiryHours)).Unix(),
		"iat":     time.Now().Unix(),
		"iss":     "tourist-blog",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	t, err := token.SignedString(JwtSecret)
	return t, err
}

// Валидация JWT и получение ID пользователя
func ValidateJWT(tokenString string) (uint, error) {
	// Проверяем инициализацию секрета
	if len(JwtSecret) == 0 {
		if err := InitJWTSecret(); err != nil {
			return 0, err
		}
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Проверка метода подписи
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
		}
		return JwtSecret, nil
	})

	if err != nil {
		return 0, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Проверка существования и типа "user_id"
		if userIDFloat, ok := claims["user_id"].(float64); ok {
			return uint(userIDFloat), nil
		}
		return 0, errors.New("Invalid user ID format in token claims")
	}

	return 0, errors.New("Invalid or expired token")
}
