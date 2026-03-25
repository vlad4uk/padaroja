import React, { useState, useEffect } from 'react'; 
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import ProfileHeader from '../components/ProfileHeader.tsx';
import ProfileEditForm from '../components/ProfileEditForm.tsx'; 
import MapView from '../components/MapView.tsx'; 
import '../components/MainLayout.css'; 
import UserPostsList from '../components/UserPostsList.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export type TabType = 'Публикации' | 'Карта' | 'Изменить';

const MainLayout: React.FC = () => {
    const { userId } = useParams<{ userId?: string }>();
    const { user: currentUser } = useAuth();
    const [activeContent, setActiveContent] = useState<TabType>('Карта');
    const [isOwner, setIsOwner] = useState(true);
    const [targetUserId, setTargetUserId] = useState<number | undefined>();
    
    useEffect(() => {
        if (userId) {
            const profileUserId = parseInt(userId);
            setIsOwner(currentUser?.id === profileUserId);
            setTargetUserId(profileUserId);
        } else {
            setIsOwner(true);
            setTargetUserId(currentUser?.id);
        }
    }, [userId, currentUser]);

    const getAvailableTabs = (): TabType[] => {
        if (isOwner) {
            return ['Карта', 'Публикации', 'Изменить'];
        }
        return ['Карта', 'Публикации'];
    };

    const handleTabChange = (tab: TabType) => {
        setActiveContent(tab);
    };

    const renderContent = () => {
        switch (activeContent) {
            case 'Изменить':
            if (!isOwner) return null;
            return (
                <div className="profile-edit-form-container">
                <ProfileEditForm /> 
                </div>
            );
            case 'Карта':
            return <MapView targetUserId={targetUserId} />; 
            case 'Публикации':
            default:
            return (
                <div className="main-feed">
                <UserPostsList targetUserId={targetUserId} />
                </div>
            );
        }
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
                        availableTabs={getAvailableTabs()}
                        activeTab={activeContent}
                    /> 
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;