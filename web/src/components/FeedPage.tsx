import React, { useState } from 'react';
import PostFeed from '../components/PostFeed.tsx';
import RightFilters from '../components/RightFilters.tsx';
import ContentLayout from '../components/ContentLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import '../components/UserPostsFeed.css';

const FeedPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tagSearch, setTagSearch] = useState('');
    const [sortBy, setSortBy] = useState('new'); // 'popular', 'new', 'trending'
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
                <div className="feed-content-area">
                    <PostFeed 
                        searchQuery={searchTerm} 
                        tagQuery={tagSearch} 
                        sortBy={sortBy} // Добавляем
                    />
                </div>

                <div className="feed-filters-area">
                    <RightFilters 
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        tagSearch={tagSearch}
                        setTagSearch={setTagSearch}
                        sortBy={sortBy} // Добавляем
                        setSortBy={setSortBy} // Добавляем
                    />
                </div>
            </div>
        </ContentLayout>
    );
};

export default FeedPage;