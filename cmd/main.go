package main

import (
	"log"
	"net/http"
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
	"padaroja/internal/handlers/post"
	"padaroja/internal/handlers/profile"
	"padaroja/internal/middleware"
	"padaroja/internal/sse"
	database "padaroja/internal/storage/postgres"
	utils "padaroja/utils/auth"
)

func main() {
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	if env == "development" {
		if err := godotenv.Load(); err != nil {
			log.Printf("Warning: .env file not found: %v", err)
		}
	}

	if err := utils.InitJWTSecret(); err != nil {
		log.Fatalf("Failed to initialize JWT secret: %v", err)
	}

	database.ConnectDB()

	if env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()
	hub := sse.NewHub()
	go hub.Run()

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

	if env == "development" {
		corsConfig.AllowOriginFunc = func(origin string) bool {
			return true
		}
		corsConfig.AllowOrigins = nil
	}

	router.Use(cors.New(corsConfig))

	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	api := router.Group("/api")

	authRoutes := api.Group("/auth")
	{
		authRoutes.POST("/register", auth.Register)
		authRoutes.POST("/login", auth.Login)
		authRoutes.POST("/logout", auth.Logout)
	}

	userRoutes := api.Group("/user")
	{
		userRoutes.GET("/:userID/profile", middleware.OptionalAuthMiddleware(), profile.GetUserProfileByID)
		userRoutes.GET("/:userID/posts", middleware.OptionalAuthMiddleware(), post.GetUserPostsByID)
		userRoutes.GET("/search", middleware.OptionalAuthMiddleware(), profile.SearchUsers)

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

	postRoutes := api.Group("/posts")
	{
		postRoutes.GET("/stream", gin.WrapF(func(w http.ResponseWriter, r *http.Request) {
			log.Println("SSE connection received for /stream")
			hub.StreamAllPosts(w, r)
		}))
		postRoutes.GET("/stream/user", gin.WrapF(func(w http.ResponseWriter, r *http.Request) {
			log.Printf("SSE connection received for /stream/user with params: %v", r.URL.Query())
			hub.StreamUserPosts(w, r)
		}))
		postRoutes.GET("", middleware.OptionalAuthMiddleware(), post.GetPublicFeed)

		postRoutes.GET("/:postID", middleware.OptionalAuthMiddleware(), post.GetPost)

		postRoutes.POST("", middleware.AuthMiddleware(), post.CreatePost)
		postRoutes.GET("/search/settlements", post.SearchSettlements)
		postRoutes.PUT("/:postID", middleware.AuthMiddleware(), post.UpdatePost)
		postRoutes.DELETE("/:postID", middleware.AuthMiddleware(), post.DeletePost)
		postRoutes.POST("/:postID/report", middleware.AuthMiddleware(), post.ReportPost)

		postRoutes.PATCH("/:postID/comments", middleware.AuthMiddleware(), post.ToggleComments)
	}

	commentRoutes := api.Group("/comments")
	{
		commentRoutes.GET("/post/:postID", middleware.OptionalAuthMiddleware(), comment.GetComments)

		commentRoutes.POST("/post/:postID", middleware.AuthMiddleware(), comment.CreateComment)
		commentRoutes.GET("/:commentID/replies", middleware.OptionalAuthMiddleware(), comment.GetCommentReplies)
		commentRoutes.GET("/:commentID/latest-reply", middleware.OptionalAuthMiddleware(), comment.GetLatestReply)
		commentRoutes.PUT("/:commentID", middleware.AuthMiddleware(), comment.UpdateComment)
		commentRoutes.DELETE("/:commentID", middleware.AuthMiddleware(), comment.DeleteComment)
	}

	mapRoutes := api.Group("/map")
	{
		mapRoutes.GET("/user/:userID/data", maps.GetMapDataByUserID)

		mapRoutes.GET("/user-data", middleware.AuthMiddleware(), maps.GetUserMapData)

		mapRoutes.GET("/posts/all", maps.GetAllPostsMapData)
	}

	modRoutes := api.Group("/mod")
	{
		modRoutes.Use(middleware.AuthMiddleware())

		modRoutes.GET("/complaints", moderation.GetComplaints)
		modRoutes.PUT("/complaints/:complaintID/status", moderation.UpdateComplaintStatus)

		modRoutes.POST("/posts/:postID/complaint", moderation.CreatePostComplaint)
		modRoutes.PUT("/posts/:postID/visibility", moderation.TogglePostVisibility)
		modRoutes.GET("/posts/:postID/complaints", moderation.GetPostComplaints)

		modRoutes.POST("/comments/:commentID/complaint", moderation.CreateCommentComplaint)
		modRoutes.PUT("/comments/:commentID/visibility", moderation.ToggleCommentVisibility)
		modRoutes.GET("/comments/:commentID/complaints", moderation.GetCommentComplaints)

		modRoutes.GET("/users-with-complaints", moderation.GetUsersWithComplaints)
		modRoutes.POST("/users/:userID/block", moderation.BlockUser)
		modRoutes.POST("/users/:userID/unblock", moderation.UnblockUser)

		modRoutes.GET("/users/search", moderation.SearchUsers)
		modRoutes.POST("/users/:userID/assign-moderator", moderation.AssignModeratorRole)
		modRoutes.POST("/users/:userID/remove-moderator", moderation.RemoveModeratorRole)
	}

	likeRoutes := api.Group("/likes")
	{
		// Публичные маршруты
		likeRoutes.GET("/count/:postID", middleware.OptionalAuthMiddleware(), like.GetPostLikesCount)

		// Защищенные маршруты - ВАЖНО: определяем их на корневом уровне группы
		likeRoutes.POST("/:postID", middleware.AuthMiddleware(), like.LikePost)
		likeRoutes.DELETE("/:postID", middleware.AuthMiddleware(), like.UnlikePost)
		likeRoutes.GET("", middleware.AuthMiddleware(), like.GetUserLikes)
		likeRoutes.GET("/check/:postID", middleware.AuthMiddleware(), like.CheckLike)
	}

	favouriteRoutes := api.Group("/favourites")
	{
		// Все маршруты избранного требуют авторизации
		favouriteRoutes.POST("/:postID", middleware.AuthMiddleware(), favourite.AddToFavourites)
		favouriteRoutes.DELETE("/:postID", middleware.AuthMiddleware(), favourite.RemoveFromFavourites)
		favouriteRoutes.GET("", middleware.AuthMiddleware(), favourite.GetFavourites)
		favouriteRoutes.GET("/check/:postID", middleware.AuthMiddleware(), favourite.CheckFavourite)
		favouriteRoutes.GET("/check-multiple", middleware.AuthMiddleware(), favourite.CheckMultipleFavourites)
	}

	log.Printf("Сервер запущен на порту %s в режиме %s", serverPort, env)
	if err := router.Run(":" + serverPort); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
