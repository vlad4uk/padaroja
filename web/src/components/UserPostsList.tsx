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
    user_avatar: string;
    user_name: string;
}

interface UserPostsListProps {
    targetUserId?: number;
}

const UserPostsList: React.FC<UserPostsListProps> = ({ targetUserId }) => {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                let url: string;
                
                // ✅ ИСПРАВЛЕНО: Правильное определение URL
                if (targetUserId) {
                    // Загружаем посты указанного пользователя
                    url = `http://localhost:8080/api/user/${targetUserId}/posts`;
                    console.log(`Loading posts for user ID: ${targetUserId}, URL: ${url}`);
                } else {
                    // Загружаем посты текущего пользователя
                    url = 'http://localhost:8080/api/user/posts';
                    console.log('Loading posts for current user');
                }
                
                const response = await axios.get(url, {
                    withCredentials: true,      
                });
                console.log('Posts loaded:', response.data);
                setPosts(response.data || []);
            } catch (err: any) {
                console.error("Ошибка при загрузке постов:", err);
                console.error("URL был:", err.config?.url);
                console.error("Status:", err.response?.status);
                setError('Не удалось загрузить публикации');
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, [targetUserId]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    };

    // переход на профиль
    const handleUserClick = (userId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        navigate(`/user/${userId}`);
    };

    // Обработчики действий
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

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка публикаций...</div>;
    if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>;
    if (!posts || posts.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Публикаций пока нет.</div>;   

    return (
        <div className="posts-grid">
            {posts.map((post) => (
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
            
            {/* Модальное окно жалобы */}
            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                onSubmit={handleSubmitReport}
            />
        </div>
    );
};

export default UserPostsList;