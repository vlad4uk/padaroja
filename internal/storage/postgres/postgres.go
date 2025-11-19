package postgres

import (
	"log"
	"time" // 👈 Не забудьте импортировать 'time'
	"tourist-blog/internal/domain/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	dbconn := "host=localhost user=admintblog password=system dbname=tblog port=5432 sslmode=disable"

	db, err := gorm.Open(postgres.Open(dbconn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к базе данных!")
	}

	// 1. Получаем базовый объект *sql.DB из GORM
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Ошибка получения sql.DB: %v", err)
	}

	// 2. Настройка пула соединений
	// Максимальное количество неактивных соединений в пуле
	sqlDB.SetMaxIdleConns(10)

	// Максимальное количество открытых соединений
	sqlDB.SetMaxOpenConns(100)

	// Максимальное время жизни соединения (важно для переподключения)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// --- Миграции GORM (оставляем без изменений) ---
	err = db.AutoMigrate(&models.User{})
	// ... (остальные миграции)

	// ...
	if err != nil {
		log.Fatal("Failed to perform GORM AutoMigrate for related tables:", err.Error())
	}

	DB = db
	log.Println("Успех! Подключение к бд + миграция")
}
