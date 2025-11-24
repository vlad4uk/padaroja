// src/pages/FeedPage.tsx

import React from 'react';
import PostFeed from '../components/PostFeed.tsx';
import RightFilters from '../components/RightFilters.tsx'; // Новый компонент
import ContentLayout from '../components/ContentLayout.tsx';
import '../components/UserPostsFeed.css'; // Убедимся, что стили подключены

const FeedPage: React.FC = () => {
    return (
        <ContentLayout>
            <div className="feed-page-layout">
                {/* Левая часть контента: Лента постов */}
                <div className="feed-content-area">
                    <PostFeed />
                </div>

                {/* Правая часть контента: Фильтры */}
                <div className="feed-filters-area">
                    <RightFilters />
                </div>
            </div>
        </ContentLayout>
    );
};

export default FeedPage;