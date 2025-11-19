package models

import "time"

// type Post struct {
// 	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
// 	UserID      int       `gorm:"unique;not null" json:"user_id"`
// 	PlaceID     int       `gorm:"unique;not null" json:"place_id"`
// 	Title       string    `gorm:"not null" json:"title"`
// 	Content     string    `gorm:"not null" json:"content"`
// 	Is_approved bool      `gorm:"default:false" json:"is_approved"`
// 	Created_at  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
// }

// type Paragraph struct {
// 	ID      int    `gorm:"primaryKey"`
// 	PostID  int    `gorm:"type:uuid;not null"`
// 	Order   int    `gorm:"not null"`
// 	Content string `gorm:"type:text;not null"`
// }

// type PostPhotos struct {
// 	ID          int    `gorm:"primaryKey;autoIncrement" json:"id"`
// 	PostID      int    `gorm:"unique;not null" json:"post_id"`
// 	Url         string `gorm:"not null" json:"url"`
// 	Order       int
// 	Is_approved bool `gorm:"default:true" json:"is_approved"`
// }

type Post struct {
	ID         string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID     int       `gorm:"not null" json:"user_id"`
	PlaceID    string    `gorm:"type:uuid;not null" json:"place_id"`
	Title      string    `gorm:"size:200;not null" json:"title"`
	IsApproved bool      `gorm:"default:false" json:"is_approved"`
	CreatedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`

	// Связи
	Place      Place       `gorm:"foreignKey:PlaceID;references:ID" json:"place"`
	Paragraphs []Paragraph `gorm:"foreignKey:PostID" json:"paragraphs"`
	Photos     []PostPhoto `gorm:"foreignKey:PostID" json:"photos"`
}

type Paragraph struct {
	ID      int    `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID  string `gorm:"type:uuid;not null" json:"post_id"`
	Order   int    `gorm:"not null" json:"order"`
	Content string `gorm:"type:text;not null" json:"content"`
}

type PostPhoto struct {
	ID         string `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	PostID     string `gorm:"type:uuid;not null" json:"post_id"`
	Url        string `gorm:"not null" json:"url"`
	Order      int    `json:"order"`
	IsApproved bool   `gorm:"default:true" json:"is_approved"`
}

type Place struct {
	ID        string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string    `gorm:"size:150;not null" json:"name"`
	Desc      string    `gorm:"type:text" json:"desc"`
	Latitude  float64   `gorm:"type:numeric(9,6)" json:"latitude"`
	Longitude float64   `gorm:"type:numeric(9,6)" json:"longitude"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

type Tags struct {
	ID   string `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name string `gorm:"size:150;not null" json:"name"`
}

type PlaceTags struct {
	ID      string `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	PlaceID string `gorm:"type:uuid;not null" json:"place_id"`
	TagID   string `gorm:"type:uuid;not null" json:"tag_id"`
}
