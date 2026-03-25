import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../components/UserPostsFeed.css'; 

interface RightFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    tagSearch: string;
    setTagSearch: (value: string) => void;
    sortBy: string; // Добавляем
    setSortBy: (value: string) => void; // Добавляем
}

const RightFilters: React.FC<RightFiltersProps> = ({ 
    searchTerm, 
    setSearchTerm, 
    tagSearch, 
    setTagSearch,
    sortBy, // Добавляем
    setSortBy // Добавляем
}) => {
    return (
        <aside className="right-filters-sidebar">
            {/* Заголовок */}
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

            {/* НОВЫЙ БЛОК: Сортировка */}
            <div className="right-sort-block" style={{ marginTop: '30px' }}>
                <span className="tags-title">Сортировка</span>
                <div className="tags-line" style={{ marginBottom: '15px' }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input 
                            type="radio" 
                            name="sort" 
                            value="popular"
                            checked={sortBy === 'popular'}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ accentColor: '#696cff', width: '18px', height: '18px' }}
                        />
                        <span style={{ color: '#696cff', fontSize: '16px' }}>🔥 Популярные</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input 
                            type="radio" 
                            name="sort" 
                            value="new"
                            checked={sortBy === 'new'}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ accentColor: '#696cff', width: '18px', height: '18px' }}
                        />
                        <span style={{ color: '#696cff', fontSize: '16px' }}>✨ Новые</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input 
                            type="radio" 
                            name="sort" 
                            value="trending"
                            checked={sortBy === 'trending'}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ accentColor: '#696cff', width: '18px', height: '18px' }}
                        />
                        <span style={{ color: '#696cff', fontSize: '16px' }}>⚡ Актуальные (лайки за 24ч)</span>
                    </label>
                </div>
            </div>

            <div style={{ height: '50px' }}></div>
        </aside>
    );
};

export default RightFilters;