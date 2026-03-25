package auth

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var JwtSecret []byte

func InitJWTSecret() error {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return errors.New("JWT_SECRET not set in environment variables")
	}
	JwtSecret = []byte(secret)
	return nil
}

func GenerateJWT(userID uint) (string, error) {
	if len(JwtSecret) == 0 {
		if err := InitJWTSecret(); err != nil {
			return "", err
		}
	}

	expiryHoursStr := os.Getenv("JWT_EXPIRY_HOURS")
	expiryHours := 24
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

func ValidateJWT(tokenString string) (uint, error) {

	if len(JwtSecret) == 0 {
		if err := InitJWTSecret(); err != nil {
			return 0, err
		}
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {

		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
		}
		return JwtSecret, nil
	})

	if err != nil {
		return 0, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {

		if userIDFloat, ok := claims["user_id"].(float64); ok {
			return uint(userIDFloat), nil
		}
		return 0, errors.New("Invalid user ID format in token claims")
	}

	return 0, errors.New("Invalid or expired token")
}
