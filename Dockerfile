# Этап сборки
FROM golang:1.23 AS builder


WORKDIR /app

# Копируем go.mod и go.sum
COPY go.mod go.sum ./
RUN go mod download

# Копируем исходники
COPY . .

# Собираем бинарник
RUN go build -o server ./cmd

# Этап запуска
FROM ubuntu:22.04

WORKDIR /app

# Копируем бинарник из builder
COPY --from=builder /app/server .

# Копируем .env (если нужно)
COPY .env .

# Экспонируем порт
EXPOSE 8080

CMD ["./server"]