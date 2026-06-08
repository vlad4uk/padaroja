package post

import (
	"net/http"
	"padaroja/internal/domain/models"
	database "padaroja/internal/storage/postgres"
	"sort"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PostRecommendationResponse struct {
	ID             uint            `json:"id"`
	Title          string          `json:"title"`
	CreatedAt      string          `json:"created_at"`
	SettlementName string          `json:"settlement_name"`
	SettlementID   uint            `json:"settlement_id"`
	Tags           []string        `json:"tags"`
	Photos         []PhotoResponse `json:"photos"`
	LikesCount     int             `json:"likes_count"`
	UserID         uint            `json:"user_id"`
	UserAvatar     string          `json:"user_avatar"`
	UserName       string          `json:"user_name"`
}

type PhotoResponse struct {
	URL string `json:"url"`
}

func GetGeoRecommendations(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	var likedSettlements []uint
	database.DB.Table("posts").
		Select("DISTINCT settlement_id").
		Joins("JOIN likes ON likes.post_id = posts.id").
		Where("likes.user_id = ?", userID).
		Pluck("settlement_id", &likedSettlements)

	var favouritedSettlements []uint
	database.DB.Table("posts").
		Select("DISTINCT settlement_id").
		Joins("JOIN favourites ON favourites.post_id = posts.id").
		Where("favourites.user_id = ?", userID).
		Pluck("settlement_id", &favouritedSettlements)

	settlementMap := make(map[uint]bool)
	for _, s := range likedSettlements {
		settlementMap[s] = true
	}
	for _, s := range favouritedSettlements {
		settlementMap[s] = true
	}

	allSettlements := make([]uint, 0, len(settlementMap))
	for s := range settlementMap {
		allSettlements = append(allSettlements, s)
	}

	var likedTagIDs []uint
	database.DB.Table("post_tags").
		Select("DISTINCT tag_id").
		Joins("JOIN posts ON posts.id = post_tags.post_id").
		Joins("JOIN likes ON likes.post_id = posts.id").
		Where("likes.user_id = ?", userID).
		Pluck("tag_id", &likedTagIDs)

	var favouritedTagIDs []uint
	database.DB.Table("post_tags").
		Select("DISTINCT tag_id").
		Joins("JOIN posts ON posts.id = post_tags.post_id").
		Joins("JOIN favourites ON favourites.post_id = posts.id").
		Where("favourites.user_id = ?", userID).
		Pluck("tag_id", &favouritedTagIDs)

	tagMap := make(map[uint]bool)
	for _, t := range likedTagIDs {
		tagMap[t] = true
	}
	for _, t := range favouritedTagIDs {
		tagMap[t] = true
	}

	allTagIDs := make([]uint, 0, len(tagMap))
	for t := range tagMap {
		allTagIDs = append(allTagIDs, t)
	}

	if len(allSettlements) == 0 && len(allTagIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"posts":   []PostRecommendationResponse{},
			"type":    "geo",
			"message": "Нет истории лайков/избранного для формирования рекомендаций",
		})
		return
	}

	var posts []models.Post

	query := database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, image_url")
	}).
		Preload("Settlement").
		Preload("Photos", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_approved = true").Order("\"order\" ASC")
		}).
		Preload("Tags").
		Where("is_approved = true").
		Where("user_id != ?", userID).
		Where("id NOT IN (?)", database.DB.Table("likes").Select("post_id").Where("user_id = ?", userID)).
		Where("id NOT IN (?)", database.DB.Table("favourites").Select("post_id").Where("user_id = ?", userID))

	if len(allSettlements) > 0 && len(allTagIDs) > 0 {
		query = query.Where("settlement_id IN (?) OR id IN (?)",
			allSettlements,
			database.DB.Table("post_tags").Select("post_id").Where("tag_id IN (?)", allTagIDs),
		)
	} else if len(allSettlements) > 0 {
		query = query.Where("settlement_id IN (?)", allSettlements)
	} else if len(allTagIDs) > 0 {
		query = query.Where("id IN (?)",
			database.DB.Table("post_tags").Select("post_id").Where("tag_id IN (?)", allTagIDs),
		)
	}

	if err := query.Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type ScoredPost struct {
		Post  models.Post
		Score float64
	}

	scoredPosts := make([]ScoredPost, 0, len(posts))

	for _, post := range posts {
		score := 0.0

		for _, settlementID := range allSettlements {
			if post.SettlementID == settlementID {
				score += 1.0
				break
			}
		}

		tagMatches := 0
		for _, postTag := range post.Tags {
			for _, userTagID := range allTagIDs {
				if postTag.ID == userTagID {
					tagMatches++
					break
				}
			}
		}

		if len(post.Tags) > 0 {
			tagScore := float64(tagMatches) / float64(len(post.Tags)) * 2.0
			score += tagScore
		}

		if score > 0 {
			scoredPosts = append(scoredPosts, ScoredPost{Post: post, Score: score})
		}
	}

	sort.Slice(scoredPosts, func(i, j int) bool {
		return scoredPosts[i].Score > scoredPosts[j].Score
	})

	if len(scoredPosts) > limit {
		scoredPosts = scoredPosts[:limit]
	}

	response := make([]PostRecommendationResponse, 0, len(scoredPosts))
	for _, sp := range scoredPosts {
		post := sp.Post

		tags := make([]string, 0)
		for _, tag := range post.Tags {
			tags = append(tags, tag.Name)
		}

		photos := make([]PhotoResponse, 0)
		if post.Photos != nil {
			for _, photo := range post.Photos {
				photos = append(photos, PhotoResponse{URL: photo.Url})
			}
		}

		settlementName := ""
		if post.Settlement.Geonameid != 0 {
			settlementName = post.Settlement.Name
		}

		userAvatar := ""
		userName := ""
		if post.User.ID != 0 {
			userName = post.User.Username
			userAvatar = post.User.ImageUrl
		}

		response = append(response, PostRecommendationResponse{
			ID:             post.ID,
			Title:          post.Title,
			CreatedAt:      post.CreatedAt.Format("2006-01-02 15:04:05"),
			SettlementName: settlementName,
			SettlementID:   post.SettlementID,
			Tags:           tags,
			Photos:         photos,
			LikesCount:     post.LikesCount,
			UserID:         uint(post.UserID),
			UserAvatar:     userAvatar,
			UserName:       userName,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"posts": response,
		"type":  "geo",
		"metadata": gin.H{
			"total_candidates":   len(posts),
			"unique_settlements": len(allSettlements),
			"unique_tags":        len(allTagIDs),
		},
	})
}

