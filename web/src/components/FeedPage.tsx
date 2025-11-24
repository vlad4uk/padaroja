// src/pages/FeedPage.tsx

import React, { useState } from 'react';
import PostFeed from '../components/PostFeed.tsx';
import RightFilters from '../components/RightFilters.tsx';
import ContentLayout from '../components/ContentLayout.tsx';
import '../components/UserPostsFeed.css';

const FeedPage: React.FC = () => {
    // 1. Создаем общее состояние здесь
    const [searchTerm, setSearchTerm] = useState('');
    const [tagSearch, setTagSearch] = useState('');

    return (
        <ContentLayout>
            <div className="feed-page-layout">
                {/* 2. Передаем значения поиска в PostFeed, 
                    чтобы он знал, что запрашивать у сервера 
                */}
                <div className="feed-content-area">
                    <PostFeed 
                        searchQuery={searchTerm} 
                        tagQuery={tagSearch} 
                    />
                </div>

                {/* 3. Передаем функции изменения состояния в RightFilters,
                    чтобы инпуты могли обновлять эти значения
                */}
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