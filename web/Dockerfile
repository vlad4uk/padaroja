# Этап сборки
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Этап запуска (nginx)
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY --from=builder /app/build .

# Копируем конфиг nginx (если нужен CORS/SPA routing)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]