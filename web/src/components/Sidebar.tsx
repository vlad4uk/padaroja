// src/components/Sidebar.tsx (ОБНОВЛЕННЫЙ КОД)

import React, { useState, useEffect } from 'react';
// Оставляем react-icons, т.к. мы их стилизовали в CSS
import { FaUser, FaSearch, FaListAlt, FaBookmark, FaBell, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaCog, FaPlusSquare } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; 
import '../components/MainLayout.css'; 

interface NavItem {
    name: string;
    icon: React.ElementType;
    link: string;
    authRequired: boolean;
}

const navItemsList: NavItem[] = [
    { name: 'Профиль', icon: FaUser, link: '/profile', authRequired: true },
    { name: 'Поиск', icon: FaSearch, link: '/search', authRequired: false },
    { name: 'Подписки', icon: FaListAlt, link: '/subscriptions', authRequired: true },
    { name: 'Закладки', icon: FaBookmark, link: '/bookmarks', authRequired: true },
    { name: 'Уведомления', icon: FaBell, link: '/notifications', authRequired: true },
   // ✅ ДОБАВЛЕНИЕ НОВОГО ПУНКТА МЕНЮ
    { name: 'Создать Пост', icon: FaPlusSquare, link: '/post/new', authRequired: true },
];

const Sidebar: React.FC = () => { 
    const { isLoggedIn, logout, checkAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    useEffect(() => {
        // checkAuth(); // 💡 Примечание: checkAuth уже вызывается в AuthProvider, возможно, здесь он не нужен
    }, [checkAuth]);
    
    const handleLogout = async () => {
        await logout(); 
        navigate('/login'); 
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <span style={{ fontWeight: 700, color: '#696cff' }}>Padaroznik.</span>
            </div>
            
            <nav className="sidebar-nav-list">
                {navItemsList
                    .filter(item => !item.authRequired || isLoggedIn)
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

            {/* 💡 НОВАЯ КНОПКА "Твитнуть" (стилизуется как save-button из вашего CSS) */}
            <button 
                className="save-button" 
                style={{ width: '90%', padding: '16px', marginTop: '15px', borderRadius: '9999px', fontSize: '17px' }}
            >
                Написать
            </button>
            
            {/* Блок "Настройки" / "Выход" (теперь прижат к низу благодаря margin-top: auto в CSS) */}
            <div className="sidebar-nav-list bottom-nav"> 
                {isLoggedIn ? (
                    <>
                        <Link 
                            to={'/settings'}
                            className={`sidebar-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
                            title={'Настройки'}
                        >
                            <FaCog className="sidebar-icon" />
                            Настройки
                        </Link>
                        <div 
                            className="sidebar-nav-item" 
                            onClick={handleLogout} 
                            style={{ color: 'red', fontWeight: 600 }}
                            title={'Выход'}
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