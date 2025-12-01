package main

import (
	"log"
	"time"

	auth "tourist-blog/internal/handlers/auth"
	"tourist-blog/internal/handlers/comment"
	"tourist-blog/internal/handlers/favourite"
	"tourist-blog/internal/handlers/follows"
	"tourist-blog/internal/handlers/like"
	maps "tourist-blog/internal/handlers/map"
	"tourist-blog/internal/handlers/moderation"
	"tourist-blog/internal/handlers/places"
	"tourist-blog/internal/handlers/post"
	"tourist-blog/internal/handlers/profile"
	"tourist-blog/internal/handlers/reviews"
	"tourist-blog/internal/middleware"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Подключение к БД
	database.ConnectDB()

	// 2. Инициализация Gin
	router := gin.Default()

	// 3. Настройка CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 4. Роутинг
	api := router.Group("/api")

	// 1. Маршруты аутентификации (открыты)
	authRoutes := api.Group("/auth")
	{
		authRoutes.POST("/register", auth.Register)
		authRoutes.POST("/login", auth.Login)
		authRoutes.POST("/logout", auth.Logout)
	}

	// 2. Маршруты пользователя
	userRoutes := api.Group("/user")
	{
		// Публичные профили пользователей - доступны всем
		userRoutes.GET("/:userID/profile", middleware.OptionalAuthMiddleware(), profile.GetUserProfileByID)
		userRoutes.GET("/:userID/posts", middleware.OptionalAuthMiddleware(), post.GetUserPostsByID)

		// Защищенные маршруты (требуют авторизации)
		protectedUserRoutes := userRoutes.Group("")
		protectedUserRoutes.Use(middleware.AuthMiddleware())
		{
			protectedUserRoutes.GET("/profile", profile.GetCurrentUserProfile)
			protectedUserRoutes.PUT("/profile", profile.UpdateUserProfile)
			protectedUserRoutes.GET("/posts", post.GetUserPosts)

			protectedUserRoutes.POST("/:userID/follow", follows.FollowUser)
			protectedUserRoutes.DELETE("/:userID/follow", follows.UnfollowUser)
			protectedUserRoutes.GET("/:userID/follow/check", follows.CheckFollow)
			protectedUserRoutes.GET("/:userID/followers/count", follows.GetFollowersCount)
			protectedUserRoutes.GET("/:userID/following/count", follows.GetFollowingCount)
			protectedUserRoutes.GET("/:userID/followers", follows.GetFollowersList)
			protectedUserRoutes.GET("/:userID/following", follows.GetFollowingList)
		}
	}

	// 3. Маршруты постов
	postRoutes := api.Group("/posts")
	{
		// 1. Публичная лента - доступна всем (гости и авторизованные)
		postRoutes.GET("", middleware.OptionalAuthMiddleware(), post.GetPublicFeed)

		// 2. Получение одного поста - доступно всем
		postRoutes.GET("/:postID", middleware.OptionalAuthMiddleware(), post.GetPost)

		// 3. Защищенные операции
		postRoutes.POST("", middleware.AuthMiddleware(), post.CreatePost)
		postRoutes.PUT("/:postID", middleware.AuthMiddleware(), post.UpdatePost)
		postRoutes.DELETE("/:postID", middleware.AuthMiddleware(), post.DeletePost)
		postRoutes.POST("/:postID/report", middleware.AuthMiddleware(), post.ReportPost)
	}

	// 4. Маршруты комментариев
	commentRoutes := api.Group("/comments")
	{
		// Получение комментариев - доступно всем
		commentRoutes.GET("/post/:postID", middleware.OptionalAuthMiddleware(), comment.GetComments)

		// Защищенные операции
		commentRoutes.POST("/post/:postID", middleware.AuthMiddleware(), comment.CreateComment)
		commentRoutes.GET("/:commentID/replies", middleware.OptionalAuthMiddleware(), comment.GetCommentReplies)
		commentRoutes.GET("/:commentID/latest-reply", middleware.OptionalAuthMiddleware(), comment.GetLatestReply)
		commentRoutes.PUT("/:commentID", middleware.AuthMiddleware(), comment.UpdateComment)
		commentRoutes.DELETE("/:commentID", middleware.AuthMiddleware(), comment.DeleteComment)
	}

	// 5. Маршруты для карты
	mapRoutes := api.Group("/map")
	{
		// Публичная информация о местах
		mapRoutes.GET("/place/:placeID", middleware.OptionalAuthMiddleware(), maps.GetPlaceDetails)

		// Защищенный маршрут
		mapRoutes.GET("/user-data", middleware.AuthMiddleware(), maps.GetUserMapData)
	}

	// 6. Маршруты мест
	placeRoutes := api.Group("/places")
	{
		// Публичные данные мест
		placeRoutes.GET("", middleware.OptionalAuthMiddleware(), places.GetPlaces)

		// Защищенные операции
		placeRoutes.POST("", middleware.AuthMiddleware(), places.CreatePlace)
	}

	// 7. Маршруты отзывов
	reviewRoutes := api.Group("/reviews")
	{
		// Публичные отзывы мест
		reviewRoutes.GET("/place/:placeID", middleware.OptionalAuthMiddleware(), reviews.GetPlaceReviews)

		// Защищенные операции
		protectedReviewRoutes := reviewRoutes.Group("")
		protectedReviewRoutes.Use(middleware.AuthMiddleware())
		{
			protectedReviewRoutes.POST("", reviews.CreateReview)
			protectedReviewRoutes.GET("/user", reviews.GetUserReviews)
			protectedReviewRoutes.PUT("/:reviewID", reviews.UpdateReview)
			protectedReviewRoutes.DELETE("/:reviewID", reviews.DeleteReview)
		}
	}

	// 8. Маршруты модерации (только для авторизованных)
	modRoutes := api.Group("/mod")
	{
		modRoutes.Use(middleware.AuthMiddleware())

		modRoutes.GET("/complaints", moderation.GetComplaints)
		modRoutes.PUT("/complaints/:complaintID/status", moderation.UpdateComplaintStatus)
		modRoutes.PUT("/posts/:postID/visibility", moderation.TogglePostVisibility)
		modRoutes.GET("/posts/:postID/complaints", moderation.GetPostComplaints)

		// Управление пользователями с жалобами
		modRoutes.GET("/users-with-complaints", moderation.GetUsersWithComplaints)
		modRoutes.POST("/users/:userID/block", moderation.BlockUser)
		modRoutes.POST("/users/:userID/unblock", moderation.UnblockUser)

		// Управление модераторами
		modRoutes.GET("/users/search", moderation.SearchUsers)
		modRoutes.POST("/users/:userID/assign-moderator", moderation.AssignModeratorRole)
		modRoutes.POST("/users/:userID/remove-moderator", moderation.RemoveModeratorRole)
	}

	// 9. Маршруты избранного (только для авторизованных)
	favouriteRoutes := api.Group("/favourites")
	{
		favouriteRoutes.Use(middleware.AuthMiddleware())

		favouriteRoutes.POST("/:postID", favourite.AddToFavourites)
		favouriteRoutes.DELETE("/:postID", favourite.RemoveFromFavourites)
		favouriteRoutes.GET("", favourite.GetFavourites)
		favouriteRoutes.GET("/check/:postID", favourite.CheckFavourite)
		favouriteRoutes.GET("/check-multiple", favourite.CheckMultipleFavourites)
	}

	// 10. Маршруты лайков
	likeRoutes := api.Group("/likes")
	{
		// Публичные: количество лайков
		likeRoutes.GET("/count/:postID", middleware.OptionalAuthMiddleware(), like.GetPostLikesCount)

		// Защищенные операции
		protectedLikeRoutes := likeRoutes.Group("")
		protectedLikeRoutes.Use(middleware.AuthMiddleware())
		{
			protectedLikeRoutes.POST("/:postID", like.LikePost)
			protectedLikeRoutes.DELETE("/:postID", like.UnlikePost)
			protectedLikeRoutes.GET("", like.GetUserLikes)
			protectedLikeRoutes.GET("/check/:postID", like.CheckLike)
		}
	}

	// Запуск сервера
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
