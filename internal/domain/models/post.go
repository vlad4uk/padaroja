package models

import "time"

type Post struct {
	ID         uint      `gorm:"primaryKey" json:"id"` // ✅ ID поста теперь uint/int
	UserID     int       `gorm:"not null" json:"user_id"`
	User       User      `gorm:"foreignKey:UserID" json:"user"` // Эта связь важна
	PlaceID    uint      `gorm:"not null" json:"place_id"`      // ✅ Ссылка на Place теперь uint/int
	Title      string    `gorm:"size:200;not null" json:"title"`
	IsApproved bool      `gorm:"default:false" json:"is_approved"`
	CreatedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	LikesCount int       `gorm:"default:0" json:"likes_count"` // Добавьте это поле
	// Связи
	Place      Place       `gorm:"foreignKey:PlaceID;references:ID" json:"place"`
	Paragraphs []Paragraph `gorm:"foreignKey:PostID" json:"paragraphs"`
	Photos     []PostPhoto `gorm:"foreignKey:PostID" json:"photos"`
}

type Paragraph struct {
	ID      uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID  uint   `gorm:"not null" json:"post_id"` // ✅ Теперь uint
	Order   int    `gorm:"not null" json:"order"`
	Content string `gorm:"type:text;not null" json:"content"`
}

type PostPhoto struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID     uint   `gorm:"not null" json:"post_id"` // ✅ Теперь uint
	Url        string `gorm:"not null" json:"url"`
	Order      int    `json:"order"`
	IsApproved bool   `gorm:"default:true" json:"is_approved"`
}

type Place struct {
	ID        uint      `gorm:"primaryKey" json:"id"` // ✅ ID места теперь uint/int
	Name      string    `gorm:"size:150;not null" json:"name"`
	Desc      string    `gorm:"type:text" json:"desc"`
	Latitude  float64   `gorm:"type:numeric(9,6)" json:"latitude"`
	Longitude float64   `gorm:"type:numeric(9,6)" json:"longitude"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

type Tags struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"size:150;not null" json:"name"`
}

type PlaceTags struct {
	ID      uint `gorm:"primaryKey;autoIncrement" json:"id"`
	PlaceID uint `gorm:"not null" json:"place_id"` // ✅ Теперь uint
	TagID   uint `gorm:"not null" json:"tag_id"`   // ✅ Теперь uint
}
