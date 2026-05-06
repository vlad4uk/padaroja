import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaCheck, FaTimes, FaBell, FaPaperPlane, FaCheckCircle, FaTimesCircle, FaClock, FaEye } from 'react-icons/fa';
import ContentLayout from './ContentLayout.tsx';
import './CollaborationInvites.css';

interface Invite {
    id: number;
    post_id: number;
    post_title: string;
    post_preview?: {
        text: string;
        photo: string;
        created_at: string;
        settlement_name: string;
    };
    inviter_id: number;
    inviter_name: string;
    inviter_avatar: string;
    role: string;
    invited_at: string;
}

interface SentInvite {
    id: number;
    post_id: number;
    post_title: string;
    invitee_id: number;
    invitee_name: string;
    invitee_avatar: string;
    role: string;
    status: 'pending' | 'accepted' | 'declined';
    invited_at: string;
    responded_at: string | null;
}

const CollaborationInvites: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [incomingInvites, setIncomingInvites] = useState<Invite[]>([]);
    const [outgoingInvites, setOutgoingInvites] = useState<SentInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const navigate = useNavigate();

    const fetchIncomingInvites = async () => {
        try {
            const response = await axios.get('/api/posts/invites/pending', {
                withCredentials: true
            });
            setIncomingInvites(response.data.invites || []);
        } catch (error) {
            console.error('Ошибка загрузки входящих приглашений:', error);
        }
    };

    const fetchOutgoingInvites = async () => {
        try {
            const response = await axios.get('/api/posts/invites/sent', {
                withCredentials: true
            });
            setOutgoingInvites(response.data.invites || []);
        } catch (error) {
            console.error('Ошибка загрузки исходящих приглашений:', error);
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([fetchIncomingInvites(), fetchOutgoingInvites()]);
        setLoading(false);
    };

    const acceptInvite = async (inviteId: number, postId: number) => {
        setProcessingId(inviteId);
        try {
            await axios.put(`/api/posts/invites/${inviteId}/accept`, {}, {
                withCredentials: true
            });
            setIncomingInvites(prev => prev.filter(i => i.id !== inviteId));
            alert('Приглашение принято! Теперь вы соавтор этого поста.');
            navigate(`/post/${postId}`);
        } catch (error: any) {
            console.error('Ошибка при принятии приглашения:', error);
            alert(error.response?.data?.error || 'Не удалось принять приглашение');
        } finally {
            setProcessingId(null);
        }
    };

    const declineInvite = async (inviteId: number) => {
        setProcessingId(inviteId);
        try {
            await axios.put(`/api/posts/invites/${inviteId}/decline`, {}, {
                withCredentials: true
            });
            setIncomingInvites(prev => prev.filter(i => i.id !== inviteId));
            alert('Приглашение отклонено');
        } catch (error: any) {
            console.error('Ошибка при отклонении приглашения:', error);
            alert(error.response?.data?.error || 'Не удалось отклонить приглашение');
        } finally {
            setProcessingId(null);
        }
    };

    // SSE для обновления статусов исходящих приглашений в реальном времени
    useEffect(() => {
        fetchAllData();

        const token = localStorage.getItem('token');
        if (!token) return;

        const eventSource = new EventSource(`/api/posts/stream/user?token=${token}`);
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('SSE received:', data);
                
                if (data.type === 'INVITE_RESPONSE') {
                    // Обновляем статус в исходящих приглашениях
                    setOutgoingInvites(prev => prev.map(invite => 
                        invite.id === data.data.invite_id 
                            ? { 
                                ...invite, 
                                status: data.data.status,
                                responded_at: data.data.responded_at 
                              }
                            : invite
                    ));
                    
                    // Показываем уведомление
                    const message = data.data.status === 'accepted' 
                        ? `✅ ${data.data.username} принял(а) ваше приглашение в пост "${data.data.post_title}"`
                        : `❌ ${data.data.username} отклонил(а) ваше приглашение в пост "${data.data.post_title}"`;
                    alert(message);
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
        };
        
        return () => {
            eventSource.close();
        };
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'accepted':
                return <FaCheckCircle style={{ color: '#4caf50' }} />;
            case 'declined':
                return <FaTimesCircle style={{ color: '#f44336' }} />;
            default:
                return <FaClock style={{ color: '#ff9800' }} />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'accepted':
                return 'Принято';
            case 'declined':
                return 'Отклонено';
            default:
                return 'Ожидает ответа';
        }
    };

    if (loading) {
        return (
            <ContentLayout>
                <div className="invites-loading">
                    <FaBell className="loading-icon" />
                    <span>Загрузка приглашений...</span>
                </div>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout>
            <div style={{ padding: '20px' }}>
                <h1 style={{ 
                    marginBottom: '20px', 
                    color: '#333',
                    fontSize: '24px',
                    fontWeight: '600'
                }}>
                    Приглашения
                </h1>

                {/* Вкладки - прижаты к левому краю */}
                <div style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    marginBottom: '20px',
                    borderBottom: '1px solid #eee',
                    justifyContent: 'flex-start'
                }}>
                    <button
                        onClick={() => setActiveTab('incoming')}
                        style={{
                            padding: '10px 20px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: activeTab === 'incoming' ? '600' : '400',
                            color: activeTab === 'incoming' ? '#696cff' : '#666',
                            borderBottom: activeTab === 'incoming' ? '2px solid #696cff' : 'none',
                            transition: 'none'
                        }}
                    >
                        <FaUserPlus style={{ marginRight: '8px' }} />
                        Входящие ({incomingInvites.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('outgoing')}
                        style={{
                            padding: '10px 20px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: activeTab === 'outgoing' ? '600' : '400',
                            color: activeTab === 'outgoing' ? '#696cff' : '#666',
                            borderBottom: activeTab === 'outgoing' ? '2px solid #696cff' : 'none',
                            transition: 'none'
                        }}
                    >
                        <FaPaperPlane style={{ marginRight: '8px' }} />
                        Исходящие
                    </button>
                </div>

                {/* Центрируем контент */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {/* Входящие приглашения */}
                    {activeTab === 'incoming' && (
                        <>
                            {incomingInvites.length === 0 ? (
                                <div className="invites-empty" style={{ width: '100%', maxWidth: '600px' }}>
                                    <FaUserPlus className="empty-icon" />
                                    <p>Нет входящих приглашений</p>
                                    <span className="empty-hint">
                                        Когда вас пригласят в пост, уведомления появятся здесь
                                    </span>
                                </div>
                            ) : (
                                <div className="invites-container" style={{ maxWidth: '600px', width: '100%' }}>
                                    <div className="invites-list">
                                        {incomingInvites.map(invite => (
                                            <div key={invite.id} className="invite-card" style={{ transition: 'none' }}>
                                                <div className="invite-header">
                                                    <img 
                                                        src={invite.inviter_avatar || '/default-avatar.png'} 
                                                        alt={invite.inviter_name}
                                                        className="inviter-avatar"
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/default-avatar.png';
                                                        }}
                                                    />
                                                    <div className="invite-info">
                                                        <span className="inviter-name">@{invite.inviter_name}</span>
                                                        <span className="invite-action">приглашает вас в пост</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Превью поста */}
                                                <div className="invite-post-preview">
                                                    <div className="post-preview-content">
                                                        {invite.post_preview?.photo && (
                                                            <div className="post-preview-image">
                                                                <img 
                                                                    src={invite.post_preview.photo} 
                                                                    alt={invite.post_title}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/post/${invite.post_id}`);
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="post-preview-info">
                                                            <h4 className="post-title">{invite.post_title}</h4>
                                                            {invite.post_preview?.text && (
                                                                <p className="post-preview-text">{invite.post_preview.text}</p>
                                                            )}
                                                            <div className="post-meta">
                                                                {invite.post_preview?.settlement_name && (
                                                                    <span className="post-location">
                                                                        📍 {invite.post_preview.settlement_name}
                                                                    </span>
                                                                )}
                                                                {invite.post_preview?.created_at && (
                                                                    <span className="post-date">
                                                                        📅 {new Date(invite.post_preview.created_at).toLocaleDateString('ru-RU')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="post-role-badge">
                                                        <span className={`invite-role-badge ${invite.role}`}>
                                                            {invite.role === 'editor' ? '✏️ Редактор' : '👁️ Читатель'}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="invite-date" style={{ marginTop: '10px' }}>
                                                    📅 Приглашение отправлено: {new Date(invite.invited_at).toLocaleDateString('ru-RU')}
                                                </div>
                                                
                                                <div className="invite-actions">
                                                    <button 
                                                        className="accept-btn"
                                                        onClick={() => acceptInvite(invite.id, invite.post_id)}
                                                        disabled={processingId === invite.id}
                                                    >
                                                        <FaCheck />
                                                        {processingId === invite.id ? 'Обработка...' : 'Принять'}
                                                    </button>
                                                    <button 
                                                        className="decline-btn"
                                                        onClick={() => declineInvite(invite.id)}
                                                        disabled={processingId === invite.id}
                                                    >
                                                        <FaTimes />
                                                        Отклонить
                                                    </button>
                                                    <button 
                                                        className="view-post-btn"
                                                        onClick={() => navigate(`/post/${invite.post_id}`)}
                                                    >
                                                        <FaEye />
                                                        Просмотр
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Исходящие приглашения */}
                    {activeTab === 'outgoing' && (
                        <>
                            {outgoingInvites.length === 0 ? (
                                <div className="invites-empty" style={{ width: '100%', maxWidth: '600px' }}>
                                    <FaPaperPlane className="empty-icon" />
                                    <p>Нет исходящих приглашений</p>
                                    <span className="empty-hint">
                                        Когда вы пригласите кого-то в пост, приглашения появятся здесь
                                    </span>
                                </div>
                            ) : (
                                <div className="invites-container" style={{ maxWidth: '600px', width: '100%' }}>
                                    <div className="invites-list">
                                        {outgoingInvites.map(invite => (
                                            <div key={invite.id} className="invite-card" style={{ transition: 'none' }}>
                                                <div className="invite-header">
                                                    <img 
                                                        src={invite.invitee_avatar || '/default-avatar.png'} 
                                                        alt={invite.invitee_name}
                                                        className="inviter-avatar"
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/default-avatar.png';
                                                        }}
                                                    />
                                                    <div className="invite-info">
                                                        <span className="inviter-name">@{invite.invitee_name}</span>
                                                        <span className="invite-action">
                                                            {invite.status === 'pending' ? 'приглашение отправлено' :
                                                             invite.status === 'accepted' ? 'принял приглашение' : 'отклонил приглашение'}
                                                        </span>
                                                    </div>
                                                    <div style={{ marginLeft: 'auto' }}>
                                                        {getStatusIcon(invite.status)}
                                                    </div>
                                                </div>
                                                
                                                <div className="invite-post">
                                                    <h4 className="post-title">{invite.post_title}</h4>
                                                    <span className={`invite-role-badge ${invite.role}`}>
                                                        {invite.role === 'editor' ? '✏️ Редактор' : '👁️ Читатель'}
                                                    </span>
                                                </div>
                                                
                                                <div className="invite-date" style={{ marginTop: '10px' }}>
                                                    <div>📅 Отправлено: {new Date(invite.invited_at).toLocaleDateString('ru-RU')}</div>
                                                    {invite.responded_at && (
                                                        <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                                                            📅 Ответ: {new Date(invite.responded_at).toLocaleDateString('ru-RU')}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div style={{ 
                                                    marginTop: '10px',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    backgroundColor: 
                                                        invite.status === 'accepted' ? '#e8f5e9' :
                                                        invite.status === 'declined' ? '#ffebee' : '#fff3e0',
                                                    color:
                                                        invite.status === 'accepted' ? '#2e7d32' :
                                                        invite.status === 'declined' ? '#c62828' : '#ed6c02',
                                                    fontSize: '14px',
                                                    fontWeight: '500'
                                                }}>
                                                    {getStatusText(invite.status)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ContentLayout>
    );
};

export default CollaborationInvites;