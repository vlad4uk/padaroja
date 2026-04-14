// RightFilters.tsx - оптимизированная версия
import React, { useState, useEffect } from 'react';
import { FaSearch, FaMap, FaFire } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import '../components/RightFilters.css';

interface RightFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    tagSearch: string;
    setTagSearch: (value: string) => void;
    sortBy: string;
    setSortBy: (value: string) => void;
}

interface GrowingUser {
    id: number;
    username: string;
    avatar: string;
    growth_score: number;
}

const RightFilters: React.FC<RightFiltersProps> = ({ 
    searchTerm, 
    setSearchTerm, 
    tagSearch, 
    setTagSearch,
    sortBy,
    setSortBy
}) => {
    const navigate = useNavigate();
    const [topUsers, setTopUsers] = useState<GrowingUser[]>([]);
    const [topUsersLoading, setTopUsersLoading] = useState(false);
    const [topUsersError, setTopUsersError] = useState<string | null>(null);

    const handleViewOnMap = () => {
        navigate('/map/all');
    };

    const handleUserClick = (userId: number) => {
        navigate(`/profile/${userId}`);
    };

    const fetchTopUsers = async () => {
        setTopUsersLoading(true);
        setTopUsersError(null);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.REACT_APP_API_URL}/user/search`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch top users');
            }
            
            const data = await response.json();
            setTopUsers(data.users || []);
        } catch (error) {
            console.error('Error fetching top users:', error);
            setTopUsersError('Не удалось загрузить топ пользователей');
        } finally {
            setTopUsersLoading(false);
        }
    };

    useEffect(() => {
        fetchTopUsers();
    }, []);

    const getRankClass = (index: number): string => {
        if (index === 0) return 'gold';
        if (index === 1) return 'silver';
        if (index === 2) return 'bronze';
        return '';
    };

    return (
        <aside className="right-filters-sidebar">
            {/* Заголовок */}
            <div className="right-filters-header">
                <h3 className="right-filters-title">
                    Фильтры
                </h3>
                <div className="right-filters-title-line"></div>
            </div>

            {/* Поиск по названию или месту */}
            <div className="right-search-box">
                <div className="right-search-wrapper">
                    <FaSearch className="right-search-icon" />
                    <input 
                        type="text" 
                        placeholder="Поиск места или названия..." 
                        className="right-search-input" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
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

            {/* Сортировка */}
            <div className="right-sort-block">
                <span className="tags-title">Сортировка</span>
                <div className="tags-line"></div>
                
                <div className="right-sort-options">
                    <label className="right-sort-option">
                        <input 
                            type="radio" 
                            name="sort" 
                            value="popular"
                            checked={sortBy === 'popular'}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="right-sort-radio"
                        />
                        <span className="right-sort-label">Популярные</span>
                    </label>
                    
                    <label className="right-sort-option">
                        <input 
                            type="radio" 
                            name="sort" 
                            value="new"
                            checked={sortBy === 'new'}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="right-sort-radio"
                        />
                        <span className="right-sort-label">Новые</span>
                    </label>
                    
                    <label className="right-sort-option">
                        <input 
                            type="radio" 
                            name="sort" 
                            value="trending"
                            checked={sortBy === 'trending'}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="right-sort-radio"
                        />
                        <span className="right-sort-label">Актуальные</span>
                    </label>
                </div>
            </div>

            {/* Кнопка "Посмотреть на карте" - оптимизированные отступы */}
            <div className="right-map-button-wrapper">
                <button
                    onClick={handleViewOnMap}
                    className="right-map-button"
                >
                    <FaMap size={18} />
                    Посмотреть на карте
                </button>
            </div>

            {/* Топ растущих пользователей за неделю */}
            <div className="top-users-block">
                <div className="top-users-header">
                    <div className="top-users-title">
                        Растущие звезды
                    </div>
                    <div className="top-users-subtitle">
                        Активность за последнюю неделю
                    </div>
                </div>

                {topUsersLoading && (
                    <div className="top-users-loading">
                        <div className="top-users-loading-spinner"></div>
                        Загрузка...
                    </div>
                )}

                {topUsersError && (
                    <div className="top-users-error">
                        {topUsersError}
                    </div>
                )}

                {!topUsersLoading && !topUsersError && topUsers.length === 0 && (
                    <div className="top-users-empty">
                        Нет данных за последнюю неделю
                    </div>
                )}

                {!topUsersLoading && !topUsersError && topUsers.length > 0 && (
                    <div className="top-users-list">
                        {topUsers.slice(0, 5).map((user, index) => (
                            <div 
                                key={user.id} 
                                className="top-user-card"
                                onClick={() => handleUserClick(user.id)}
                            >
                                <img 
                                    src={user.avatar || '/default-avatar.png'} 
                                    alt={user.username}
                                    className="top-user-avatar"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/default-avatar.png';
                                    }}
                                />
                                <div className="top-user-info">
                                    <div className="top-user-name">{user.username}</div>
                                </div>
                                <div className="top-user-stats">
                                    <span className="top-user-growth-score">
                                        +{user.growth_score}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};

export default RightFilters;