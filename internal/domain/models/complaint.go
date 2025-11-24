// internal/domain/models/complaint.go (новый файл или добавление в models)

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
	// Используем gorm.Model, но переопределяем ID на UUID
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID uint            `gorm:"not null" json:"user_id"`                      // ID пользователя, который оставил жалобу
	PostID uint            `gorm:"not null" json:"post_id"`                      // ID поста, на который жалуются
	Reason string          `gorm:"type:text;not null" json:"reason"`             // Текст жалобы
	Status ComplaintStatus `gorm:"type:varchar(20);default:'NEW'" json:"status"` // Статус жалобы
}
