package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"padaroja/internal/handlers/auth"
	"padaroja/internal/handlers/comment"
	"padaroja/internal/handlers/favourite"
	"padaroja/internal/handlers/follows"
	"padaroja/internal/handlers/like"
	maps "padaroja/internal/handlers/map"
	"padaroja/internal/handlers/moderation"
	"padaroja/internal/handlers/places"
	"padaroja/internal/handlers/post"
	"padaroja/internal/handlers/profile"
	"padaroja/internal/handlers/reviews"
	"padaroja/internal/middleware"
	database "padaroja/internal/storage/postgres"
	utils "padaroja/utils/auth"
)

func main() {
	// 1. Загрузка переменных окружения
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	// В development режиме загружаем из .env файла
	if env == "development" {
		if err := godotenv.Load(); err != nil {
			log.Printf("Warning: .env file not found: %v", err)
		}
	}

	// 2. Инициализация JWT секрета
	if err := utils.InitJWTSecret(); err != nil {
		log.Fatalf("Failed to initialize JWT secret: %v", err)
	}

	// 3. Подключение к БД
	database.ConnectDB()

	// 4. Инициализация Gin с режимом из .env
	if env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// 5. Настройка CORS из переменных окружения
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	corsConfig := cors.Config{
		AllowOrigins:     []string{frontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// Если в development, разрешаем все origins для удобства
	if env == "development" {
		corsConfig.AllowOriginFunc = func(origin string) bool {
			return true
		}
		corsConfig.AllowOrigins = nil
	}

	router.Use(cors.New(corsConfig))

	// 6. Порт сервера из .env
	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	// 7. Роутинг
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
		postRoutes.PUT("/:postID/attach-to-place", middleware.AuthMiddleware(), post.AttachPostToPlace)

		// 4. Управление комментариями
		postRoutes.PATCH("/:postID/comments", middleware.AuthMiddleware(), post.ToggleComments)
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

		// Данные карты по ID пользователя (доступны всем)
		mapRoutes.GET("/user/:userID/data", maps.GetMapDataByUserID)

		// Защищенный маршрут (личные данные текущего пользователя)
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
			protectedReviewRoutes.POST("/with-place", reviews.CreateReviewWithPlace)
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
	log.Printf("Сервер запущен на порту %s в режиме %s", serverPort, env)
	if err := router.Run(":" + serverPort); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
