// src/components/ProfileHeader.tsx (ФИНАЛЬНАЯ ВЕРСИЯ С ФИКСОМ ПРОПСОВ)

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx'; 
import '../components/MainLayout.css'; 

const DEFAULT_AVATAR = 'https://i.pravatar.cc/150';

type TabType = 'Публикации' | 'Карта' | 'Изменить' | '0 подписчиков' | '0 подписок';

// ✅ НОВЫЙ ИНТЕРФЕЙС ПРОПСОВ
interface ProfileHeaderProps {
    onTabChange: (tab: TabType) => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onTabChange }) => {
    const { user, isLoggedIn } = useAuth(); 

    const [activeTab, setActiveTab] = useState<TabType>('Публикации');
    const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
    
    const tabs: TabType[] = ['Публикации', 'Карта', 'Изменить', '0 подписчиков', '0 подписок'];
    
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]); 
    const tabsContainerRef = useRef<HTMLDivElement>(null); 

    const currentAvatarUrl = user?.image_url || DEFAULT_AVATAR;
    const userName = user?.username || (isLoggedIn ? 'User' : 'Гость');


    // ✅ ИЗМЕНЕННАЯ ЛОГИКА: Вызываем onTabChange, чтобы уведомить родителя
    const handleTabClick = (tab: TabType, index: number) => {
        setActiveTab(tab);
        onTabChange(tab); // 👈 Уведомляем MainLayout о смене вкладки
    };

    // Логика для смещения полоски под табами
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

        calculateLineStyle();
        window.addEventListener('resize', calculateLineStyle);
        return () => window.removeEventListener('resize', calculateLineStyle);
    }, [activeTab]);


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
                    {user?.bio && <p className="user-bio">{user.bio}</p>}
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