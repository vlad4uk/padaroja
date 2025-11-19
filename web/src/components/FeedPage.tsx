// src/pages/FeedPage.tsx

import React from 'react';
import FeedHeader from '../components/FeedHeader.tsx';
import PostFeed from '../components/PostFeed.tsx'; // ✅ Будем использовать его
import Sidebar from '../components/Sidebar.tsx';
import '../components/MainLayout.css'; // Общие стили для layout

const FeedPage: React.FC = () => {
    return (
        <div className="app-container">
            <Sidebar />

            <main className="main-content">
                <div className="content-area">
                    {/* Заголовок с поиском и фильтрами */}
                    <FeedHeader />
                    
                    {/* Лента всех постов */}
                    <PostFeed endpoint="/api/posts" />
                </div>
            </main>
        </div>
    );
};

export default FeedPage;