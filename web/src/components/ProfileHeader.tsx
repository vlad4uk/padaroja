// src/components/ProfileHeader.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx'; 
import '../components/MainLayout.css'; 

const DEFAULT_AVATAR = 'https://i.pravatar.cc/150';

type TabType = 'Публикации' | 'Карта' | 'Изменить' | '0 подписчиков' | '0 подписок';

interface ProfileHeaderProps {
    onTabChange: (tab: TabType) => void;
    isOwner: boolean;
    profileUserId?: number;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onTabChange, isOwner, profileUserId }) => {
    const { user: currentUser } = useAuth(); 
    const [profileUser, setProfileUser] = useState(currentUser);
    const [loading, setLoading] = useState(!isOwner);

    const [activeTab, setActiveTab] = useState<TabType>('Публикации');
    const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
    
    // Определяем доступные табы в зависимости от того, владелец ли
    const ownerTabs: TabType[] = ['Публикации', 'Карта', 'Изменить', '0 подписчиков', '0 подписок'];
    const guestTabs: TabType[] = ['Публикации', 'Карта', '0 подписчиков', '0 подписок'];
    
    const tabs = isOwner ? ownerTabs : guestTabs;
    
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]); 
    const tabsContainerRef = useRef<HTMLDivElement>(null); 

    // Загружаем данные профиля, если это не текущий пользователь
    useEffect(() => {
        if (!isOwner && profileUserId) {
            const fetchUserProfile = async () => {
                try {
                    const response = await fetch(`http://localhost:8080/api/user/${profileUserId}/profile`, {
                        credentials: 'include',
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        setProfileUser(userData);
                    }
                } catch (error) {
                    console.error('Ошибка при загрузке профиля:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchUserProfile();
        } else {
            setProfileUser(currentUser);
            setLoading(false);
        }
    }, [isOwner, profileUserId, currentUser]);

    const currentAvatarUrl = profileUser?.image_url || DEFAULT_AVATAR;
    const userName = profileUser?.username || (loading ? 'Загрузка...' : 'Пользователь');

    const handleTabClick = (tab: TabType, index: number) => {
        setActiveTab(tab);
        onTabChange(tab);
    };

    // ИСПРАВЛЕННАЯ ЛОГИКА: Используем useCallback и правильные зависимости
    useEffect(() => {
        const calculateLineStyle = () => {
            const activeRef = tabRefs.current[tabs.indexOf(activeTab)];
            if (activeRef && tabsContainerRef.current) {
                const tabsContainerLeft = tabsContainerRef.current.getBoundingClientRect().left;
                const activeTabRect = activeRef.getBoundingClientRect();
                
                setLineStyle({
                    left: activeTabRect.left - tabsContainerLeft,
                    width: activeTabRect.width,
                });
            }
        };

        // Добавляем небольшую задержку для корректного расчета позиций
        const timer = setTimeout(calculateLineStyle, 10);
        
        window.addEventListener('resize', calculateLineStyle);
        
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calculateLineStyle);
        };
    }, [activeTab, tabs]); // ✅ Только эти зависимости

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка профиля...</div>;
    }

    return (
        <div className="profile-section"> 
            
            <div className="profile-header"> 
                
                <div className="user-avatar"> 
                    <img 
                        src={currentAvatarUrl} 
                        alt={`${userName}'s avatar`} 
                    />
                </div>

                <div className="profile-info"> 
                    <h2 className="user-name">{userName}</h2>
                    {profileUser?.bio && <p className="user-bio">{profileUser.bio}</p>}
                </div>
            </div>

            <div className="profile-content">
                <div className="profile-tabs" ref={tabsContainerRef}>
                    <div 
                        className="profile-tab-active-line"
                        style={{ transform: `translateX(${lineStyle.left}px)`, width: `${lineStyle.width}px` }}
                    />
                    
                    {tabs.map((tab, index) => (
                        <button
                            key={tab}
                            className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab, index)}
                            ref={el => { tabRefs.current[index] = el; }}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                cursor: 'pointer',
                                padding: '10px 15px', 
                                margin: '0 20px 0 0', 
                                color: 'inherit',
                                fontSize: 'inherit'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProfileHeader;