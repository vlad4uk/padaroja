-- Этот скрипт должен быть помещен в каталог инициализации PostgreSQL (например, /docker-entrypoint-initdb.d/)
-- для выполнения перед запуском основного сервиса.

-- Проверяем, существует ли расширение, и создаем его, если нет.
-- Это предоставляет функцию uuid_generate_v4(), необходимую для миграций GORM.
# Подключиться к контейнеру с базой данных
docker exec -it padaroja-db psql -U admintblog -d tblog

# В интерактивной консоли PostgreSQL выполнить:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# Выйти
\q