func GetFollowRecommendations(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	var posts []models.Post

	var followCount int64
	database.DB.Model(&models.Followers{}).
		Where("follower_id = ?", userID).
		Count(&followCount)

	if followCount == 0 {
		c.JSON(http.StatusOK, gin.H{"posts": []PostRecommendationResponse{}, "type": "follow"})
		return
	}

	err := database.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, image_url, bio")
	}).
		Preload("Settlement").
		Preload("Photos", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_approved = true").Order("\"order\" ASC")
		}).
		Preload("Tags").
		Joins("JOIN followers ON followers.followed_id = posts.user_id").
		Where("followers.follower_id = ?", userID).
		Where("posts.is_approved = true").
		Where("posts.user_id != ?", userID).
		Where("posts.id NOT IN (?)",
			database.DB.Table("likes").Select("post_id").Where("user_id = ?", userID),
		).
		Where("posts.id NOT IN (?)",
			database.DB.Table("favourites").Select("post_id").Where("user_id = ?", userID),
		).
		Where("posts.id NOT IN (?)",
			database.DB.Table("posts").Select("id").Where("user_id = ?", userID),
		).
		Order("posts.created_at DESC").
		Limit(limit).
		Find(&posts).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := formatRecommendationResponse(posts)
	c.JSON(http.StatusOK, gin.H{"posts": response, "type": "follow"})
}

func formatRecommendationResponse(posts []models.Post) []PostRecommendationResponse {
	response := make([]PostRecommendationResponse, 0, len(posts))

	for _, post := range posts {
		tags := make([]string, 0)
		for _, tag := range post.Tags {
			tags = append(tags, tag.Name)
		}

		photos := make([]PhotoResponse, 0)
		if post.Photos != nil {
			for _, photo := range post.Photos {
				photos = append(photos, PhotoResponse{URL: photo.Url})
			}
		}

		settlementName := ""
		if post.Settlement.Geonameid != 0 {
			settlementName = post.Settlement.Name
		}

		userAvatar := ""
		userName := ""
		if post.User.ID != 0 {
			userName = post.User.Username
			userAvatar = post.User.ImageUrl
		}

		response = append(response, PostRecommendationResponse{
			ID:             post.ID,
			Title:          post.Title,
			CreatedAt:      post.CreatedAt.Format("2006-01-02 15:04:05"),
			SettlementName: settlementName,
			SettlementID:   post.SettlementID,
			Tags:           tags,
			Photos:         photos,
			LikesCount:     post.LikesCount,
			UserID:         uint(post.UserID),
			UserAvatar:     userAvatar,
			UserName:       userName,
		})
	}

	return response
}
