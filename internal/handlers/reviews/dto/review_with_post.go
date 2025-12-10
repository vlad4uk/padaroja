package dto

type CreateReviewWithPostRequest struct {
	PlaceData struct {
		Name      string  `json:"name" binding:"required"`
		Desc      string  `json:"desc"`
		Latitude  float64 `json:"latitude" binding:"required"`
		Longitude float64 `json:"longitude" binding:"required"`
	} `json:"place_data" binding:"required"`

	ReviewData struct {
		Rating   int    `json:"rating" binding:"required,min=1,max=5"`
		Content  string `json:"content" binding:"max=1000"`
		IsPublic bool   `json:"is_public"`
	} `json:"review_data" binding:"required"`

	PostID *uint `json:"post_id"`
}
