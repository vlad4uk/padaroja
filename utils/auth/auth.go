package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TODO!!! Перенести этот ключ в переменные окружения
var JwtSecret = []byte("bcnd3mfu4roej7snbc3hry2tpyi1djet")

func GenerateJWT(userID uint) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	t, err := token.SignedString(JwtSecret)
	return t, err
}

// 💡 НОВАЯ ФУНКЦИЯ: Валидация JWT и получение ID пользователя
func ValidateJWT(tokenString string) (uint, error) {
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
			// JWT декодирует числа как float64, поэтому приводим к uint
			return uint(userIDFloat), nil
		}
		return 0, errors.New("Invalid user ID format in token claims")
	}

	return 0, errors.New("Invalid or expired token")
}
