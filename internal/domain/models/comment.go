package models

import (
	"time"
)

type Comment struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PostID     uint      `gorm:"not null;constraint:OnDelete:CASCADE;" json:"post_id"`
	UserID     int       `gorm:"not null" json:"user_id"`
	ParentID   *uint     `gorm:"default:null" json:"parent_id"`
	Content    string    `gorm:"type:text;not null" json:"content"`
	IsApproved bool      `gorm:"default:true" json:"is_approved"`
	CreatedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`

	User       User        `gorm:"foreignKey:UserID" json:"user"`
	Post       Post        `gorm:"foreignKey:PostID" json:"-"`
	Parent     *Comment    `gorm:"foreignKey:ParentID" json:"parent"`
	Complaints []Complaint `gorm:"foreignKey:CommentID" json:"-"`
}
