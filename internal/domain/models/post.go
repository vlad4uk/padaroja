package models

import "time"

type Post struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	UserID           int       `gorm:"not null" json:"user_id"`
	User             User      `gorm:"foreignKey:UserID" json:"user"`
	SettlementID     uint      `gorm:"not null" json:"settlementid"`
	SettlementName   string    `gorm:"size:200;not null" json:"settlementname"`
	Title            string    `gorm:"size:200;not null" json:"title"`
	IsApproved       bool      `gorm:"default:false" json:"is_approved"`
	CreatedAt        time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	LikesCount       int       `gorm:"default:0" json:"likes_count"`
	CommentsDisabled bool      `gorm:"default:false" json:"comments_disabled"`

	Settlement Settlement  `gorm:"foreignKey:SettlementID;references:Geonameid" json:"settlement"`
	Paragraphs []Paragraph `gorm:"foreignKey:PostID" json:"paragraphs"`
	Photos     []PostPhoto `gorm:"foreignKey:PostID" json:"photos"`
	Comments   []Comment   `gorm:"foreignKey:PostID" json:"comments,omitempty"`
	Tags       []Tags      `gorm:"many2many:post_tags;" json:"tags,omitempty"`
}

type Paragraph struct {
	ID      uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID  uint   `gorm:"not null" json:"post_id"`
	Order   int    `gorm:"not null" json:"order"`
	Content string `gorm:"type:text;not null" json:"content"`
}

type PostPhoto struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID     uint   `gorm:"not null" json:"post_id"`
	Url        string `gorm:"not null" json:"url"`
	Order      int    `json:"order"`
	IsApproved bool   `gorm:"default:true" json:"is_approved"`
}

type Settlement struct {
	Geonameid      uint    `gorm:"primaryKey;column:geonameid" json:"geonameid"`
	Name           string  `gorm:"column:name;type:text" json:"name"`
	Asciiname      string  `gorm:"column:asciiname;type:text" json:"asciiname"`
	Alternatenames string  `gorm:"column:alternatenames;type:text" json:"alternatenames"`
	Latitude       float64 `gorm:"column:latitude;type:double precision" json:"latitude"`
	Longitude      float64 `gorm:"column:longitude;type:double precision" json:"longitude"`
	FeatureClass   string  `gorm:"column:feature_class;type:text" json:"feature_class"`
	FeatureCode    string  `gorm:"column:feature_code;type:text" json:"feature_code"`
	Admin1Code     string  `gorm:"column:admin1_code;type:text" json:"admin1_code"`
	Admin2Code     string  `gorm:"column:admin2_code;type:text" json:"admin2_code"`
}

type PostTag struct {
	ID     uint `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID uint `gorm:"not null;index;column:post_id" json:"post_id"` // Явно указываем column:post_id
	TagID  uint `gorm:"not null;index;column:tag_id" json:"tag_id"`   // Явно указываем column:tag_id

	Post Post `gorm:"foreignKey:PostID" json:"-"`
	Tag  Tags `gorm:"foreignKey:TagID" json:"-"`
}

// Таблица Tags остается без изменений
type Tags struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"size:150;not null;uniqueIndex" json:"name"` // Рекомендую добавить uniqueIndex

	// Опционально: связь с постами через PostTag
	Posts []Post `gorm:"many2many:post_tags;" json:"-"`
}
