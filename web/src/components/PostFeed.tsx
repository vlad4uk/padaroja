// src/components/PostFeed.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './UserPostsFeed.css'; 
import { FaRegBookmark, FaUserCircle } from 'react-icons/fa'; 
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
    preview_text: string;
    photos: { url: string }[];
    likes_count: number;
    user_id: number; 
    username?: string;
}

// 1. Принимаем пропсы поиска
interface PostFeedProps {
    searchQuery?: string;
    tagQuery?: string;
}

const PostFeed: React.FC<PostFeedProps> = ({ searchQuery = '', tagQuery = '' }) => {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Модальное окно жалобы
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    // 2. Обновленный useEffect с поддержкой поиска и Debounce
    useEffect(() => {
        // Устанавливаем таймер (Debounce), чтобы не спамить API при каждом нажатии клавиши
        const delayDebounceFn = setTimeout(async () => {
            setLoading(true);
            try {
                // Формируем URL с параметрами
                // Backend ожидает: ?search=...&tags=...
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
        }, 500); // Задержка 500мс

        // Очистка таймера, если пользователь продолжает печатать
        return () => clearTimeout(delayDebounceFn);
        
    }, [searchQuery, tagQuery]); // 👈 Перезапускаем эффект при изменении ввода

    // --- Обработчики (остаются без изменений) ---
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

    if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Загрузка...</div>;
    if (error) return <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</div>;
    if (posts.length === 0) return <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Публикации не найдены.</div>;

    return (
        <div className="posts-grid">
            {posts.map(post => (
                <div key={post.id} className="post-card">
                    <div className="post-header">
                        <div className="post-user-info">
                            <FaUserCircle className="user-avatar-placeholder" /> 
                            <span className="post-username">{post.username || `User #${post.user_id}`}</span>
                        </div>
                        <PostActionsMenu 
                            postID={post.id} 
                            postAuthorID={post.user_id}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onReport={handleReport}
                        />
                    </div>

                    <div className="post-photo-preview" onClick={() => handlePostClick(post.id)}>
                        <img 
                            src={post.photos && post.photos.length > 0 ? post.photos[0].url : 'https://via.placeholder.com/400x300?text=Нет+Фото'} 
                            alt={post.title} 
                        />
                    </div>

                    <div className="post-content">
                        <h3 className="post-title" onClick={() => handlePostClick(post.id)}>{post.title}</h3>
                        <p className="post-text">{post.preview_text}</p>
                    </div>

                    <div className="post-footer">
                        <div className="post-meta-left">
                            <span className="post-place">{post.place_name}</span>
                            <span className="post-tags">
                                {(post.tags ?? []).length > 0 ? ' #' + (post.tags ?? []).join(' #') : ''}
                            </span>
                        </div>
                        <div className="post-meta-right">
                             <div className="meta-icon-group" style={{ background: 'none', border: '1px solid #333', padding: '2px 4px', borderRadius: '4px' }}>
                                <BsGlobeAmericas style={{ color: '#2c8c98' }} /> 
                                <span className="map-count">{post.likes_count}</span>
                            </div>
                            <FaRegBookmark className="icon-bookmark" /> 
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