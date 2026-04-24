package posts

import (
	"encoding/json"
	"padaroja/internal/domain/models"
	"padaroja/internal/sse"
)

type SSEMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type DeleteMessage struct {
	Type   string `json:"type"`
	PostID uint   `json:"postId"`
}

type UpdateMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type NewPostMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Service struct {
	repo Repository
	hub  *sse.SSEHub
}

func NewService(repo Repository, hub *sse.SSEHub) *Service {
	return &Service{repo: repo, hub: hub}
}

func (s *Service) Create(post models.Post) error {
	err := s.repo.Create(post)
	if err != nil {
		return err
	}

	message := SSEMessage{
		Type: "NEW_POST",
		Data: post,
	}

	data, _ := json.Marshal(message)
	s.hub.BroadcastAll <- data
	s.hub.BroadcastUser <- sse.UserMessage{UserID: post.UserID, Data: data}

	return nil
}
