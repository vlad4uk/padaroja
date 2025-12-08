package postgres

import (
	"fmt"
	"log"
	"os"
	"padaroja/internal/domain/models"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslMode := os.Getenv("DB_SSL_MODE")

	dbconn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslMode,
	)

	log.Printf("Подключение к БД: %s@%s:%s/%s", user, host, port, dbname)

	db, err := gorm.Open(postgres.Open(dbconn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Ошибка получения sql.DB: %v", err)
	}

	sqlDB.SetMaxIdleConns(10)

	sqlDB.SetMaxOpenConns(100)

	sqlDB.SetConnMaxLifetime(time.Hour)

	err = db.AutoMigrate(
		&models.User{},
		&models.Place{},
		&models.Post{},
		&models.Paragraph{},
		&models.PostPhoto{},
		&models.PlaceTags{},
		&models.Tags{},
		&models.Complaint{},
		&models.Favourite{},
		&models.Like{},
		&models.Followers{},
		&models.Comment{},
		&models.Review{},
	)
	if err != nil {
		log.Fatal("Failed to perform GORM AutoMigrate:", err)
	}

	DB = db
	log.Println("Успешное подключение к базе данных и миграция")
}

func GetDB() *gorm.DB {
	return DB
}
