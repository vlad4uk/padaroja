-- Этот скрипт будет выполняться при каждом запуске контейнера
-- (но только если база данных еще не была инициализирована)
DO $$
BEGIN
    -- Проверяем, существует ли расширение uuid-ossp
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
    ) THEN
        CREATE EXTENSION "uuid-ossp";
        RAISE NOTICE 'Расширение uuid-ossp создано';
    ELSE
        RAISE NOTICE 'Расширение uuid-ossp уже существует';
    END IF;
END $$;