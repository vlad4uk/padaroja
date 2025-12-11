import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import './FollowersModal.css';

interface User {
    id: number;
    username: string;
    bio: string;
    image_url: string;
    role_id: number;
    follow_id: number;
}

interface FollowersModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    type: 'followers' | 'following';
}

const FollowersModal: React.FC<FollowersModalProps> = ({ 
    isOpen, 
    onClose, 
    userId, 
    type
}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen && userId) {
            fetchUsers();
        }
    }, [isOpen, userId, type]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const endpoint = type === 'followers' 
                ? `/api/user/${userId}/followers`
                : `/api/user/${userId}/following`;
            
            const response = await axios.get(endpoint, { withCredentials: true });
            setUsers(response.data[type] || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnfollow = async (targetUserId: number) => {
        try {
            await axios.delete(`/api/user/${targetUserId}/follow`, 
                { withCredentials: true });
            
            fetchUsers();
        } catch (error) {
            console.error('Error unfollowing user:', error);
        }
    };

    const handleFollow = async (targetUserId: number) => {
        try {
            await axios.post(`/api/user/${targetUserId}/follow`, 
                {}, 
                { withCredentials: true });
            
            fetchUsers();
        } catch (error) {
            console.error('Error following user:', error);
        }
    };

    const handleUserClick = (userId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        onClose();
        navigate(`/user/${userId}`);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{type === 'followers' ? 'Подписчики' : 'Подписки'}</h3>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    {loading ? (
                        <div className="loading">Загрузка...</div>
                    ) : users.length === 0 ? (
                        <div className="empty-state">
                            {type === 'followers' ? 'Нет подписчиков' : 'Нет подписок'}
                        </div>
                    ) : (
                        users.map((user) => (
                            <div 
                                key={user.follow_id} 
                                className="user-item"
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => handleUserClick(user.id, e)}
                            >
                                <img 
                                    src={user.image_url || 'https://i.pravatar.cc/150'} 
                                    alt={user.username}
                                    className="user-avatar-small"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://i.pravatar.cc/150';
                                    }}
                                />
                                <div className="user-info">
                                    <strong className="username">{user.username}</strong>
                                    {user.bio && (
                                        <p className="user-bio-small">{user.bio}</p>
                                    )}
                                </div>
                                
                                {currentUser && currentUser.id !== user.id && (
                                    <div 
                                        className="user-actions"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {type === 'following' && currentUser?.id === userId ? (
                                            <button 
                                                className="unfollow-button"
                                                onClick={() => handleUnfollow(user.id)}
                                            >
                                                Отписаться
                                            </button>
                                        ) : type === 'followers' && currentUser?.id === userId ? (
                                            <button 
                                                className="follow-back-button"
                                                onClick={() => handleFollow(user.id)}
                                            >
                                                Подписаться
                                            </button>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowersModal;