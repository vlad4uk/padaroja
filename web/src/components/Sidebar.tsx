import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import axios from 'axios';

// Импорты иконок
import { FaSearch, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaHome, FaHeart, FaBookmark, FaPlusCircle, FaShieldAlt, FaMapMarkedAlt, FaBell, FaUserShield } from 'react-icons/fa';

const Sidebar: React.FC = () => {
    const [invitesCount, setInvitesCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    const navigate = useNavigate();
    const location = useLocation();
    
    // Получаем данные авторизации
    const auth = useAuth();
    const isLoggedIn = auth.isLoggedIn;
    const user = auth.user;
    const logout = auth.logout;
    
    const isAdmin = user?.role_id === 3;      // Администратор
    const isModerator = user?.role_id === 2;   // Модератор
    
    // Загрузка количества приглашений
    const fetchInvitesCount = async () => {
        if (!isLoggedIn) return;
        
        setIsLoading(true);
        try {
            const response = await axios.get('/api/posts/invites/count', {
                withCredentials: true,
                timeout: 5000
            });
            setInvitesCount(response.data.count || 0);
        } catch (error) {
            console.error('Ошибка загрузки количества приглашений:', error);
            try {
                const pendingResponse = await axios.get('/api/posts/invites/pending', {
                    withCredentials: true,
                    timeout: 5000
                });
                setInvitesCount(pendingResponse.data.count || 0);
            } catch (fallbackError) {
                setInvitesCount(0);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (isLoggedIn) {
            fetchInvitesCount();
            const interval = setInterval(fetchInvitesCount, 60000);
            return () => clearInterval(interval);
        } else {
            setInvitesCount(0);
        }
    }, [isLoggedIn]);
    
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };
    
    // Стили для активного пункта меню
    const getLinkStyle = (path: string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        marginBottom: '8px',
        borderRadius: '12px',
        textDecoration: 'none',
        color: location.pathname === path ? '#696cff' : '#333',
        backgroundColor: location.pathname === path ? '#f0f0ff' : 'transparent',
        fontWeight: location.pathname === path ? '600' : '500',
        transition: 'all 0.2s ease'
    });
    
    // Элементы меню
    const mainNavItems = [
        { path: '/profile', label: 'Профиль', icon: <FaHome />, authRequired: true },
        { path: '/search', label: 'Поиск', icon: <FaSearch />, authRequired: false },
        { path: '/map/all', label: 'Карта мест', icon: <FaMapMarkedAlt />, authRequired: false },
        { path: '/subscriptions', label: 'Мне нравится', icon: <FaHeart />, authRequired: true },
        { path: '/bookmarks', label: 'Избранное', icon: <FaBookmark />, authRequired: true },
        { path: '/post/new', label: 'Создать Пост', icon: <FaPlusCircle />, authRequired: true },
    ];
    
    return (
        <div style={{
            width: '280px',
            height: '100vh',
            position: 'sticky',
            top: 0,
            backgroundColor: '#fff',
            borderRight: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 16px'
        }}>
            {/* Логотип */}
            <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#696cff',
                marginBottom: '30px',
                padding: '0 16px'
            }}>
                Padaroja
            </div>
            
            {/* Основная навигация */}
            <nav style={{ flex: 1 }}>
                {mainNavItems
                    .filter(item => !item.authRequired || isLoggedIn)
                    .map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={getLinkStyle(item.path)}
                            onMouseEnter={(e) => {
                                if (location.pathname !== item.path) {
                                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (location.pathname !== item.path) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                        >
                            <span style={{ fontSize: '20px' }}>{item.icon}</span>
                            <span style={{ flex: 1 }}>{item.label}</span>
                        </Link>
                    ))}
                
                {/* События с бейджем */}
                {isLoggedIn && (
                    <Link
                        to="/invites"
                        style={getLinkStyle('/invites')}
                        onMouseEnter={(e) => {
                            if (location.pathname !== '/invites') {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (location.pathname !== '/invites') {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        <span style={{ fontSize: '20px' }}><FaBell /></span>
                        <span style={{ flex: 1 }}>События</span>
                        {invitesCount > 0 && (
                            <span style={{
                                backgroundColor: '#e74c3c',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                minWidth: '20px',
                                textAlign: 'center'
                            }}>
                                {invitesCount > 99 ? '99+' : invitesCount}
                            </span>
                        )}
                        {isLoading && (
                            <span style={{
                                fontSize: '12px',
                                color: '#999'
                            }}>
                                ...
                            </span>
                        )}
                    </Link>
                )}
                
                {/* Панель модератора - доступна только модераторам */}
                {isModerator && !isAdmin && (
                    <Link
                        to="/admin"
                        style={getLinkStyle('/admin')}
                        onMouseEnter={(e) => {
                            if (location.pathname !== '/admin') {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (location.pathname !== '/admin') {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        <span style={{ fontSize: '20px' }}><FaShieldAlt /></span>
                        <span style={{ flex: 1 }}>Панель модератора</span>
                    </Link>
                )}
                
                {/* Админ панель - доступна только администраторам */}
                {isAdmin && (
                    <Link
                        to="/adminpanel"
                        style={getLinkStyle('/adminpanel')}
                        onMouseEnter={(e) => {
                            if (location.pathname !== '/adminpanel') {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (location.pathname !== '/adminpanel') {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        <span style={{ fontSize: '20px' }}><FaUserShield /></span>
                        <span style={{ flex: 1 }}>Панель администратора</span>
                    </Link>
                )}
            </nav>
            
            {/* Нижняя секция */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                {isLoggedIn ? (
                    <>
                        <Link
                            to="/settings"
                            style={getLinkStyle('/settings')}
                            onMouseEnter={(e) => {
                                if (location.pathname !== '/settings') {
                                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (location.pathname !== '/settings') {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                        >
                            <span style={{ fontSize: '20px' }}>⚙️</span>
                            <span style={{ flex: 1 }}>Правила</span>
                        </Link>
                        
                        <div
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                color: '#e74c3c',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fee';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span style={{ fontSize: '20px' }}><FaSignOutAlt /></span>
                            <span>Выход</span>
                        </div>
                    </>
                ) : (
                    <>
                        <Link
                            to="/login"
                            style={getLinkStyle('/login')}
                        >
                            <span style={{ fontSize: '20px' }}><FaSignInAlt /></span>
                            <span>Вход</span>
                        </Link>
                        <Link
                            to="/register"
                            style={getLinkStyle('/register')}
                        >
                            <span style={{ fontSize: '20px' }}><FaUserPlus /></span>
                            <span>Регистрация</span>
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};

export default Sidebar;