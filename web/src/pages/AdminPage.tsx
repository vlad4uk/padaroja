// AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './AdminPage.css';
import { FaUserPlus, FaUserMinus, FaChartLine, FaUsers, FaFileAlt, FaUserShield } from 'react-icons/fa';

// Интерфейсы
interface User {
    id: number;
    username: string;
    email: string;
    role_id: number;
    is_blocked: boolean;
    bio?: string;
    image_url?: string;
    created_at: string;
}

interface ModeratorWithHistory {
    id: number;
    username: string;
    email: string;
    role_id: number;
    is_blocked: boolean;
    assigned_at?: string;
    assigned_by?: string;
    complaint_count?: number;
    last_active?: string;
}

interface DashboardStats {
    total_users: number;
    new_users_this_week: number;
    users_growth_percent: number;
    total_posts: number;
    new_posts_this_week: number;
    posts_growth_percent: number;
    total_moderators: number;
    total_admins: number;
}

type TabType = 'dashboard' | 'all_users' | 'moderators' | 'manage_moderators';

const AdminPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [moderators, setModerators] = useState<ModeratorWithHistory[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [moderatorsLoading, setModeratorsLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [assignLoading, setAssignLoading] = useState<number | null>(null);
    const [removeLoading, setRemoveLoading] = useState<number | null>(null);
    const [blockLoading, setBlockLoading] = useState<number | null>(null);
    const [unblockLoading, setUnblockLoading] = useState<number | null>(null);
    
    const [assignSuccess, setAssignSuccess] = useState('');
    
    const navigate = useNavigate();

    // Загрузка статистики для дашборда
    const fetchDashboardStats = async () => {
        try {
            const response = await axios.get('/api/admin/stats', { withCredentials: true });
            setDashboardStats(response.data);
        } catch (err) {
            console.error('Ошибка загрузки статистики:', err);
            setError('Не удалось загрузить статистику');
        }
    };

    // Загрузка всех пользователей
    const fetchAllUsers = async () => {
        try {
            setUsersLoading(true);
            const response = await axios.get('/api/admin/users', { withCredentials: true });
            setAllUsers(response.data || []);
        } catch (err) {
            console.error('Ошибка загрузки пользователей:', err);
            setError('Не удалось загрузить список пользователей');
        } finally {
            setUsersLoading(false);
        }
    };

    // Загрузка модераторов с историей
    const fetchModerators = async () => {
        try {
            setModeratorsLoading(true);
            const response = await axios.get('/api/admin/moderators', { withCredentials: true });
            setModerators(response.data || []);
        } catch (err) {
            console.error('Ошибка загрузки модераторов:', err);
            setError('Не удалось загрузить список модераторов');
        } finally {
            setModeratorsLoading(false);
        }
    };

    // Поиск пользователей для назначения модератором
    const searchUsers = async () => {
        if (!searchQuery.trim()) {
            setError('Введите имя пользователя или email');
            return;
        }
        
        try {
            setLoading(true);
            setError('');
            const response = await axios.get(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`, { withCredentials: true });
            setSearchResults(response.data || []);
        } catch (err: any) {
            console.error('Ошибка поиска пользователей:', err);
            setError(err.response?.data?.error || 'Не удалось найти пользователей');
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Назначение модератора
    const assignModeratorRole = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите назначить пользователя "${username}" модератором?`)) return;
        
        try {
            setAssignLoading(userId);
            setAssignSuccess('');
            
            await axios.post(`/api/admin/users/${userId}/assign-moderator`, {}, { withCredentials: true });
            
            setAssignSuccess(`Пользователь "${username}" успешно назначен модератором!`);
            
            // Обновляем списки
            setSearchResults(prev => prev.map(user => user.id === userId ? { ...user, role_id: 2 } : user));
            await fetchModerators();
            await fetchDashboardStats();
            
            setTimeout(() => setAssignSuccess(''), 3000);
        } catch (err: any) {
            console.error('Ошибка назначения модератора:', err);
            alert(err.response?.data?.error || 'Не удалось назначить модератора');
        } finally {
            setAssignLoading(null);
        }
    };

    // Снятие модератора
    const removeModeratorRole = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите снять пользователя "${username}" с позиции модератора?`)) return;
        
        try {
            setRemoveLoading(userId);
            setAssignSuccess('');
            
            await axios.post(`/api/admin/users/${userId}/remove-moderator`, {}, { withCredentials: true });
            
            setAssignSuccess(`Пользователь "${username}" снят с позиции модератора!`);
            
            // Обновляем списки
            setSearchResults(prev => prev.map(user => user.id === userId ? { ...user, role_id: 1 } : user));
            await fetchModerators();
            await fetchAllUsers();
            await fetchDashboardStats();
            
            setTimeout(() => setAssignSuccess(''), 3000);
        } catch (err: any) {
            console.error('Ошибка снятия модератора:', err);
            alert(err.response?.data?.error || 'Не удалось снять модератора');
        } finally {
            setRemoveLoading(null);
        }
    };

    // Блокировка пользователя
    const blockUser = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите заблокировать пользователя "${username}"?`)) return;
        
        try {
            setBlockLoading(userId);
            await axios.post(`/api/admin/users/${userId}/block`, {}, { withCredentials: true });
            alert(`Пользователь "${username}" успешно заблокирован!`);
            await fetchAllUsers();
            await fetchModerators();
        } catch (err: any) {
            console.error('Ошибка блокировки пользователя:', err);
            alert(err.response?.data?.error || 'Не удалось заблокировать пользователя');
        } finally {
            setBlockLoading(null);
        }
    };

    // Разблокировка пользователя
    const unblockUser = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите разблокировать пользователя "${username}"?`)) return;
        
        try {
            setUnblockLoading(userId);
            await axios.post(`/api/admin/users/${userId}/unblock`, {}, { withCredentials: true });
            alert(`Пользователь "${username}" успешно разблокирован!`);
            await fetchAllUsers();
            await fetchModerators();
        } catch (err: any) {
            console.error('Ошибка разблокировки пользователя:', err);
            alert(err.response?.data?.error || 'Не удалось разблокировать пользователя');
        } finally {
            setUnblockLoading(null);
        }
    };

    const handleUserClick = (userId: number) => {
        navigate(`/user/${userId}`);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchDashboardStats();
        } else if (activeTab === 'all_users') {
            fetchAllUsers();
        } else if (activeTab === 'moderators') {
            fetchModerators();
        } else if (activeTab === 'manage_moderators') {
            setSearchQuery('');
            setSearchResults([]);
            setError('');
            setAssignSuccess('');
        }
    }, [activeTab]);

    // Рендер дашборда со статистикой
    const renderDashboard = () => {
        if (!dashboardStats) {
            return <div className="loading-state">Загрузка статистики...</div>;
        }

        return (
            <div className="dashboard-container">
                <div className="stats-cards">
                    <div className="stat-card">
                        <div className="stat-icon blue">
                            <FaUsers size={24} />
                        </div>
                        <div className="stat-info">
                            <h3>Всего пользователей</h3>
                            <div className="stat-value">{dashboardStats.total_users}</div>
                            <div className={`stat-change ${dashboardStats.users_growth_percent >= 0 ? 'positive' : 'negative'}`}>
                                {dashboardStats.users_growth_percent >= 0 ? '+' : ''}{dashboardStats.users_growth_percent}% за неделю
                            </div>
                            <div className="stat-detail">Новых: +{dashboardStats.new_users_this_week}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon green">
                            <FaFileAlt size={24} />
                        </div>
                        <div className="stat-info">
                            <h3>Всего постов</h3>
                            <div className="stat-value">{dashboardStats.total_posts}</div>
                            <div className={`stat-change ${dashboardStats.posts_growth_percent >= 0 ? 'positive' : 'negative'}`}>
                                {dashboardStats.posts_growth_percent >= 0 ? '+' : ''}{dashboardStats.posts_growth_percent}% за неделю
                            </div>
                            <div className="stat-detail">Новых: +{dashboardStats.new_posts_this_week}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon purple">
                            <FaUserShield size={24} />
                        </div>
                        <div className="stat-info">
                            <h3>Модераторы</h3>
                            <div className="stat-value">{dashboardStats.total_moderators}</div>
                            <div className="stat-detail">Активных модераторов</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon orange">
                            <FaUserShield size={24} />
                        </div>
                        <div className="stat-info">
                            <h3>Администраторы</h3>
                            <div className="stat-value">{dashboardStats.total_admins}</div>
                            <div className="stat-detail">Всего администраторов</div>
                        </div>
                    </div>
                </div>

                <div className="quick-actions">
                    <h3>Быстрые действия</h3>
                    <div className="action-buttons-grid">
                        <button className="quick-action-btn" onClick={() => setActiveTab('manage_moderators')}>
                            <FaUserPlus /> Назначить модератора
                        </button>
                        <button className="quick-action-btn" onClick={() => setActiveTab('moderators')}>
                            <FaUserShield /> Управление модераторами
                        </button>
                        <button className="quick-action-btn" onClick={() => setActiveTab('all_users')}>
                            <FaUsers /> Все пользователи
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Рендер таблицы всех пользователей
    const renderAllUsersTable = () => {
        if (usersLoading) return <div className="loading-state">Загрузка пользователей...</div>;
        if (!allUsers || allUsers.length === 0) return <div className="no-data">Пользователей не найдено</div>;

        return (
            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Пользователь</th>
                            <th>Email</th>
                            <th>Роль</th>
                            <th>Дата регистрации</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allUsers.map((user) => (
                            <tr key={user.id} className="user-row" onClick={() => handleUserClick(user.id)}>
                                <td>#{user.id}</td>
                                <td>
                                    <div className="user-info">
                                        {user.image_url ? (
                                            <img src={user.image_url} alt={user.username} className="user-avatar-small" />
                                        ) : (
                                            <div className="user-avatar-placeholder">{user.username[0]?.toUpperCase()}</div>
                                        )}
                                        <span className="username">{user.username}</span>
                                    </div>
                                </td>
                                <td>{user.email}</td>
                                <td>
                                    <span className={`role-badge ${user.role_id === 2 ? 'role-moderator' : user.role_id === 3 ? 'role-admin' : 'role-user'}`}>
                                        {user.role_id === 3 ? 'Администратор' : user.role_id === 2 ? 'Модератор' : 'Пользователь'}
                                    </span>
                                </td>
                                <td>{formatDate(user.created_at)}</td>
                                <td>
                                    <span className={`status-badge ${user.is_blocked ? 'status-blocked' : 'status-active'}`}>
                                        {user.is_blocked ? 'Заблокирован' : 'Активен'}
                                    </span>
                                </td>
                                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                                    <div className="action-buttons">
                                        {!user.is_blocked ? (
                                            <button 
                                                className="block-btn"
                                                onClick={() => blockUser(user.id, user.username)}
                                                disabled={blockLoading === user.id}
                                            >
                                                {blockLoading === user.id ? '...' : 'Заблокировать'}
                                            </button>
                                        ) : (
                                            <button 
                                                className="unblock-btn"
                                                onClick={() => unblockUser(user.id, user.username)}
                                                disabled={unblockLoading === user.id}
                                            >
                                                {unblockLoading === user.id ? '...' : 'Разблокировать'}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Рендер таблицы модераторов с историей
    const renderModeratorsTable = () => {
        if (moderatorsLoading) return <div className="loading-state">Загрузка модераторов...</div>;
        if (!moderators || moderators.length === 0) return <div className="no-data">Модераторов не найдено</div>;

        return (
            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Модератор</th>
                            <th>Email</th>
                            <th>Дата назначения</th>
                            <th>Кем назначен</th>
                            <th>Жалоб обработано</th>
                            <th>Последняя активность</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {moderators.map((mod) => (
                            <tr key={mod.id} className="user-row" onClick={() => handleUserClick(mod.id)}>
                                <td>#{mod.id}</td>
                                <td>
                                    <div className="user-info">
                                        <span className="username">{mod.username}</span>
                                    </div>
                                </td>
                                <td>{mod.email}</td>
                                <td>{formatDate(mod.assigned_at)}</td>
                                <td>{mod.assigned_by || '—'}</td>
                                <td className="text-center">{mod.complaint_count || 0}</td>
                                <td>{formatDate(mod.last_active)}</td>
                                <td>
                                    <span className={`status-badge ${mod.is_blocked ? 'status-blocked' : 'status-active'}`}>
                                        {mod.is_blocked ? 'Заблокирован' : 'Активен'}
                                    </span>
                                </td>
                                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                                    <div className="action-buttons">
                                        <button 
                                            className="remove-moderator-btn"
                                            onClick={() => removeModeratorRole(mod.id, mod.username)}
                                            disabled={removeLoading === mod.id}
                                        >
                                            {removeLoading === mod.id ? '...' : 'Снять'}
                                        </button>
                                        {!mod.is_blocked ? (
                                            <button 
                                                className="block-btn"
                                                onClick={() => blockUser(mod.id, mod.username)}
                                                disabled={blockLoading === mod.id}
                                            >
                                                {blockLoading === mod.id ? '...' : 'Заблокировать'}
                                            </button>
                                        ) : (
                                            <button 
                                                className="unblock-btn"
                                                onClick={() => unblockUser(mod.id, mod.username)}
                                                disabled={unblockLoading === mod.id}
                                            >
                                                {unblockLoading === mod.id ? '...' : 'Разблокировать'}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Рендер формы назначения модераторов
    const renderManageModerators = () => {
        return (
            <div className="manage-moderators-container">
                <div className="search-section">
                    <div className="search-header">
                        <h3>Найти пользователя</h3>
                        <p>Поиск по имени пользователя или email для назначения модератором</p>
                    </div>
                    
                    <div className="search-input-group">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Введите имя пользователя или email"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                        />
                        <button className="search-button" onClick={searchUsers} disabled={loading || !searchQuery.trim()}>
                            {loading ? 'Поиск...' : 'Найти'}
                        </button>
                    </div>
                    
                    {error && <div className="search-error">{error}</div>}
                    {assignSuccess && <div className="assign-success">{assignSuccess}</div>}
                </div>

                {searchResults.length > 0 && (
                    <div className="search-results">
                        <div className="results-header">
                            <h3>Результаты поиска</h3>
                            <div className="results-count">{searchResults.length} пользователей найдено</div>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Пользователь</th>
                                    <th>Email</th>
                                    <th>Текущая роль</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>
                                            <div className="user-info">
                                                {user.image_url ? (
                                                    <img src={user.image_url} alt={user.username} className="user-avatar-small" />
                                                ) : (
                                                    <div className="user-avatar-placeholder">{user.username[0]?.toUpperCase()}</div>
                                                )}
                                                <span className="username">{user.username}</span>
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-badge ${user.role_id === 2 ? 'role-moderator' : 'role-user'}`}>
                                                {user.role_id === 2 ? 'Модератор' : 'Пользователь'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.is_blocked ? 'status-blocked' : 'status-active'}`}>
                                                {user.is_blocked ? 'Заблокирован' : 'Активен'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <div className="action-buttons">
                                                {user.role_id === 2 ? (
                                                    <button
                                                        className="remove-moderator-btn"
                                                        onClick={() => removeModeratorRole(user.id, user.username)}
                                                        disabled={removeLoading === user.id || user.is_blocked}
                                                    >
                                                        {removeLoading === user.id ? 'Снятие...' : 'Снять'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="assign-moderator-btn"
                                                        onClick={() => assignModeratorRole(user.id, user.username)}
                                                        disabled={assignLoading === user.id || user.is_blocked}
                                                    >
                                                        {assignLoading === user.id ? 'Назначение...' : 'Назначить'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {searchResults.length === 0 && searchQuery && !loading && (
                    <div className="no-results">
                        <div className="no-results-icon">🔍</div>
                        <div>Пользователи не найдены</div>
                    </div>
                )}

                {!searchQuery && !loading && searchResults.length === 0 && (
                    <div className="search-hint">
                        <div className="hint-icon">👤</div>
                        <p>Введите имя пользователя или email для поиска</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <ContentLayout>
            <div className="admin-container">
                <div className="admin-header-tabs">
                    <div className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                        <FaChartLine /> Дашборд
                    </div>
                    <div className={`admin-tab ${activeTab === 'all_users' ? 'active' : ''}`} onClick={() => setActiveTab('all_users')}>
                        <FaUsers /> Все пользователи
                    </div>
                    <div className={`admin-tab ${activeTab === 'moderators' ? 'active' : ''}`} onClick={() => setActiveTab('moderators')}>
                        <FaUserShield /> Модераторы
                    </div>
                    <div className={`admin-tab ${activeTab === 'manage_moderators' ? 'active' : ''}`} onClick={() => setActiveTab('manage_moderators')}>
                        <FaUserPlus /> Назначить модератора
                    </div>
                </div>

                <div className="admin-content">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'all_users' && renderAllUsersTable()}
                    {activeTab === 'moderators' && renderModeratorsTable()}
                    {activeTab === 'manage_moderators' && renderManageModerators()}
                </div>
            </div>
        </ContentLayout>
    );
};

export default AdminPage;