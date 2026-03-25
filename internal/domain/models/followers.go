package models

import "time"

type Followers struct {
	ID         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	FollowerID int       `gorm:"not null" json:"follower_id"`
	FollowedID int       `gorm:"not null" json:"followed_id"`
	CreatedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}
