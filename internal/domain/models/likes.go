package models

import (
	"time"
)

type Like struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int       `gorm:"not null" json:"user_id"`
	PostID    int       `gorm:"not null" json:"post_id"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`

	// Связи
	User User `gorm:"foreignKey:UserID" json:"-"`
	Post Post `gorm:"foreignKey:PostID" json:"-"`
}
