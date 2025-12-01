package models

import (
	"time"
)

type Review struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	UserID    int       `gorm:"not null" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user"`
	PlaceID   uint      `gorm:"not null" json:"place_id"`
	Place     Place     `gorm:"foreignKey:PlaceID" json:"place"`
	Rating    int       `gorm:"not null;check:rating >= 1 AND rating <= 5" json:"rating"`
	Content   string    `gorm:"type:text" json:"content"`
	IsPublic  bool      `gorm:"default:true" json:"is_public"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}
