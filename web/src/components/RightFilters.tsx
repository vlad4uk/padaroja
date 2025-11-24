// src/components/RightFilters.tsx

import React, { useState } from 'react'; // <-- Импортируем useState
import { FaSearch, FaPlay } from 'react-icons/fa';
import '../components/UserPostsFeed.css'; 


const RightFilters: React.FC = () => {
    // 1. Состояние для поля поиска
    const [searchTerm, setSearchTerm] = useState('');
    // 2. Состояние для поля тегов
    const [tagSearch, setTagSearch] = useState('');

    return (
        <aside className="right-filters-sidebar">
            {/* Поиск */}
            <div className="right-search-box">
                <input 
                    type="text" 
                    placeholder="поиск" 
                    className="right-search-input" 
                    value={searchTerm} // <-- Привязываем состояние
                    onChange={(e) => setSearchTerm(e.target.value)} // <-- Обновляем состояние
                />
            </div>

            {/* Блок тегов */}
            <div className="right-tags-block">
                {/* 💡 ИЗМЕНЕНИЕ: Новый плейсхолдер */}
                <input 
                    type="text" 
                    placeholder="#теги" // <-- ИЗМЕНЕНИЕ
                    className="right-tags-input" 
                    value={tagSearch} 
                    onChange={(e) => setTagSearch(e.target.value)} 
                />
            </div>

           
        </aside>
    );
};

export default RightFilters;