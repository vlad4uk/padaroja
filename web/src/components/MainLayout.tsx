// [file name]: MainLayout.tsx
import React, { useState, useEffect } from 'react'; 
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import ProfileHeader from '../components/ProfileHeader.tsx';
import ProfileEditForm from '../components/ProfileEditForm.tsx'; 
import MapView from '../components/MapView.tsx'; 
import '../components/MainLayout.css'; 
import UserPostsList from '../components/UserPostsList.tsx';
import { useAuth } from '../context/AuthContext.tsx';

type ActiveTab = 'Публикации' | 'Карта' | 'Изменить';

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
        } else {
            setIsOwner(true);
            setTargetUserId(currentUser?.id);
        }
    }, [userId, currentUser]);

    const handleTabChange = (tab: ActiveTab) => {
        setActiveContent(tab);
    };

    const renderContent = () => {
        if (!isOwner) {
            return (
                <div className="main-feed">
                    <UserPostsList targetUserId={targetUserId} />
                </div>
            );
        }

        switch (activeContent) {
            case 'Изменить':
                return (
                    <div className="profile-edit-form-container">
                        <ProfileEditForm /> 
                    </div>
                );
            case 'Карта':
                return (
                    <div className="profile-edit-form-container" style={{ padding: 0, border: 'none', background: 'none', marginTop: 0 }}>
                        <MapView />
                    </div>
                );
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
                    /> 
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;