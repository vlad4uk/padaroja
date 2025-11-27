// src/components/RightFilters.tsx

import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../components/UserPostsFeed.css'; 

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
            {/* Заголовок для ясности */}
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h3 style={{ color: '#696cff', margin: 0, fontSize: '20px' }}>
                    Фильтры
                </h3>
                <div style={{ 
                    width: '60px', 
                    height: '3px', 
                    backgroundColor: '#696cff', 
                    margin: '8px auto 0',
                    borderRadius: '2px'
                }}></div>
            </div>

            {/* Поиск по названию или месту */}
            <div className="right-search-box">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <FaSearch 
                        className="search-icon-placeholder" 
                        style={{ 
                            position: 'absolute', 
                            left: '12px', 
                            color: '#696cff',
                            zIndex: 2
                        }}
                    />
                    <input 
                        type="text" 
                        placeholder="Поиск места или названия..." 
                        className="right-search-input" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '40px' }} 
                    />
                </div>
            </div>

            {/* Поиск по тегам */}
            <div className="right-tags-block">
                <span className="tags-title">Теги</span>
                <div className="tags-line"></div>
                <input 
                    type="text" 
                    placeholder="#пляж #горы #отпуск" 
                    className="right-tags-input" 
                    value={tagSearch} 
                    onChange={(e) => setTagSearch(e.target.value)} 
                />
            </div>

            {/* Дополнительное пространство внизу */}
            <div style={{ height: '50px' }}></div>
        </aside>
    );
};

export default RightFilters;