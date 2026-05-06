package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"padaroja/internal/handlers/admin"
	"padaroja/internal/handlers/auth"
	"padaroja/internal/handlers/comment" // ДОБАВИТЬ ЭТОТ ИМПОРТ
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
		userRoutes.GET("/search/invite", middleware.AuthMiddleware(), profile.SearchUsersForInvite)

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

	// ========== ДОБАВИТЬ МАРШРУТЫ КОММЕНТАРИЕВ ==========
	commentRoutes := api.Group("/comments")
	{
		// Публичные маршруты (чтение)
		commentRoutes.GET("/post/:postID", comment.GetComments)
		commentRoutes.GET("/:commentID/replies", comment.GetCommentReplies)
		commentRoutes.GET("/:commentID/latest-reply", comment.GetLatestReply)

		// Защищенные маршруты (создание, редактирование, удаление)
		protectedCommentRoutes := commentRoutes.Group("")
		protectedCommentRoutes.Use(middleware.AuthMiddleware())
		{
			protectedCommentRoutes.POST("/post/:postID", comment.CreateComment)
			protectedCommentRoutes.PUT("/:commentID", comment.UpdateComment)
			protectedCommentRoutes.DELETE("/:commentID", comment.DeleteComment)
		}
	}
	// ===================================================

	postRoutes := api.Group("/posts")
	{
		// SSE streams
		postRoutes.GET("/stream", gin.WrapF(func(w http.ResponseWriter, r *http.Request) {
			log.Println("SSE connection received for /stream")
			hub.StreamAllPosts(w, r)
		}))
		postRoutes.GET("/stream/user", gin.WrapF(func(w http.ResponseWriter, r *http.Request) {
			log.Printf("SSE connection received for /stream/user with params: %v", r.URL.Query())
			hub.StreamUserPosts(w, r)
		}))

		// Основные маршруты
		postRoutes.GET("", middleware.OptionalAuthMiddleware(), post.GetPublicFeed)
		postRoutes.GET("/:postID", middleware.OptionalAuthMiddleware(), post.GetPost)
		postRoutes.GET("/:postID/collaborators/check", middleware.AuthMiddleware(), post.CheckCollaboratorStatus)
		postRoutes.POST("", middleware.AuthMiddleware(), post.CreatePost)
		postRoutes.GET("/search/settlements", post.SearchSettlements)
		postRoutes.PUT("/:postID", middleware.AuthMiddleware(), post.UpdatePost)
		postRoutes.DELETE("/:postID", middleware.AuthMiddleware(), post.DeletePost)
		postRoutes.POST("/:postID/report", middleware.AuthMiddleware(), post.ReportPost)
		postRoutes.PATCH("/:postID/comments", middleware.AuthMiddleware(), post.ToggleComments)

		// Маршруты для приглашений
		postRoutes.GET("/invites/pending", middleware.AuthMiddleware(), post.GetPendingInvites)
		postRoutes.PUT("/invites/:inviteID/accept", middleware.AuthMiddleware(), post.AcceptInvite)
		postRoutes.PUT("/invites/:inviteID/decline", middleware.AuthMiddleware(), post.DeclineInvite)
		// В main.go, в секции postRoutes добавьте:
		postRoutes.GET("/invites/count", middleware.AuthMiddleware(), post.GetPendingInvitesCount)
		postRoutes.GET("/invites/sent", middleware.AuthMiddleware(), post.GetSentInvites)
		// Маршруты для управления соавторами
		postRoutes.GET("/:postID/collaborators", middleware.AuthMiddleware(), post.GetCollaborators)
		postRoutes.DELETE("/:postID/collaborators/:userID", middleware.AuthMiddleware(), post.RemoveCollaborator)
		postRoutes.POST("/:postID/collaborators/invite", middleware.AuthMiddleware(), post.InviteCollaborator)
		postRoutes.POST("/:postID/leave", middleware.AuthMiddleware(), post.LeaveCollaboration)
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
		likeRoutes.GET("/count/:postID", middleware.OptionalAuthMiddleware(), like.GetPostLikesCount)
		likeRoutes.POST("/:postID", middleware.AuthMiddleware(), like.LikePost)
		likeRoutes.DELETE("/:postID", middleware.AuthMiddleware(), like.UnlikePost)
		likeRoutes.GET("", middleware.AuthMiddleware(), like.GetUserLikes)
		likeRoutes.GET("/check/:postID", middleware.AuthMiddleware(), like.CheckLike)
	}

	favouriteRoutes := api.Group("/favourites")
	{
		favouriteRoutes.POST("/:postID", middleware.AuthMiddleware(), favourite.AddToFavourites)
		favouriteRoutes.DELETE("/:postID", middleware.AuthMiddleware(), favourite.RemoveFromFavourites)
		favouriteRoutes.GET("", middleware.AuthMiddleware(), favourite.GetFavourites)
		favouriteRoutes.GET("/check/:postID", middleware.AuthMiddleware(), favourite.CheckFavourite)
		favouriteRoutes.GET("/check-multiple", middleware.AuthMiddleware(), favourite.CheckMultipleFavourites)
	}

	adminRoutes := api.Group("/admin")
	adminRoutes.Use(middleware.AuthMiddleware())
	{
		adminRoutes.GET("/stats", admin.GetDashboardStats)
		adminRoutes.GET("/users", admin.GetAllUsers)
		adminRoutes.GET("/moderators", admin.GetModerators)
		adminRoutes.GET("/users/search", admin.SearchUsersForAdmin)
		adminRoutes.POST("/users/:userID/assign-moderator", admin.AssignModeratorByAdmin)
		adminRoutes.POST("/users/:userID/remove-moderator", admin.RemoveModeratorByAdmin)
		adminRoutes.POST("/users/:userID/block", admin.BlockUserByAdmin)
		adminRoutes.POST("/users/:userID/unblock", admin.UnblockUserByAdmin)
	}

	log.Printf("Сервер запущен на порту %s в режиме %s", serverPort, env)
	if err := router.Run(":" + serverPort); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
