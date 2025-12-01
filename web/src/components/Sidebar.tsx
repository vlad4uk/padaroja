// src/components/Sidebar.tsx

import React from 'react';
import { FaUser, FaSearch, FaListAlt, FaBookmark, FaBell, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaCog, FaPlusSquare, FaAdn } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; 
import '../components/MainLayout.css'; 

interface NavItem {
    name: string;
    icon: React.ElementType;
    link: string;
    authRequired: boolean;
    adminOnly?: boolean; // 👈 Добавили флаг для админа/модератора
}

const navItemsList: NavItem[] = [
    { name: 'Профиль', icon: FaUser, link: '/profile', authRequired: true },
    { name: 'Поиск', icon: FaSearch, link: '/search', authRequired: false },
    { name: 'Мне нравится', icon: FaListAlt, link: '/subscriptions', authRequired: true },
    { name: 'Избранное', icon: FaBookmark, link: '/bookmarks', authRequired: true },
    { name: 'Уведомления', icon: FaBell, link: '/notifications', authRequired: true },
    { name: 'Создать Пост', icon: FaPlusSquare, link: '/post/new', authRequired: true },
    // 👇 Этот пункт теперь помечен как adminOnly
    { name: 'Админ Панель', icon: FaAdn, link: '/admin', authRequired: true, adminOnly: true },
];

const Sidebar: React.FC = () => { 
    const { isLoggedIn, logout, user } = useAuth(); // 👈 Достаем user чтобы проверить роль
    const navigate = useNavigate();
    const location = useLocation();
    
    const handleLogout = async () => {
        await logout(); 
        navigate('/login'); 
    };

    // Проверка: является ли юзер модератором (предположим role_id === 2)
    const isModerator = user?.role_id === 2;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <span style={{ fontWeight: 700, color: '#696cff' }}>Padaroja.</span>
            </div>
            
            <nav className="sidebar-nav-list">
                {navItemsList
                    .filter(item => {
                        // 1. Если требуется авторизация и юзер не вошел -> скрываем
                        if (item.authRequired && !isLoggedIn) return false;
                        // 2. Если это пункт для админа, но юзер не админ -> скрываем
                        if (item.adminOnly && !isModerator) return false;
                        
                        return true;
                    })
                    .map((item) => (
                    <Link 
                        key={item.link}
                        to={item.link}
                        className={`sidebar-nav-item ${location.pathname === item.link ? 'active' : ''}`}
                        title={item.name} 
                    >
                        <item.icon className="sidebar-icon" />
                        {item.name}
                    </Link>
                ))}
            </nav>
            
            <div className="sidebar-nav-list bottom-nav"> 
                {isLoggedIn ? (
                    <>
                        <Link 
                            to={'/settings'}
                            className={`sidebar-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
                        >
                            <FaCog className="sidebar-icon" />
                            Настройки
                        </Link>
                        <div 
                            className="sidebar-nav-item" 
                            onClick={handleLogout} 
                            style={{ color: 'red', fontWeight: 600, cursor: 'pointer' }}
                        >
                            <FaSignOutAlt className="sidebar-icon" />
                            Выход
                        </div>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="sidebar-nav-item">
                            <FaSignInAlt className="sidebar-icon" />
                            Вход
                        </Link>
                        <Link to="/register" className="sidebar-nav-item">
                            <FaUserPlus className="sidebar-icon" />
                            Регистрация
                        </Link>
                    </>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;