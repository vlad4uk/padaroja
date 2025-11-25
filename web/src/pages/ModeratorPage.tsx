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

type TabType = 'content' | 'users' | 'add_mod';

const ModeratorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

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

    useEffect(() => {
        if (activeTab === 'content') {
            fetchComplaints();
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

    // Обработчик клика по жалобе - переход на страницу поста
    const handleComplaintClick = (postId: number) => {
        navigate(`/post/${postId}`);
    };

    // Форматирование даты
    const formatDate = (dateString: string) => {
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
                return <div className="tab-content">Список пользователей с жалобами (В разработке)</div>;
            case 'add_mod':
                return <div className="tab-content">Форма добавления модератора (В разработке)</div>;
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