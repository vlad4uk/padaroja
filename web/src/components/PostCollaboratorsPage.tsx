import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from './ContentLayout.tsx';
import { FaUserMinus, FaArrowLeft, FaCrown, FaUserEdit, FaUserCheck } from 'react-icons/fa';
import './PostCollaboratorsPage.css';

interface Collaborator {
    id: number;
    user_id: number;
    username: string;
    avatar: string;
    role: string;
    joined_at: string;
}

const PostCollaboratorsPage: React.FC = () => {
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [postTitle, setPostTitle] = useState('');
    const [postAuthorId, setPostAuthorId] = useState<number | null>(null); 
    const [postAuthorName, setPostAuthorName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    useEffect(() => {
        fetchCurrentUser();
        fetchCollaborators();
    }, [postId]);

    const fetchCurrentUser = async () => {
        try {
            const response = await axios.get('/api/user/profile', {
                withCredentials: true
            });
            setCurrentUserId(response.data.id);
        } catch (error) {
            console.error('Ошибка загрузки текущего пользователя:', error);
            const savedId = localStorage.getItem('userId');
            if (savedId) {
                setCurrentUserId(parseInt(savedId));
            }
        }
    };

    const fetchCollaborators = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/posts/${postId}/collaborators`, {
                withCredentials: true
            });
            setCollaborators(response.data.collaborators || []);
            setPostTitle(response.data.post_title || '');
            setPostAuthorId(response.data.post_author_id || null);
            setPostAuthorName(response.data.post_author || '');
        } catch (error: any) {
            console.error('Ошибка загрузки соавторов:', error);
            setError(error.response?.data?.error || 'Не удалось загрузить список соавторов');
        } finally {
            setLoading(false);
        }
    };

    const removeCollaborator = async (userId: number, username: string) => {
        
        try {
            await axios.delete(`/api/posts/${postId}/collaborators/${userId}`, {
                withCredentials: true
            });
            setCollaborators(prev => prev.filter(c => c.user_id !== userId));
            alert('Соавтор удалён');
        } catch (error: any) {
            console.error('Ошибка удаления:', error);
            alert(error.response?.data?.error || 'Не удалось удалить соавтора');
        }
    };

    const BackButton = () => (
        <button 
            onClick={() => navigate(-1)}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#696cff',
                padding: '8px 12px',
                borderRadius: '8px',
                marginBottom: '20px',
                transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            <FaArrowLeft /> Назад
        </button>
    );

    const isOwner = currentUserId !== null && currentUserId === postAuthorId;

    if (loading) {
        return (
            <ContentLayout>
                <div className="posts-feed-loading">
                    <div className="loading-spinner"></div>
                    <p>Загрузка соавторов...</p>
                </div>
            </ContentLayout>
        );
    }

    if (error) {
        return (
            <ContentLayout>
                <div className="posts-feed-error">
                    <p>{error}</p>
                    <button onClick={fetchCollaborators} className="retry-button">
                        Попробовать снова
                    </button>
                </div>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout>
            <div style={{ padding: '20px' }}>
                <BackButton />
                
                <h1 style={{ 
                    marginBottom: '12px', 
                    color: '#333',
                    fontSize: '24px',
                    fontWeight: '600'
                }}>
                    Управление соавторами
                </h1>
                
                {postTitle && (
                    <p style={{ 
                        marginBottom: '24px', 
                        color: '#666',
                        fontSize: '14px'
                    }}>
                        Пост: <strong>{postTitle}</strong>
                        {postAuthorName && <span> • автор: @{postAuthorName}</span>}
                    </p>
                )}
                
                {/* Владелец */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    padding: '16px 20px',
                    backgroundColor: '#f8f9ff',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    border: '1px solid #e8e8ff'
                }}>
                    <img 
                        src={localStorage.getItem('avatar') || '/default-avatar.png'} 
                        alt="Owner"
                        style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #696cff'
                        }}
                        onError={(e) => {
                            e.currentTarget.src = '/default-avatar.png';
                        }}
                    />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                            {postAuthorName || localStorage.getItem('username') || 'Владелец'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#696cff' }}>
                            <FaCrown style={{ marginRight: '4px' }} /> Владелец поста
                        </div>
                    </div>
                </div>
                
                {/* Заголовок списка соавторов */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    margin: '24px 0 16px 0'
                }}>
                    <h3 style={{ 
                        fontSize: '18px', 
                        color: '#555',
                        margin: 0
                    }}>
                        Соавторы ({collaborators.length})
                    </h3>
                    {collaborators.length > 0 && (
                        <span style={{
                            fontSize: '13px',
                            color: '#999',
                            background: '#f5f5f5',
                            padding: '4px 10px',
                            borderRadius: '20px'
                        }}>
                            Всего: {collaborators.length}
                        </span>
                    )}
                </div>
                
                {/* Список соавторов */}
                {collaborators.length === 0 ? (
                    <div className="posts-feed-empty">
                        <p style={{ fontSize: '16px', margin: 0 }}>
                            У этого поста пока нет соавторов
                        </p>
                        <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
                            Приглашайте друзей для совместного редактирования
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {collaborators.map(collab => (
                            <div 
                                key={collab.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '15px',
                                    padding: '16px 20px',
                                    backgroundColor: '#fff',
                                    borderRadius: '12px',
                                    border: '1px solid #eee',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#fafafa';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#fff';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <img 
                                    src={collab.avatar || '/default-avatar.png'} 
                                    alt={collab.username}
                                    style={{
                                        width: '52px',
                                        height: '52px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1px solid #e0e0e0'
                                    }}
                                    onError={(e) => {
                                        e.currentTarget.src = '/default-avatar.png';
                                    }}
                                />
                                
                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontWeight: 700, 
                                        fontSize: '16px', 
                                        marginBottom: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        flexWrap: 'wrap'
                                    }}>
                                        @{collab.username}
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '12px',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            background: collab.role === 'editor' ? '#e8f5e9' : '#fff3e0',
                                            color: collab.role === 'editor' ? '#2e7d32' : '#ef6c00'
                                        }}>
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#999' }}>
                                        Присоединился: {new Date(collab.joined_at).toLocaleDateString('ru-RU')}
                                    </div>
                                </div>
                                
                                {isOwner && (
                                    <button
                                        onClick={() => removeCollaborator(collab.user_id, collab.username)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#e74c3c',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fee';
                                            e.currentTarget.style.color = '#c0392b';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = '#e74c3c';
                                        }}
                                    >
                                        <FaUserMinus /> Удалить
                                    </button>
                                )}
                                
                                {/* Если не владелец, показываем заглушку */}
                                {!isOwner && (
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#999',
                                        padding: '8px 16px'
                                    }}>
                                        Только для владельца
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Отладка: показываем информацию о правах */}
                <div style={{
                    marginTop: '24px',
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#666',
                    textAlign: 'center'
                }}>
                    {currentUserId ? (
                        <span>Ваш ID: {currentUserId} | ID автора: {postAuthorId} | {isOwner ? '✓ Вы владелец' : '✗ Вы не владелец'}</span>
                    ) : (
                        <span>Загрузка информации о пользователе...</span>
                    )}
                </div>
            </div>
        </ContentLayout>
    );
};

export default PostCollaboratorsPage;