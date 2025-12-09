// internal/domain/models/complaint.go
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ComplaintType определяет тип объекта жалобы
type ComplaintType string

const (
	ComplaintTypePost    ComplaintType = "POST"
	ComplaintTypeComment ComplaintType = "COMMENT"
)

// ComplaintStatus определяет возможные статусы жалобы
type ComplaintStatus string

const (
	StatusNew        ComplaintStatus = "NEW"
	StatusProcessing ComplaintStatus = "PROCESSING"
	StatusResolved   ComplaintStatus = "RESOLVED"
	StatusRejected   ComplaintStatus = "REJECTED"
)

// Complaint - модель для таблицы жалоб
type Complaint struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID    uint            `gorm:"not null" json:"user_id"`
	Type      ComplaintType   `gorm:"type:varchar(20);not null;default:'POST'" json:"type"` // POST или COMMENT
	PostID    *uint           `gorm:"constraint:OnDelete:CASCADE;" json:"post_id,omitempty"`
	CommentID *uint           `gorm:"constraint:OnDelete:CASCADE;" json:"comment_id,omitempty"`
	Reason    string          `gorm:"type:text;not null" json:"reason"`
	Status    ComplaintStatus `gorm:"type:varchar(20);default:'NEW'" json:"status"`

	// Связи
	Post    Post    `gorm:"foreignKey:PostID" json:"post,omitempty"`
	Comment Comment `gorm:"foreignKey:CommentID" json:"comment,omitempty"`
	User    User    `gorm:"foreignKey:UserID" json:"-"`
}
