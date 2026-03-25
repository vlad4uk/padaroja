package posts

import "padaroja/internal/domain/models"

type Repository interface {
	Create(post models.Post) error
	GetAll() ([]models.Post, error)
	GetByUser(userID int) ([]models.Post, error)
}
