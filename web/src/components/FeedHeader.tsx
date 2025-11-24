// src/components/FeedHeader.tsx

import React, { useState } from 'react'; // <-- Импортируем useState
import { FaSearch, FaFilter, FaListAlt } from 'react-icons/fa';
// Используем стили из UserPostsFeed.css
import '../components/UserPostsFeed.css'; 

const FeedHeader: React.FC = () => {
    // Добавляем состояние для поля поиска
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        // Здесь должна быть логика поиска/фильтрации
        console.log("Поиск по:", event.target.value);
    };

    return (
        <div className="feed-header-container">
            {/* 1. Группа ввода поиска (Сделано рабочим) */}
            <div className="search-input-group">
                <FaSearch className="search-icon" />
                <input 
                    type="text" 
                    placeholder="Поиск по публикациям, местам, тегам..." 
                    className="feed-search-input" 
                    value={searchTerm} // <-- Привязываем состояние
                    onChange={handleSearchChange} // <-- Обрабатываем ввод
                />
            </div>
            
            {/* 2. Группа кнопок фильтров */}
            <div className="filter-buttons">
                {/* Кнопка "Фильтр" */}
                <button className="filter-button">
                    <FaFilter />
                    Фильтр
                </button>
                {/* Кнопка "Сортировка" */}
                <button className="filter-button">
                    <FaListAlt />
                    Сортировка
                </button>
            </div>
        </div>
    );
};

export default FeedHeader;