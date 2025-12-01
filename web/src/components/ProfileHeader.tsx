// src/components/ProfileHeader.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx'; 
import FollowersModal from './FollowersModal.tsx';
import '../components/MainLayout.css'; 
import '../components/FollowersModal.css';

const DEFAULT_AVATAR = 'https://i.pravatar.cc/150';

// Импортируем тип из MainLayout
export type TabType = 'Публикации' | 'Карта' | 'Изменить';

interface ProfileHeaderProps {
    onTabChange: (tab: TabType) => void;
    isOwner: boolean;
    profileUserId?: number;
    availableTabs: TabType[];
    activeTab: TabType;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ 
    onTabChange, 
    isOwner, 
    profileUserId, 
    availableTabs,
    activeTab 
}) => {
    const { user: currentUser } = useAuth(); 
    const [profileUser, setProfileUser] = useState(currentUser);
    const [loading, setLoading] = useState(!isOwner);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'followers' | 'following'>('followers');
    const [followLoading, setFollowLoading] = useState(false);

    const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
    
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]); 
    const tabsContainerRef = useRef<HTMLDivElement>(null); 

    // Загружаем данные профиля
    useEffect(() => {
        if (!isOwner && profileUserId) {
            fetchUserProfile();
        } else {
            setProfileUser(currentUser);
            setLoading(false);
        }
    }, [isOwner, profileUserId, currentUser]);

    // Загружаем данные о подписках
    useEffect(() => {
        if (profileUser?.id) {
            fetchFollowData();
        }
    }, [profileUser]);

    // Расчет позиции активной линии табов
    useEffect(() => {
        const calculateLineStyle = () => {
            const activeIndex = availableTabs.indexOf(activeTab);
            const activeRef = tabRefs.current[activeIndex];
            if (activeRef && tabsContainerRef.current) {
                const tabsContainerLeft = tabsContainerRef.current.getBoundingClientRect().left;
                const activeTabRect = activeRef.getBoundingClientRect();
                
                setLineStyle({
                    left: activeTabRect.left - tabsContainerLeft,
                    width: activeTabRect.width,
                });
            }
        };

        const timer = setTimeout(calculateLineStyle, 10);
        window.addEventListener('resize', calculateLineStyle);
        
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calculateLineStyle);
        };
    }, [activeTab, availableTabs]);

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

    const fetchFollowData = async () => {
        if (!profileUser?.id) return;

        try {
            // Получаем количество подписчиков и подписок
            const [followersRes, followingRes] = await Promise.all([
                fetch(`http://localhost:8080/api/user/${profileUser.id}/followers/count`, {
                    credentials: 'include',
                }),
                fetch(`http://localhost:8080/api/user/${profileUser.id}/following/count`, {
                    credentials: 'include',
                })
            ]);

            if (followersRes.ok) {
                const followersData = await followersRes.json();
                setFollowersCount(followersData.followers_count || 0);
            }

            if (followingRes.ok) {
                const followingData = await followingRes.json();
                setFollowingCount(followingData.following_count || 0);
            }

            // Проверяем, подписан ли текущий пользователь
            if (currentUser && currentUser.id !== profileUser.id) {
                const followCheckRes = await fetch(
                    `http://localhost:8080/api/user/${profileUser.id}/follow/check`, 
                    { credentials: 'include' }
                );
                if (followCheckRes.ok) {
                    const checkData = await followCheckRes.json();
                    setIsFollowing(checkData.is_following || false);
                }
            }
        } catch (error) {
            console.error('Error fetching follow data:', error);
        }
    };

    const handleFollow = async () => {
        if (!profileUser || !currentUser) return;

        setFollowLoading(true);
        try {
            if (isFollowing) {
                // Отписываемся
                await fetch(`http://localhost:8080/api/user/${profileUser.id}/follow`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                // Подписываемся
                await fetch(`http://localhost:8080/api/user/${profileUser.id}/follow`, {
                    method: 'POST',
                    credentials: 'include',
                });
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error updating follow status:', error);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleTabClick = (tab: TabType, index: number) => {
        onTabChange(tab);
    };

    const openFollowersModal = () => {
        setModalType('followers');
        setModalOpen(true);
    };

    const openFollowingModal = () => {
        setModalType('following');
        setModalOpen(true);
    };

    if (loading) {
        return (
            <div className="profile-section">
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    Загрузка профиля...
                </div>
            </div>
        );
    }

    const currentAvatarUrl = profileUser?.image_url || DEFAULT_AVATAR;
    const userName = profileUser?.username || 'Пользователь';

    return (
        <div className="profile-section"> 
            <div className="profile-header"> 
                {/* Аватар слева */}
                <div className="user-avatar"> 
                    <img 
                        src={currentAvatarUrl} 
                        alt={`${userName}'s avatar`} 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                        }}
                    />
                </div>

                {/* Основная информация справа */}
                <div className="profile-info"> 
                    {/* Верхняя строка профиля */}
                    <div className="profile-top-row">
                        {/* Левая часть: имя и био */}
                        <div className="profile-left">
                            <h2 className="user-name">{userName}</h2>
                            {profileUser?.bio && (
                                <p className="user-bio">{profileUser.bio}</p>
                            )}
                        </div>
                        
                        {/* Правая часть: статистика и кнопка подписки */}
                        <div className="profile-right">
                            {/* Статистика подписчиков/подписок в строку */}
                            <div className="follow-stats">
                                <button 
                                    className="stat-item" 
                                    onClick={openFollowersModal}
                                    title="Посмотреть подписчиков"
                                >
                                    <strong>{followersCount}</strong> подписчиков
                                </button>
                                
                                <button 
                                    className="stat-item" 
                                    onClick={openFollowingModal}
                                    title="Посмотреть подписки"
                                >
                                    <strong>{followingCount}</strong> подписок
                                </button>
                            </div>

                            {/* Кнопка подписки */}
                            {!isOwner && currentUser && currentUser.id !== profileUser?.id && (
                                <button 
                                    className={`follow-button ${isFollowing ? 'unfollow' : 'follow'}`}
                                    onClick={handleFollow}
                                    disabled={followLoading}
                                >
                                    {followLoading ? '...' : isFollowing ? 'Отписаться' : 'Подписаться'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Навигационные табы */}
            <div className="profile-content">
                <div className="profile-tabs" ref={tabsContainerRef}>
                    <div 
                        className="profile-tab-active-line"
                        style={{ 
                            transform: `translateX(${lineStyle.left}px)`, 
                            width: `${lineStyle.width}px` 
                        }}
                    />
                    
                    {availableTabs.map((tab, index) => (
                        <button
                            key={tab}
                            className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab, index)}
                            ref={el => { tabRefs.current[index] = el; }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <FollowersModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                userId={profileUser?.id || 0}
                type={modalType}
            />
        </div>
    );
};

export default ProfileHeader;