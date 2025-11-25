// src/components/PostFeed.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './UserPostsFeed.css';
import { FaRegBookmark } from 'react-icons/fa';
import { BsGlobeAmericas } from "react-icons/bs";
import { useNavigate } from 'react-router-dom';
import PostActionsMenu from './PostActionsMenu.tsx'; 
import ReportModal from './ReportModal.tsx';

interface PostData {
    id: number;
    title: string;
    created_at: string;
    place_name: string;
    tags: string[];
    photos: { url: string }[];
    likes_count: number;
    user_id: number;
    user_avatar: string; // Firebase путь к аватару
    user_name: string;   // Username пользователя
}

interface PostFeedProps {
    searchQuery?: string;
    tagQuery?: string;
}

const PostFeed: React.FC<PostFeedProps> = ({ searchQuery = '', tagQuery = '' }) => {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (searchQuery) params.append('search', searchQuery);
                if (tagQuery) params.append('tags', tagQuery);

                const response = await axios.get(`http://localhost:8080/api/posts?${params.toString()}`, { 
                    withCredentials: true 
                });
                
                setPosts(response.data || []);
                setError('');
            } catch (err) {
                console.error("Ошибка при получении постов:", err);
                setError('Не удалось загрузить ленту.');
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, tagQuery]);

    const handlePostClick = (id: number) => navigate(`/post/${id}`);
    const handleEdit = (id: number) => navigate(`/post/edit/${id}`);
    
    const handleDelete = async (id: number) => {
        if (!window.confirm("Удалить этот пост?")) return;
        try {
            await axios.delete(`http://localhost:8080/api/posts/${id}`, { withCredentials: true });
            setPosts(prev => prev.filter(post => post.id !== id));
        } catch (err) { alert("Ошибка удаления"); }
    };

    const handleReport = (id: number) => {
        setReportPostId(id);
        setReportModalOpen(true);
    };

    // Обработчик клика на пользователя
    const handleUserClick = (userId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        navigate(`/user/${userId}`);
    };

    const handleSubmitReport = async (reason: string) => {
        if (!reportPostId) return;
        try {
            await axios.post(`http://localhost:8080/api/posts/${reportPostId}/report`, 
                { reason: reason }, { withCredentials: true }
            );
            alert("Жалоба отправлена.");
            setReportModalOpen(false);
        } catch (err: any) {
            alert(err.response?.status === 401 ? "Нужно авторизоваться." : "Ошибка отправки.");
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Загрузка...</div>;
    if (error) return <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</div>;
    if (posts.length === 0) return <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Публикации не найдены.</div>;

    return (
        <div className="posts-grid">
            {posts.map(post => (
                <div 
                    key={post.id} 
                    className="post-card-new"
                    onClick={() => handlePostClick(post.id)} 
                    style={{ 
                        backgroundImage: post.photos && post.photos.length > 0 
                            ? `url(${post.photos[0].url})` 
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                >
                    {/* Затемняющий оверлей для лучшей читаемости текста */}
                    <div className="post-card-overlay"></div>
                    
                    {/* Кнопка действий */}
                    <div className="post-actions-overlay" onClick={(e) => e.stopPropagation()}>
                        <PostActionsMenu 
                            postID={post.id} 
                            postAuthorID={post.user_id}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onReport={handleReport}
                        />
                    </div>

                    {/* Информация о пользователе */}
                    <div 
                        className="post-user-info"
                        onClick={(e) => handleUserClick(post.user_id, e)}
                        style={{ cursor: 'pointer' }}
                    >
                        <img 
                            src={post.user_avatar || '/default-avatar.png'} 
                            alt="Avatar" 
                            className="post-user-avatar" 
                            onError={(e) => {
                                e.currentTarget.src = '/default-avatar.png';
                            }}
                        />
                        <span className="post-user-name">{post.user_name}</span>
                    </div>

                    {/* Заголовок и дата */}
                    <div className="post-header-row-new">
                        <span className="post-title-new">{post.title}</span>
                        <span className="post-date-new">{formatDate(post.created_at)}</span>
                    </div>

                    {/* Футер (Место и теги) */}
                    <div className="post-footer-new">
                        <div className="post-meta-left-new">
                            <span className="post-place-new">{post.place_name}</span>
                            <span className="post-tags-new">
                                {(post.tags ?? []).length > 0 
                                    ? ' #' + (post.tags ?? []).join(' #') 
                                    : ''}
                            </span>
                        </div>

                        <div className="post-meta-right-new">
                            <div className="meta-icon-group-new">
                                <BsGlobeAmericas style={{ color: '#fff' }} /> 
                                <span className="map-count-new">{post.likes_count}</span>
                            </div>
                            
                            <FaRegBookmark className="icon-bookmark-new" /> 
                        </div>
                    </div>
                </div>
            ))}
            
            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                onSubmit={handleSubmitReport}
            />
        </div>
    );
};

export default PostFeed;