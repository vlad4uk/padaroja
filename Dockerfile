# Используем Go 1.24.4, как указано в go.mod
FROM golang:1.24.4-alpine AS builder

WORKDIR /app

# Копируем всё
COPY . .


# Загружаем зависимости
RUN go mod download

# Собираем приложение
RUN CGO_ENABLED=0 GOOS=linux go build -o app ./cmd

# Финальный этап (Runner)
FROM alpine:latest

WORKDIR /root/

RUN apk --no-cache add ca-certificates

# Копируем бинарник из этапа сборки
COPY --from=builder /app/app .

# Копируем .env
COPY .env .

# Копируем миграции
COPY --from=builder /app/migrations ./migrations

# Создаем папку для загрузок
RUN mkdir -p uploads

EXPOSE 8080

CMD ["./app"]