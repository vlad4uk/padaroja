-- migrations/003_add_complaint_type.sql
ALTER TABLE complaints 
ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'POST',
ADD COLUMN target_id INTEGER NOT NULL,
ADD CONSTRAINT fk_complaints_post 
    FOREIGN KEY (target_id) REFERENCES posts(id) ON DELETE CASCADE;

-- Обновляем существующие записи
UPDATE complaints SET target_id = post_id WHERE type = 'POST';

-- Добавляем индекс для производительности
CREATE INDEX idx_complaints_type_target ON complaints(type, target_id);