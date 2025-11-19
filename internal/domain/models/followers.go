package models

type Followers struct {
	ID         int `gorm:"primaryKey;autoIncrement" json:"id"`
	FollowerID int `gorm:"unique;not null" json:"follower_id"`
	FollowedID int `gorm:"unique;not null" json:"followed_id"`
}

type FollowerResponse struct {
	ID         int `json:"id"`
	FollowerID int `json:"follower_id"`
	FollowedID int `json:"followed_id"`
}
