package main

import (
	"log"
	"time"

	// Добавил, если понадобится конвертация ID
	auth "tourist-blog/internal/handlers/auth"
	"tourist-blog/internal/handlers/comment"
	"tourist-blog/internal/handlers/favourite"
	"tourist-blog/internal/handlers/follows"
	"tourist-blog/internal/handlers/like"
	"tourist-blog/internal/handlers/moderation"
	"tourist-blog/internal/handlers/post"
	"tourist-blog/internal/handlers/profile"
	"tourist-blog/internal/middleware"
	database "tourist-blog/internal/storage/postgres"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// =========================================================================
// НОВЫЙ OptionalAuthMiddleware (не блокирует запрос, если токена нет)
// =========================================================================
func OptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 🚨 ВАЖНО: ЗАМЕНИТЕ ЭТОТ БЛОК НА ВАШУ ЛОГИКУ ВАЛИДАЦИИ ТОКЕНА
		// (например, получение токена из Cookie, его валидация и извлечение userID)
		//
		// ********** ПРИМЕРНАЯ ЛОГИКА **********
		/*
			token, err := c.Cookie("token")
			if err == nil {
				// Предполагаем, что у вас есть функция для валидации и извлечения ID
				// userID, err := utils.ValidateToken(token)

				// Если валидация успешна:
				// c.Set("userID", userID)
			}
		*/
		// ****************************************

		// Если вы используете JWT из заголовка Authorization, логика будет другой.
		// Главное: если токен есть и он валиден, поместите ID в контекст:
		// c.Set("userID", int(parsedUserID))

		// Этот вызов пропускает запрос к следующему обработчику (GetPublicFeed),
		// независимо от наличия токена.
		c.Next()
	}
}

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

	// 2. Маршруты пользователя (требуют авторизации)
	userRoutes := api.Group("/user")
	{
		userRoutes.Use(middleware.AuthMiddleware())

		userRoutes.GET("/profile", profile.GetCurrentUserProfile)
		userRoutes.PUT("/profile", profile.UpdateUserProfile)

		// Получение постов текущего пользователя (GET /api/user/posts)
		userRoutes.GET("/posts", post.GetUserPosts)

		// ✅ НОВЫЙ ЭНДПОИНТ: Получение профиля любого пользователя
		userRoutes.GET("/:userID/profile", profile.GetUserProfileByID)
		userRoutes.GET("/:userID/posts", post.GetUserPostsByID) // ✅ НОВЫЙ: Посты любого пользова

		userRoutes.POST("/:userID/follow", follows.FollowUser)
		userRoutes.DELETE("/:userID/follow", follows.UnfollowUser)
		userRoutes.GET("/:userID/follow/check", follows.CheckFollow)
		userRoutes.GET("/:userID/followers/count", follows.GetFollowersCount)
		userRoutes.GET("/:userID/following/count", follows.GetFollowingCount)
		userRoutes.GET("/:userID/followers", follows.GetFollowersList)
		userRoutes.GET("/:userID/following", follows.GetFollowingList)
	}

	// 3. Маршруты постов
	postRoutes := api.Group("/posts")
	{
		// 1. Создание поста (защищено) - POST /api/posts
		postRoutes.POST("", middleware.AuthMiddleware(), post.CreatePost)

		// ✅ 2. Получение общей ленты (открыт для всех) - GET /api/posts
		// ПРИМЕНЯЕМ OptionalAuthMiddleware!
		postRoutes.GET("", OptionalAuthMiddleware(), post.GetPublicFeed)

		// 3. Получение одного поста по ID (открыто) - GET /api/posts/:postID
		postRoutes.GET("/:postID", post.GetPost)

		// 4. Редактирование (защищено) - PUT /api/posts/:postID
		postRoutes.PUT("/:postID", middleware.AuthMiddleware(), post.UpdatePost)

		// 4. Оставить жалобу (защищено) - POST /api/posts/:postID/report
		postRoutes.POST("/:postID/report", middleware.AuthMiddleware(), post.ReportPost)

		// 5. Удаление (защищено) - DELETE /api/posts/:postID
		postRoutes.DELETE("/:postID", middleware.AuthMiddleware(), post.DeletePost)
	}

	modRoutes := api.Group("/mod")
	{
		modRoutes.Use(middleware.AuthMiddleware())

		modRoutes.GET("/complaints", moderation.GetComplaints)
		modRoutes.PUT("/complaints/:complaintID/status", moderation.UpdateComplaintStatus)
		modRoutes.PUT("/posts/:postID/visibility", moderation.TogglePostVisibility) // ✅ НОВЫЙ ЭНДПОИНТ
		modRoutes.GET("/posts/:postID/complaints", moderation.GetPostComplaints)
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
		likeRoutes.Use(middleware.AuthMiddleware())

		likeRoutes.POST("/:postID", like.LikePost)
		likeRoutes.DELETE("/:postID", like.UnlikePost)
		likeRoutes.GET("", like.GetUserLikes)
		likeRoutes.GET("/check/:postID", like.CheckLike)
		likeRoutes.GET("/count/:postID", like.GetPostLikesCount) // публичный эндпоинт
	}

	// main.go
	commentRoutes := api.Group("/comments")
	{
		// Создание комментария (защищено) - POST /api/comments/post/:postID
		commentRoutes.POST("/post/:postID", middleware.AuthMiddleware(), comment.CreateComment)

		// Получение комментариев к посту (открыто) - GET /api/comments/post/:postID
		commentRoutes.GET("/post/:postID", comment.GetComments)

		// Получение ответов на комментарий (открыто) - GET /api/comments/:commentID/replies
		commentRoutes.GET("/:commentID/replies", comment.GetCommentReplies)

		// Обновление комментария (защищено) - PUT /api/comments/:commentID
		commentRoutes.PUT("/:commentID", middleware.AuthMiddleware(), comment.UpdateComment)

		// Удаление комментария (защищено) - DELETE /api/comments/:commentID
		commentRoutes.DELETE("/:commentID", middleware.AuthMiddleware(), comment.DeleteComment)
	}

	// Запуск сервера
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
