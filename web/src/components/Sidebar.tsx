// src/components/Sidebar.tsx

import React from 'react';
import { FaSearch, FaListAlt, FaBookmark, FaBell, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaCog, FaPlusSquare, FaAdn } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; 
import '../components/MainLayout.css'; 
import profileIcon from '../assets/sidebar-icons/profile.png'
import searchIcon from '../assets/sidebar-icons/search.png'
import favorIcon from '../assets/sidebar-icons/favor.png'
import bookmarkIcon from '../assets/sidebar-icons/bookmark.png'
import createIcon from '../assets/sidebar-icons/create.png'
import adminIcon from '../assets/sidebar-icons/admin.png'
import rulesIcon from '../assets/sidebar-icons/list.png'
import exitIcon from '../assets/sidebar-icons/exit.png'



interface NavItem {
    name: string;
    icon: React.ElementType;
    link: string;
    authRequired: boolean;
    adminOnly?: boolean; // 👈 Добавили флаг для админа/модератора
}

const navItemsList: NavItem[] = [
    { name: 'Профиль', icon: () => <img src={profileIcon} alt="profile" className="sidebar-icon" />, link: '/profile', authRequired: true },
    { name: 'Поиск', icon: () => <img src={searchIcon} alt="profile" className="sidebar-icon" />,  link: '/search', authRequired: false },
    { name: 'Мне нравится', icon: () => <img src={favorIcon} alt="profile" className="sidebar-icon" />, link: '/subscriptions', authRequired: true },
    { name: 'Избранное', icon: () => <img src={bookmarkIcon} alt="profile" className="sidebar-icon" />, link: '/bookmarks', authRequired: true },
    { name: 'Создать Пост',icon: () => <img src={createIcon} alt="profile" className="sidebar-icon" />, link: '/post/new', authRequired: true },
    { name: 'Админ Панель', icon: () => <img src={adminIcon} alt="profile" className="sidebar-icon" />, link: '/admin', authRequired: true, adminOnly: true },
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
                <span style={{ fontWeight: 700 }}>Padaroja.</span>
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
                        <Link to={'/settings'} className={`sidebar-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}>
                            <img src={rulesIcon} alt="rulesIcon" className="sidebar-icon" />
                            Правила
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