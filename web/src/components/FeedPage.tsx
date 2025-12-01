// src/pages/FeedPage.tsx

import React, { useState, useEffect } from 'react';
import PostFeed from '../components/PostFeed.tsx';
import RightFilters from '../components/RightFilters.tsx';
import ContentLayout from '../components/ContentLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import '../components/UserPostsFeed.css';

const FeedPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tagSearch, setTagSearch] = useState('');
    const { isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div>Загрузка ленты...</div>
            </div>
        );
    }

    return (
        <ContentLayout>
            <div className="feed-page-layout">
                {/* Основной контент - прокручивается */}
                <div className="feed-content-area">
                    <PostFeed 
                        searchQuery={searchTerm} 
                        tagQuery={tagSearch} 
                    />
                </div>

                {/* Правая панель - закреплена */}
                <div className="feed-filters-area">
                    <RightFilters 
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        tagSearch={tagSearch}
                        setTagSearch={setTagSearch}
                    />
                </div>
            </div>
        </ContentLayout>
    );
};

export default FeedPage;