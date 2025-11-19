// src/components/FeedHeader.tsx

import React from 'react';
import { FaSearch, FaFilter, FaListAlt } from 'react-icons/fa';
import '../components/UserPostsFeed.css'; 

const FeedHeader: React.FC = () => {
    return (
        <div className="feed-header-container">
            <div className="search-input-group">
                <FaSearch className="search-icon" />
                <input 
                    type="text" 
                    placeholder="Поиск по публикациям, местам, тегам..." 
                    className="feed-search-input" 
                />
            </div>
            
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