// src/pages/ModeratorPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './ModeratorPage.css';

// --- ИНТЕРФЕЙСЫ ---
interface Complaint {
    id: string;
    post_id: number;
    post_title: string;
    author: string;
    reason: string;
    status: 'NEW' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
    created_at: string;
    complaint_count: number;
    is_approved: boolean;
}

interface UserSearchResult {
    id: number;
    username: string;
    email: string;
    role_id: number;
    is_blocked: boolean;
}

interface UserWithComplaints {
    id: number;
    username: string;
    email: string;
    role_id: number;
    is_blocked: boolean;
    total_complaints: number;
    active_complaints: number;
    resolved_complaints: number;
    rejected_complaints: number;
    last_complaint_date: string;
}

type TabType = 'content' | 'users' | 'add_mod';

const ModeratorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [usersWithComplaints, setUsersWithComplaints] = useState<UserWithComplaints[]>([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [error, setError] = useState('');
    const [usersError, setUsersError] = useState('');
    const navigate = useNavigate();
    
    // Состояния для добавления модератора
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [assignLoading, setAssignLoading] = useState<number | null>(null);
    const [removeLoading, setRemoveLoading] = useState<number | null>(null);
    const [blockLoading, setBlockLoading] = useState<number | null>(null);
    const [unblockLoading, setUnblockLoading] = useState<number | null>(null);
    const [assignSuccess, setAssignSuccess] = useState('');

    // Загрузка жалоб
    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:8080/api/mod/complaints', {
                withCredentials: true
            });
            setComplaints(response.data);
            setError('');
        } catch (err) {
            console.error('Ошибка загрузки жалоб:', err);
            setError('Не удалось загрузить список жалоб');
        } finally {
            setLoading(false);
        }
    };

    // Загрузка пользователей с жалобами
    const fetchUsersWithComplaints = async () => {
        try {
            setUsersLoading(true);
            const response = await axios.get('http://localhost:8080/api/mod/users-with-complaints', {
                withCredentials: true
            });
            setUsersWithComplaints(response.data);
            setUsersError('');
        } catch (err) {
            console.error('Ошибка загрузки пользователей с жалобами:', err);
            setUsersError('Не удалось загрузить список пользователей');
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'content') {
            fetchComplaints();
        } else if (activeTab === 'users') {
            fetchUsersWithComplaints();
        } else if (activeTab === 'add_mod') {
            // Сбросить состояние поиска при переключении вкладок
            setSearchQuery('');
            setSearchResults([]);
            setSearchError('');
            setAssignSuccess('');
        }
    }, [activeTab]);

    // Обработчик изменения статуса жалобы
    const handleStatusChange = async (complaintId: string, newStatus: Complaint['status']) => {
        try {
            await axios.put(
                `http://localhost:8080/api/mod/complaints/${complaintId}/status`,
                { status: newStatus },
                { withCredentials: true }
            );
            
            // Обновляем локальное состояние
            await fetchComplaints();
        } catch (err) {
            console.error('Ошибка обновления статуса жалобы:', err);
            alert('Не удалось обновить статус жалобы');
        }
    };

    // Обработчик переключения видимости поста
    const togglePostVisibility = async (postId: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        const action = newStatus ? 'показан' : 'скрыт';
        
        try {
            await axios.put(
                `http://localhost:8080/api/mod/posts/${postId}/visibility`,
                { is_approved: newStatus },
                { withCredentials: true }
            );
            
            // Обновляем локальное состояние
            await fetchComplaints();
            
            // Показываем уведомление
            alert(`Пост успешно ${action}`);
        } catch (err: any) {
            console.error('Ошибка изменения видимости поста:', err);
            const errorMessage = err.response?.data?.error || 'Не удалось изменить видимость поста';
            alert(errorMessage);
        }
    };

    // Блокировка пользователя
    const blockUser = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите заблокировать пользователя "${username}"?`)) {
            return;
        }
        
        try {
            setBlockLoading(userId);
            
            await axios.post(
                `http://localhost:8080/api/mod/users/${userId}/block`,
                {},
                { withCredentials: true }
            );
            
            alert(`Пользователь "${username}" успешно заблокирован!`);
            
            // Обновляем список пользователей
            await fetchUsersWithComplaints();
            
        } catch (err: any) {
            console.error('Ошибка блокировки пользователя:', err);
            alert(err.response?.data?.error || 'Не удалось заблокировать пользователя');
        } finally {
            setBlockLoading(null);
        }
    };

    // Разблокировка пользователя
    const unblockUser = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите разблокировать пользователя "${username}"?`)) {
            return;
        }
        
        try {
            setUnblockLoading(userId);
            
            await axios.post(
                `http://localhost:8080/api/mod/users/${userId}/unblock`,
                {},
                { withCredentials: true }
            );
            
            alert(`Пользователь "${username}" успешно разблокирован!`);
            
            // Обновляем список пользователей
            await fetchUsersWithComplaints();
            
        } catch (err: any) {
            console.error('Ошибка разблокировки пользователя:', err);
            alert(err.response?.data?.error || 'Не удалось разблокировать пользователя');
        } finally {
            setUnblockLoading(null);
        }
    };

    // Обработчик клика по жалобе - переход на страницу поста
    const handleComplaintClick = (postId: number) => {
        navigate(`/post/${postId}`);
    };

    // Обработчик клика по пользователю - переход на профиль пользователя
    const handleUserClick = (userId: number) => {
        navigate(`/user/${userId}`);
    };

    // Функция поиска пользователей
    const searchUsers = async () => {
        if (!searchQuery.trim()) {
            setSearchError('Введите имя пользователя или email');
            return;
        }
        
        try {
            setSearchLoading(true);
            setSearchError('');
            setAssignSuccess('');
            
            const response = await axios.get(
                `http://localhost:8080/api/mod/users/search?q=${encodeURIComponent(searchQuery)}`,
                { withCredentials: true }
            );
            setSearchResults(response.data);
        } catch (err: any) {
            console.error('Ошибка поиска пользователей:', err);
            setSearchError(err.response?.data?.error || 'Не удалось найти пользователей');
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    // Функция назначения модератора
    const assignModeratorRole = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите назначить пользователя "${username}" модератором?`)) {
            return;
        }
        
        try {
            setAssignLoading(userId);
            setAssignSuccess('');
            
            await axios.post(
                `http://localhost:8080/api/mod/users/${userId}/assign-moderator`,
                {},
                { withCredentials: true }
            );
            
            setAssignSuccess(`Пользователь "${username}" успешно назначен модератором!`);
            
            // Обновляем список результатов
            setSearchResults(prev => prev.map(user => 
                user.id === userId ? { ...user, role_id: 2 } : user
            ));
            
            // Очищаем успешное сообщение через 3 секунды
            setTimeout(() => setAssignSuccess(''), 3000);
            
        } catch (err: any) {
            console.error('Ошибка назначения модератора:', err);
            alert(err.response?.data?.error || 'Не удалось назначить модератора');
        } finally {
            setAssignLoading(null);
        }
    };

    // Функция снятия с позиции модератора
    const removeModeratorRole = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите снять пользователя "${username}" с позиции модератора?`)) {
            return;
        }
        
        try {
            setRemoveLoading(userId);
            setAssignSuccess('');
            
            await axios.post(
                `http://localhost:8080/api/mod/users/${userId}/remove-moderator`,
                {},
                { withCredentials: true }
            );
            
            setAssignSuccess(`Пользователь "${username}" снят с позиции модератора!`);
            
            // Обновляем список результатов
            setSearchResults(prev => prev.map(user => 
                user.id === userId ? { ...user, role_id: 1 } : user
            ));
            
            // Очищаем успешное сообщение через 3 секунды
            setTimeout(() => setAssignSuccess(''), 3000);
            
        } catch (err: any) {
            console.error('Ошибка снятия модератора:', err);
            alert(err.response?.data?.error || 'Не удалось снять модератора');
        } finally {
            setRemoveLoading(null);
        }
    };

    // Форматирование даты
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Нет жалоб';
        const date = new Date(dateString);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    // Получение текста для статуса поста
    const getPostStatusText = (isApproved: boolean) => {
        return isApproved ? 'ВИДИМ' : 'СКРЫТ';
    };

    // Получение класса для статуса поста
    const getPostStatusClass = (isApproved: boolean) => {
        return isApproved ? 'post-visible' : 'post-hidden';
    };

    // Получение текста для кнопки видимости
    const getVisibilityButtonText = (isApproved: boolean) => {
        return isApproved ? 'СКРЫТЬ' : 'ПОКАЗАТЬ';
    };

    // Получение описания статуса жалобы
    const getStatusDescription = (status: string) => {
        switch (status) {
            case 'NEW': return 'Новая жалоба, требует рассмотрения';
            case 'PROCESSING': return 'Жалоба в работе у модератора';
            case 'RESOLVED': return 'Жалоба решена (контент обработан)';
            case 'REJECTED': return 'Жалоба отклонена (необоснована)';
            default: return '';
        }
    };

    // Рендер контента в зависимости от активной вкладки
    const renderContent = () => {
        switch (activeTab) {
            case 'content':
                return renderComplaintsTable();
            case 'users':
                return renderUsersWithComplaintsTable();
            case 'add_mod':
                return renderAddModeratorForm();
            default:
                return null;
        }
    };

    // Рендер таблицы с жалобами
    const renderComplaintsTable = () => {
        if (loading) {
            return <div className="loading-state">Загрузка жалоб...</div>;
        }

        if (error) {
            return <div className="error-state">{error}</div>;
        }

        if (complaints.length === 0) {
            return <div className="no-data">Жалоб не найдено</div>;
        }

        return (
            <div className="table-container">
                <table className="mod-table">
                    <thead>
                        <tr>
                            <th>Название поста</th>
                            <th>Автор поста</th>
                            <th>Причина жалобы</th>
                            <th className="text-right">Время первой жалобы</th>
                            <th className="text-center">Кол-во жалоб</th>
                            <th className="text-center">Статус поста</th>
                            <th className="text-center">Действия с постом</th>
                            <th className="text-right">Статус жалобы</th>
                        </tr>
                    </thead>
                    <tbody>
                        {complaints.map((complaint) => (
                            <tr 
                                key={complaint.id} 
                                className="complaint-row"
                                onClick={() => handleComplaintClick(complaint.post_id)}
                            >
                                <td className="post-title-cell">
                                    <span className="post-title">{complaint.post_title}</span>
                                </td>
                                <td className="author-cell">{complaint.author}</td>
                                <td className="reason-cell">
                                    <span 
                                        className="complaint-reason" 
                                        title={complaint.reason}
                                    >
                                        {complaint.reason.length > 50 
                                            ? `${complaint.reason.substring(0, 50)}...` 
                                            : complaint.reason
                                        }
                                    </span>
                                </td>
                                <td className="date-cell text-right">
                                    {formatDate(complaint.created_at)}
                                </td>
                                <td className="count-cell text-center">
                                    <span className="complaint-count">{complaint.complaint_count}</span>
                                </td>
                                <td className="status-cell text-center">
                                    <span className={`post-status ${getPostStatusClass(complaint.is_approved)}`}>
                                        {getPostStatusText(complaint.is_approved)}
                                    </span>
                                </td>
                                <td className="actions-cell text-center" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        className={`visibility-btn ${complaint.is_approved ? 'btn-visible' : 'btn-hidden'}`}
                                        onClick={() => togglePostVisibility(complaint.post_id, complaint.is_approved)}
                                        title={complaint.is_approved ? 'Скрыть пост из публичной ленты' : 'Вернуть пост в публичную ленту'}
                                    >
                                        {getVisibilityButtonText(complaint.is_approved)}
                                    </button>
                                </td>
                                <td className="complaint-status-cell text-right" onClick={(e) => e.stopPropagation()}>
                                    <select 
                                        className="status-select"
                                        value={complaint.status}
                                        onChange={(e) => handleStatusChange(complaint.id, e.target.value as Complaint['status'])}
                                        title={getStatusDescription(complaint.status)}
                                    >
                                        <option value="NEW">Новая</option>
                                        <option value="PROCESSING">В работе</option>
                                        <option value="RESOLVED">Решена</option>
                                        <option value="REJECTED">Отклонена</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Рендер таблицы с пользователями с жалобами
    const renderUsersWithComplaintsTable = () => {
       if (usersLoading) {
            return <div className="loading-state">Загрузка пользователей...</div>;
        }

      if (usersError) {
            return <div className="error-state">{usersError}</div>;
        }

        // Проверка на null И на длину
        if (!usersWithComplaints || usersWithComplaints.length === 0) {
            return <div className="no-data">Пользователей с жалобами не найдено</div>;
        }

        return (
            <div className="table-container">
                <table className="mod-table users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Имя пользователя</th>
                            <th>Email</th>
                            <th className="text-center">Всего жалоб</th>
                            <th className="text-center">Активные</th>
                            <th className="text-center">Решено</th>
                            <th className="text-center">Отклонено</th>
                            <th className="text-right">Последняя жалоба</th>
                            <th className="text-center">Статус</th>
                            <th className="text-center">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usersWithComplaints.map((user) => (
                            <tr 
                                key={user.id} 
                                className="user-row"
                                onClick={() => handleUserClick(user.id)}
                            >
                                <td className="user-id-cell">
                                    <span className="user-id">#{user.id}</span>
                                </td>
                                <td className="user-username-cell">
                                    <span className="user-username">{user.username}</span>
                                </td>
                                <td className="user-email-cell">
                                    <span className="user-email">{user.email}</span>
                                </td>
                                <td className="user-total-complaints text-center">
                                    <span className="total-count">{user.total_complaints}</span>
                                </td>
                                <td className="user-active-complaints text-center">
                                    <span className="active-count">{user.active_complaints}</span>
                                </td>
                                <td className="user-resolved-complaints text-center">
                                    <span className="resolved-count">{user.resolved_complaints}</span>
                                </td>
                                <td className="user-rejected-complaints text-center">
                                    <span className="rejected-count">{user.rejected_complaints}</span>
                                </td>
                                <td className="user-last-complaint text-right">
                                    <span className="last-complaint-date">{formatDate(user.last_complaint_date)}</span>
                                </td>
                                <td className="user-status-cell text-center" onClick={(e) => e.stopPropagation()}>
                                    <span className={`user-status-badge ${user.is_blocked ? 'user-blocked' : 'user-active'}`}>
                                        {user.is_blocked ? 'ЗАБЛОКИРОВАН' : 'АКТИВЕН'}
                                    </span>
                                </td>
                                <td className="user-actions-cell text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="user-action-buttons">
                                        {user.is_blocked ? (
                                            <button 
                                                className="unblock-user-btn"
                                                onClick={() => unblockUser(user.id, user.username)}
                                                disabled={unblockLoading === user.id}
                                                title="Разблокировать пользователя"
                                            >
                                                {unblockLoading === user.id ? '...' : 'РАЗБЛОКИРОВАТЬ'}
                                            </button>
                                        ) : (
                                            <button 
                                                className="block-user-btn"
                                                onClick={() => blockUser(user.id, user.username)}
                                                disabled={blockLoading === user.id}
                                                title="Заблокировать пользователя"
                                            >
                                                {blockLoading === user.id ? '...' : 'ЗАБЛОКИРОВАТЬ'}
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

    // Рендер формы добавления модератора
    const renderAddModeratorForm = () => {
        return (
            <div className="add-moderator-tab">
                <div className="add-moderator-content">
                    <div className="search-section">
                        <div className="search-header">
                            <h3 className="search-title">Найти пользователя</h3>
                            <p className="search-description">
                                Поиск по имени пользователя или email для управления правами доступа
                            </p>
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
                            <button 
                                className="search-button"
                                onClick={searchUsers}
                                disabled={searchLoading || !searchQuery.trim()}
                            >
                                {searchLoading ? 'Поиск...' : 'Найти'}
                            </button>
                        </div>
                        
                        {searchError && <div className="search-error">{searchError}</div>}
                        {assignSuccess && <div className="assign-success">{assignSuccess}</div>}
                    </div>
                

                    {searchResults.length > 0 && (
                        <div className="search-results">
                            <div className="results-header">
                                <h3 className="results-title">Результаты поиска</h3>
                                <div className="results-count">{searchResults.length} пользователей найдено</div>
                            </div>
                            <table className="users-search-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Имя пользователя</th>
                                        <th>Email</th>
                                        <th>Текущая роль</th>
                                        <th>Статус</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResults.map(user => (
                                        <tr key={user.id} className="user-row">
                                            <td className="user-id">{user.id}</td>
                                            <td className="user-username">{user.username}</td>
                                            <td className="user-email">{user.email}</td>
                                            <td className="user-role">
                                                <span className={`role-badge ${user.role_id === 2 ? 'role-moderator' : 'role-user'}`}>
                                                    {user.role_id === 2 ? 'Модератор' : 'Пользователь'}
                                                </span>
                                            </td>
                                            <td className="user-status">
                                                <span className={`status-badge ${user.is_blocked ? 'status-blocked' : 'status-active'}`}>
                                                    {user.is_blocked ? 'Заблокирован' : 'Активен'}
                                                </span>
                                            </td>
                                            <td className="user-actions">
                                                <div className="action-buttons">
                                                    {user.role_id === 2 ? (
                                                        <button
                                                            className="remove-moderator-button"
                                                            onClick={() => removeModeratorRole(user.id, user.username)}
                                                            disabled={removeLoading === user.id || user.is_blocked}
                                                            title={user.is_blocked ? 'Пользователь заблокирован' : 'Снять с позиции модератора'}
                                                        >
                                                            {removeLoading === user.id ? 'Снятие...' : 'Снять'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="assign-moderator-button"
                                                            onClick={() => assignModeratorRole(user.id, user.username)}
                                                            disabled={assignLoading === user.id || user.is_blocked}
                                                            title={user.is_blocked ? 'Пользователь заблокирован' : 'Назначить модератором'}
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
                    
                    {searchResults.length === 0 && searchQuery && !searchLoading && (
                        <div className="no-results">
                            <div className="no-results-icon">🔍</div>
                            <div className="no-results-text">Пользователи не найдены</div>
                        </div>
                    )}
                    
                    {!searchQuery && !searchLoading && searchResults.length === 0 && (
                        <div className="search-hint">
                            <div className="hint-content">
                                <div className="hint-icon">👤</div>
                                <div className="hint-text">
                                    <p>Введите имя пользователя или email для поиска</p>
                                    <p className="hint-subtext">Управляйте правами доступа пользователей</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <ContentLayout>
            <div className="moderator-container">
                {/* Верхняя фиолетовая панель с вкладками */}
                <div className="mod-header-tabs">
                    <div 
                        className={`mod-tab ${activeTab === 'content' ? 'active' : ''}`}
                        onClick={() => setActiveTab('content')}
                    >
                        Контент с жалобами
                    </div>
                    <div 
                        className={`mod-tab ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        Пользователи с жалобами
                    </div>
                    <div 
                        className={`mod-tab ${activeTab === 'add_mod' ? 'active' : ''}`}
                        onClick={() => setActiveTab('add_mod')}
                    >
                        Добавить модератора
                    </div>
                </div>

                {/* Основной контент */}
                <div className="mod-content">
                    {renderContent()}
                </div>
            </div>
        </ContentLayout>
    );
};

export default ModeratorPage;