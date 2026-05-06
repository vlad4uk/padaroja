// ModeratorPage.tsx (обновленная - только для модераторов)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './ModeratorPage.css';
import { FaFileAlt, FaComment, FaEye, FaEyeSlash } from 'react-icons/fa';

interface Complaint {
    id: string;
    type: 'POST' | 'COMMENT';
    post_id?: number;
    comment_id?: number;
    post_title: string;
    comment_content?: string;
    author: string;
    reason: string;
    status: 'NEW' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
    created_at: string;
    complaint_count: number;
    is_approved: boolean;
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

type TabType = 'content' | 'users';

const ModeratorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [usersWithComplaints, setUsersWithComplaints] = useState<UserWithComplaints[]>([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [error, setError] = useState('');
    const [usersError, setUsersError] = useState('');
    const navigate = useNavigate();

    const [blockLoading, setBlockLoading] = useState<number | null>(null);
    const [unblockLoading, setUnblockLoading] = useState<number | null>(null);
    const [visibilityLoading, setVisibilityLoading] = useState<{ [key: string]: boolean }>({});

    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/mod/complaints', { withCredentials: true });
            setComplaints(response.data || []);
            setError('');
        } catch (err) {
            console.error('Ошибка загрузки жалоб:', err);
            setError('Не удалось загрузить список жалоб');
            setComplaints([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsersWithComplaints = async () => {
        try {
            setUsersLoading(true);
            const response = await axios.get('/api/mod/users-with-complaints', { withCredentials: true });
            setUsersWithComplaints(response.data || []);
            setUsersError('');
        } catch (err) {
            console.error('Ошибка загрузки пользователей с жалобами:', err);
            setUsersError('Не удалось загрузить список пользователей');
            setUsersWithComplaints([]);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'content') {
            fetchComplaints();
        } else if (activeTab === 'users') {
            fetchUsersWithComplaints();
        }
    }, [activeTab]);

    const handleStatusChange = async (complaintId: string, newStatus: Complaint['status']) => {
        try {
            await axios.put(`/api/mod/complaints/${complaintId}/status`, { status: newStatus }, { withCredentials: true });
            await fetchComplaints();
        } catch (err) {
            console.error('Ошибка обновления статуса жалобы:', err);
            alert('Не удалось обновить статус жалобы');
        }
    };

    const togglePostVisibility = async (postId: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        const action = newStatus ? 'показан' : 'скрыт';
        
        try {
            await axios.put(`/api/mod/posts/${postId}/visibility`, { is_approved: newStatus }, { withCredentials: true });
            await fetchComplaints();
            alert(`Пост успешно ${action}`);
        } catch (err: any) {
            console.error('Ошибка изменения видимости поста:', err);
            alert(err.response?.data?.error || 'Не удалось изменить видимость поста');
        }
    };

    const toggleCommentVisibility = async (commentId: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        const action = newStatus ? 'показан' : 'скрыт';
        
        try {
            setVisibilityLoading(prev => ({ ...prev, [`comment_${commentId}`]: true }));
            await axios.put(`/api/mod/comments/${commentId}/visibility`, { is_approved: newStatus }, { withCredentials: true });
            await fetchComplaints();
            alert(`Комментарий успешно ${action}`);
        } catch (err: any) {
            console.error('Ошибка изменения видимости комментария:', err);
            alert(err.response?.data?.error || 'Не удалось изменить видимость комментария');
        } finally {
            setVisibilityLoading(prev => ({ ...prev, [`comment_${commentId}`]: false }));
        }
    };

    const blockUser = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите заблокировать пользователя "${username}"?`)) return;
        
        try {
            setBlockLoading(userId);
            await axios.post(`/api/mod/users/${userId}/block`, {}, { withCredentials: true });
            alert(`Пользователь "${username}" успешно заблокирован!`);
            await fetchUsersWithComplaints();
        } catch (err: any) {
            console.error('Ошибка блокировки пользователя:', err);
            alert(err.response?.data?.error || 'Не удалось заблокировать пользователя');
        } finally {
            setBlockLoading(null);
        }
    };

    const unblockUser = async (userId: number, username: string) => {
        if (!window.confirm(`Вы уверены, что хотите разблокировать пользователя "${username}"?`)) return;
        
        try {
            setUnblockLoading(userId);
            await axios.post(`/api/mod/users/${userId}/unblock`, {}, { withCredentials: true });
            alert(`Пользователь "${username}" успешно разблокирован!`);
            await fetchUsersWithComplaints();
        } catch (err: any) {
            console.error('Ошибка разблокировки пользователя:', err);
            alert(err.response?.data?.error || 'Не удалось разблокировать пользователя');
        } finally {
            setUnblockLoading(null);
        }
    };

    const handleComplaintClick = (complaint: Complaint) => {
        if (complaint.type === 'POST' && complaint.post_id) {
            navigate(`/post/${complaint.post_id}`);
        } else if (complaint.type === 'COMMENT' && complaint.comment_id && complaint.post_id) {
            navigate(`/post/${complaint.post_id}#comment-${complaint.comment_id}`);
        }
    };

    const handleUserClick = (userId: number) => {
        navigate(`/user/${userId}`);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Нет жалоб';
        const date = new Date(dateString);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    const getContentStatusClass = (isApproved: boolean) => isApproved ? 'content-visible' : 'content-hidden';
    const getContentStatusText = (isApproved: boolean) => isApproved ? 'ВИДИМ' : 'СКРЫТ';
    const getVisibilityButtonText = (isApproved: boolean) => isApproved ? 'СКРЫТЬ' : 'ПОКАЗАТЬ';

    const renderComplaintsTable = () => {
        if (loading) return <div className="loading-state">Загрузка жалоб...</div>;
        if (error) return <div className="error-state">{error}</div>;
        if (!complaints || complaints.length === 0) return <div className="no-data">Жалоб не найдено</div>;

        return (
            <div className="table-container">
                <table className="mod-table">
                    <thead>
                        <tr>
                            <th className="text-center">Тип</th>
                            <th>Контент</th>
                            <th>Автор</th>
                            <th>Причина жалобы</th>
                            <th className="text-right">Время жалобы</th>
                            <th className="text-center">Кол-во жалоб</th>
                            <th className="text-center">Статус</th>
                            <th className="text-center">Действия</th>
                            <th className="text-right">Статус жалобы</th>
                        </tr>
                    </thead>
                    <tbody>
                        {complaints.map((complaint) => (
                            <tr key={complaint.id} className="complaint-row" onClick={() => handleComplaintClick(complaint)}>
                                <td className="type-cell text-center">
                                    <div className="content-type-badge">
                                        {complaint.type === 'POST' ? <FaFileAlt size={14} /> : <FaComment size={14} />}
                                        <span className="content-type-text">{complaint.type === 'POST' ? 'Пост' : 'Комментарий'}</span>
                                    </div>
                                </td>
                                <td className="content-cell">
                                    <div className="content-preview">
                                        <strong className="content-title">
                                            {complaint.type === 'POST' ? complaint.post_title : 'Комментарий'}
                                        </strong>
                                        {complaint.type === 'COMMENT' && complaint.comment_content && (
                                            <div className="comment-content-preview">
                                                {complaint.comment_content.length > 50 ? `${complaint.comment_content.substring(0, 50)}...` : complaint.comment_content}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td>{complaint.author}</td>
                                <td className="reason-cell">
                                    <span className="complaint-reason" title={complaint.reason}>
                                        {complaint.reason.length > 50 ? `${complaint.reason.substring(0, 50)}...` : complaint.reason}
                                    </span>
                                </td>
                                <td className="text-right">{formatDate(complaint.created_at)}</td>
                                <td className="text-center"><span className="complaint-count">{complaint.complaint_count}</span></td>
                                <td className="text-center">
                                    <span className={`content-status ${getContentStatusClass(complaint.is_approved)}`}>
                                        {getContentStatusText(complaint.is_approved)}
                                    </span>
                                </td>
                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="visibility-actions">
                                        {complaint.type === 'POST' && complaint.post_id && (
                                            <button 
                                                className={`visibility-btn ${complaint.is_approved ? 'btn-visible' : 'btn-hidden'}`}
                                                onClick={() => togglePostVisibility(complaint.post_id!, complaint.is_approved)}
                                            >
                                                {complaint.is_approved ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                                                {getVisibilityButtonText(complaint.is_approved)}
                                            </button>
                                        )}
                                        {complaint.type === 'COMMENT' && complaint.comment_id && (
                                            <button 
                                                className={`visibility-btn ${complaint.is_approved ? 'btn-visible' : 'btn-hidden'}`}
                                                onClick={() => toggleCommentVisibility(complaint.comment_id!, complaint.is_approved)}
                                                disabled={visibilityLoading[`comment_${complaint.comment_id}`]}
                                            >
                                                {visibilityLoading[`comment_${complaint.comment_id}`] ? '...' : (
                                                    <>
                                                        {complaint.is_approved ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                                                        {getVisibilityButtonText(complaint.is_approved)}
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <select 
                                        className="status-select"
                                        value={complaint.status}
                                        onChange={(e) => handleStatusChange(complaint.id, e.target.value as Complaint['status'])}
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

    const renderUsersWithComplaintsTable = () => {
        if (usersLoading) return <div className="loading-state">Загрузка пользователей...</div>;
        if (usersError) return <div className="error-state">{usersError}</div>;
        if (!usersWithComplaints || usersWithComplaints.length === 0) return <div className="no-data">Пользователей с жалобами не найдено</div>;

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
                            <tr key={user.id} className="user-row" onClick={() => handleUserClick(user.id)}>
                                <td><span className="user-id">#{user.id}</span></td>
                                <td><span className="user-username">{user.username}</span></td>
                                <td><span className="user-email">{user.email}</span></td>
                                <td className="text-center"><span className="total-count">{user.total_complaints}</span></td>
                                <td className="text-center"><span className="active-count">{user.active_complaints}</span></td>
                                <td className="text-center"><span className="resolved-count">{user.resolved_complaints}</span></td>
                                <td className="text-center"><span className="rejected-count">{user.rejected_complaints}</span></td>
                                <td className="text-right"><span className="last-complaint-date">{formatDate(user.last_complaint_date)}</span></td>
                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <span className={`user-status-badge ${user.is_blocked ? 'user-blocked' : 'user-active'}`}>
                                        {user.is_blocked ? 'ЗАБЛОКИРОВАН' : 'АКТИВЕН'}
                                    </span>
                                </td>
                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="user-action-buttons">
                                        {user.is_blocked ? (
                                            <button className="unblock-user-btn" onClick={() => unblockUser(user.id, user.username)} disabled={unblockLoading === user.id}>
                                                {unblockLoading === user.id ? '...' : 'РАЗБЛОКИРОВАТЬ'}
                                            </button>
                                        ) : (
                                            <button className="block-user-btn" onClick={() => blockUser(user.id, user.username)} disabled={blockLoading === user.id}>
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

    return (
        <ContentLayout>
            <div className="moderator-container">
                <div className="mod-header-tabs">
                    <div className={`mod-tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
                        Контент с жалобами
                    </div>
                    <div className={`mod-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        Пользователи с жалобами
                    </div>
                </div>
                <div className="mod-content">
                    {activeTab === 'content' ? renderComplaintsTable() : renderUsersWithComplaintsTable()}
                </div>
            </div>
        </ContentLayout>
    );
};

export default ModeratorPage;