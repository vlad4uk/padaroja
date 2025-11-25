// src/components/MainLayout.tsx
import React, { useState, useEffect } from 'react'; 
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import ProfileHeader from '../components/ProfileHeader.tsx';
import ProfileEditForm from '../components/ProfileEditForm.tsx'; 
import MapView from '../components/MapView.tsx'; 
import '../components/MainLayout.css'; 
import UserPostsList from '../components/UserPostsList.tsx';
import { useAuth } from '../context/AuthContext.tsx';

type ActiveTab = 'Публикации' | 'Карта' | 'Изменить' | '0 подписчиков' | '0 подписок';

const MainLayout: React.FC = () => {
    const { userId } = useParams<{ userId?: string }>();
    const { user: currentUser } = useAuth();
    const [activeContent, setActiveContent] = useState<ActiveTab>('Публикации');
    const [isOwner, setIsOwner] = useState(true);
    const [targetUserId, setTargetUserId] = useState<number | undefined>();
    
    useEffect(() => {
        if (userId) {
            const profileUserId = parseInt(userId);
            setIsOwner(currentUser?.id === profileUserId);
            setTargetUserId(profileUserId);
            console.log(`🔍 Profile: User ID from URL: ${userId}, Current User ID: ${currentUser?.id}, Is Owner: ${currentUser?.id === profileUserId}`);
        } else {
            setIsOwner(true);
            setTargetUserId(currentUser?.id);
            console.log(`🔍 Profile: No user ID in URL, using current user ID: ${currentUser?.id}`);
        }
    }, [userId, currentUser]);

    const handleTabChange = (tab: ActiveTab) => {
        setActiveContent(tab);
    };

    const renderContent = () => {
        console.log(`🎯 Rendering content: isOwner=${isOwner}, activeContent=${activeContent}, targetUserId=${targetUserId}`);
        
        if (!isOwner) {
            return (
                <div className="main-feed">
                    <UserPostsList targetUserId={targetUserId} />
                </div>
            );
        }

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
        
        return (
            <div className="main-feed">
                <UserPostsList targetUserId={targetUserId} />
            </div>
        );
    };

    return (
        <div className="app-container">
            <Sidebar />

            <main className="main-content">
                <div className="content-area">
                    <ProfileHeader 
                        onTabChange={handleTabChange}
                        isOwner={isOwner}
                        profileUserId={userId ? parseInt(userId) : currentUser?.id}
                    /> 
                    
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;