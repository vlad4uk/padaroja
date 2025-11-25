// internal/domain/models/complaint.go (обновленная версия)
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
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

	UserID uint            `gorm:"not null" json:"user_id"`
	PostID uint            `gorm:"not null" json:"post_id"`
	Reason string          `gorm:"type:text;not null" json:"reason"`
	Status ComplaintStatus `gorm:"type:varchar(20);default:'NEW'" json:"status"`

	// Связи (опционально, для более удобных JOIN запросов)
	Post Post `gorm:"foreignKey:PostID" json:"-"`
	User User `gorm:"foreignKey:UserID" json:"-"`
}
