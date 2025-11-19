package main

import (
	"log"
	"time"

	auth "tourist-blog/internal/handlers/auth"
	"tourist-blog/internal/handlers/post"
	profile "tourist-blog/internal/handlers/profile"
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
		// Разрешаем ваш фронтенд
		AllowOrigins: []string{"http://localhost:3000"},
		// Разрешаем нужные HTTP методы
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		// Разрешаем заголовок Authorization (если вы его используете)
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
		// Разрешаем отправку куки и учетных данных
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

		userRoutes.GET("/profile", profile.GetUserProfile)
		userRoutes.PUT("/profile", profile.UpdateUserProfile)

		// ✅ Получение постов текущего пользователя (GET /api/user/posts)
		userRoutes.GET("/posts", post.GetUserPosts)
		// !!! ИСПРАВЛЕНО: УБРАН post.CreatePost, который был здесь ошибочно
	}

	// 3. Маршруты постов
	postRoutes := api.Group("/posts")
	{
		// 1. Создание поста (защищено) - POST /api/posts
		postRoutes.POST("", middleware.AuthMiddleware(), post.CreatePost)

		// ✅ 2. Получение общей ленты (открыт для всех) - GET /api/posts
		// !!! ИСПРАВЛЕНО: УДАЛЕН ДУБЛИКАТ, который вызвал ошибку
		postRoutes.GET("", post.GetPublicFeed)

		// 3. Получение одного поста по ID (открыто) - GET /api/posts/:postID
		postRoutes.GET("/:postID", post.GetPost)

		// 4. Редактирование (защищено) - PUT /api/posts/:postID
		postRoutes.PUT("/:postID", middleware.AuthMiddleware(), post.UpdatePost)

		// 5. Удаление (защищено) - DELETE /api/posts/:postID
		postRoutes.DELETE("/:postID", middleware.AuthMiddleware(), post.DeletePost)
	}

	// Запуск сервера
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Error running server: %v", err)
	}
}
