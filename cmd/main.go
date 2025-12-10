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
		postRoutes.GET("", middleware.OptionalAuthMiddleware(), post.GetPublicFeed)

		postRoutes.GET("/:postID", middleware.OptionalAuthMiddleware(), post.GetPost)

		postRoutes.POST("", middleware.AuthMiddleware(), post.CreatePost)
		postRoutes.PUT("/:postID", middleware.AuthMiddleware(), post.UpdatePost)
		postRoutes.DELETE("/:postID", middleware.AuthMiddleware(), post.DeletePost)
		postRoutes.POST("/:postID/report", middleware.AuthMiddleware(), post.ReportPost)
		postRoutes.PUT("/:postID/attach-to-place", middleware.AuthMiddleware(), post.AttachPostToPlace)

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
		mapRoutes.GET("/place/:placeID", middleware.OptionalAuthMiddleware(), maps.GetPlaceDetails)

		mapRoutes.GET("/user/:userID/data", maps.GetMapDataByUserID)

		mapRoutes.GET("/user-data", middleware.AuthMiddleware(), maps.GetUserMapData)
	}

	placeRoutes := api.Group("/places")
	{

		placeRoutes.GET("", middleware.OptionalAuthMiddleware(), places.GetPlaces)

		placeRoutes.POST("", middleware.AuthMiddleware(), places.CreatePlace)
	}

	reviewRoutes := api.Group("/reviews")
	{

		reviewRoutes.GET("/place/:placeID", middleware.OptionalAuthMiddleware(), reviews.GetPlaceReviews)

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

	favouriteRoutes := api.Group("/favourites")
	{
		favouriteRoutes.Use(middleware.AuthMiddleware())

		favouriteRoutes.POST("/:postID", favourite.AddToFavourites)
		favouriteRoutes.DELETE("/:postID", favourite.RemoveFromFavourites)
		favouriteRoutes.GET("", favourite.GetFavourites)
		favouriteRoutes.GET("/check/:postID", favourite.CheckFavourite)
		favouriteRoutes.GET("/check-multiple", favourite.CheckMultipleFavourites)
	}

	likeRoutes := api.Group("/likes")
	{

		likeRoutes.GET("/count/:postID", middleware.OptionalAuthMiddleware(), like.GetPostLikesCount)

		protectedLikeRoutes := likeRoutes.Group("")
		protectedLikeRoutes.Use(middleware.AuthMiddleware())
		{
			protectedLikeRoutes.POST("/:postID", like.LikePost)
			protectedLikeRoutes.DELETE("/:postID", like.UnlikePost)
			protectedLikeRoutes.GET("", like.GetUserLikes)
			protectedLikeRoutes.GET("/check/:postID", like.CheckLike)
		}
	}

	log.Printf("Сервер запущен на порту %s в режиме %s", serverPort, env)
	if err := router.Run(":" + serverPort); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
