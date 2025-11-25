package models

import "time"

type User struct {
	ID           int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Username     string    `gorm:"unique;not null" json:"username"`
	Email        string    `gorm:"unique;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	RoleID       int       `gorm:"not null" json:"role_id"`
	Is_blocked   bool      `gorm:"default:false" json:"is_blocked"`
	Created_at   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`

	// ✅ ДОБАВЛЕНО: Поле Bio (до 150 символов)
	Bio string `gorm:"size:150" json:"bio"`

	// ✅ ИСПРАВЛЕНО: Удален 'unique' для Image_Url. Используем 'image_url' в JSON.
	ImageUrl string `json:"image_url"`
}

type UserResponse struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	RoleID    int    `json:"role_id"`
	IsBlocked bool   `json:"is_blocked"`
}
