import React from 'react';
import { FaSearch, FaSignOutAlt, FaSignInAlt, FaUserPlus } from 'react-icons/fa';
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
import mapIcon from '../assets/sidebar-icons/map.png'

interface NavItem {
    name: string;
    icon: React.ElementType;
    link: string;
    authRequired: boolean;
    adminOnly?: boolean; 
}

const navItemsList: NavItem[] = [
    { name: 'Профиль', icon: () => <img src={profileIcon} alt="profile" className="sidebar-icon" />, link: '/profile', authRequired: true },
    { name: 'Поиск', icon: () => <img src={searchIcon} alt="search" className="sidebar-icon" />, link: '/search', authRequired: false },
    { name: 'Карта мест', icon: () => <img src={mapIcon} alt="map" className="sidebar-icon" />, link: '/map/all', authRequired: false }, // Новая ссылка
    { name: 'Мне нравится', icon: () => <img src={favorIcon} alt="favorites" className="sidebar-icon" />, link: '/subscriptions', authRequired: true },
    { name: 'Избранное', icon: () => <img src={bookmarkIcon} alt="bookmarks" className="sidebar-icon" />, link: '/bookmarks', authRequired: true },
    { name: 'Создать Пост', icon: () => <img src={createIcon} alt="create" className="sidebar-icon" />, link: '/post/new', authRequired: true },
    { name: 'Админ Панель', icon: () => <img src={adminIcon} alt="admin" className="sidebar-icon" />, link: '/admin', authRequired: true, adminOnly: true },
];

const Sidebar: React.FC = () => { 
    let isLoggedIn = false;
    let user = null;
    let logout = async () => {};
    
    // Безопасно получаем контекст
    try {
        const auth = useAuth();
        isLoggedIn = auth.isLoggedIn;
        user = auth.user;
        logout = auth.logout;
    } catch (error) {
        console.log('Auth context not available in Sidebar, using defaults');
    }
    
    const navigate = useNavigate();
    const location = useLocation();
    
    const handleLogout = async () => {
        await logout(); 
        navigate('/login'); 
    };

    const isModerator = user?.role_id === 2;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <span style={{ fontWeight: 700 }}>Padaroja</span>
            </div>
            
            <nav className="sidebar-nav-list">
                {navItemsList
                    .filter(item => {
                        if (item.authRequired && !isLoggedIn) return false;
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
                            <img src={rulesIcon} alt="rules" className="sidebar-icon" />
                            Правила
                        </Link>
                        <div 
                            className="sidebar-nav-item" 
                            onClick={handleLogout} 
                            style={{ color: 'red', fontWeight: 600, cursor: 'pointer' }}
                        >
                            <img src={exitIcon} alt="exit" className="sidebar-icon" />
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