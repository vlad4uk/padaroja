// src/components/MainLayout.tsx

import React, { useState } from 'react'; 
import Sidebar from '../components/Sidebar.tsx';
import ProfileHeader from '../components/ProfileHeader.tsx';
import ProfileEditForm from './ProfileEditForm.tsx'; 
import MapView from './MapView.tsx'; 
import PostFeed from '../components/PostFeed.tsx'; // ✅ ИМПОРТ
import '../components/MainLayout.css'; 


type ActiveTab = 'Публикации' | 'Карта' | 'Изменить';

const MainLayout: React.FC = () => {
    const [activeContent, setActiveContent] = useState<ActiveTab>('Публикации');
    
    const handleTabChange = (tab: ActiveTab) => {
        setActiveContent(tab);
    };

    // Условное отображение контента
    const renderContent = () => {
        if (activeContent === 'Изменить') {
            return (
                <div className="profile-edit-form-container">
                    <ProfileEditForm /> 
                </div>
            );
        }
        
        if (activeContent === 'Карта') {
            return (
                <div 
                    className="profile-edit-form-container" 
                    style={{ 
                        padding: 0, 
                        border: 'none', 
                        background: 'none',
                        marginTop: 0, 
                    }}
                >
                    <MapView />
                </div>
            );
        }
        
        // ✅ ОТРИСОВКА ПУБЛИКАЦИЙ (по умолчанию)
        return (
            <div className="main-feed">
                {/* Вставляем наш новый компонент */}
                <PostFeed />
            </div>
        );
    };

    return (
        <div className="app-container">
            <Sidebar />

            <main className="main-content">
                <div className="content-area">
                    <ProfileHeader onTabChange={handleTabChange} /> 
                    
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;