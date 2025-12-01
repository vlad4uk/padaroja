package dto

import "time"

// CreateReviewRequest - DTO для создания отзыва
type CreateReviewRequest struct {
	PlaceID  uint   `json:"place_id" binding:"required"`
	Rating   int    `json:"rating" binding:"required,min=1,max=5"`
	Content  string `json:"content" binding:"max=1000"`
	IsPublic bool   `json:"is_public"`
}

// UpdateReviewRequest - DTO для обновления отзыва
type UpdateReviewRequest struct {
	Rating   int    `json:"rating" binding:"min=1,max=5"`
	Content  string `json:"content" binding:"max=1000"`
	IsPublic *bool  `json:"is_public"`
}

// ReviewResponse - DTO для ответа с отзывом
type ReviewResponse struct {
	ID        string    `json:"id"`
	UserID    int       `json:"user_id"`
	PlaceID   uint      `json:"place_id"`
	Rating    int       `json:"rating"`
	Content   string    `json:"content"`
	IsPublic  bool      `json:"is_public"`
	CreatedAt time.Time `json:"created_at"`

	// Дополнительные поля для удобства
	UserName   string `json:"user_name"`
	UserAvatar string `json:"user_avatar"`
	PlaceName  string `json:"place_name"`
}

// MapReviewResponse - DTO для отображения на карте
type MapReviewResponse struct {
	ID        string    `json:"id"`
	UserID    int       `json:"user_id"`
	PlaceID   uint      `json:"place_id"`
	Rating    int       `json:"rating"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`

	// Данные места для карты
	PlaceName string  `json:"place_name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`

	// Данные пользователя
	UserName   string `json:"user_name"`
	UserAvatar string `json:"user_avatar"`
}

// MapPostResponse - DTO для отображения постов на карте
type MapPostResponse struct {
	ID         uint      `json:"id"`
	Title      string    `json:"title"`
	PlaceID    uint      `json:"place_id"`
	PlaceName  string    `json:"place_name"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	CreatedAt  time.Time `json:"created_at"`
	Photos     []string  `json:"photos"` // URLs первых фото
	LikesCount int       `json:"likes_count"`
}
