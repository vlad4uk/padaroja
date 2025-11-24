// src/components/RightFilters.tsx

import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../components/UserPostsFeed.css'; 

// 1. Описываем, какие пропсы мы ждем от родителя
interface RightFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    tagSearch: string;
    setTagSearch: (value: string) => void;
}

const RightFilters: React.FC<RightFiltersProps> = ({ 
    searchTerm, 
    setSearchTerm, 
    tagSearch, 
    setTagSearch 
}) => {
    return (
        <aside className="right-filters-sidebar">
            {/* Поиск по названию или месту */}
            <div className="right-search-box">
                <FaSearch className="search-icon-placeholder" style={{ marginLeft: '10px', color: '#888' }}/>
                <input 
                    type="text" 
                    placeholder="Поиск места или названия..." 
                    className="right-search-input" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>

            {/* Поиск по тегам */}
            <div className="right-tags-block">
                <input 
                    type="text" 
                    placeholder="#теги (например: пляж)" 
                    className="right-tags-input" 
                    value={tagSearch} 
                    onChange={(e) => setTagSearch(e.target.value)} 
                />
            </div>
        </aside>
    );
};

export default RightFilters;