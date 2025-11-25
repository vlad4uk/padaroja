// src/components/PostFeed.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './UserPostsFeed.css'; // Используем CSS, общий для лент постов
import { FaRegBookmark } from 'react-icons/fa'; // FaUserCircle удален
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
    username?: string; // Остается, но не используется в дизайне
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

    // Модальное окно жалобы
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    // Функция форматирования даты (из "2025-11-18T12:00:00Z" в "18.11.2025")
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    };

    // 2. Обновленный useEffect с поддержкой поиска и Debounce
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

    // --- Обработчики ---
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
                <div 
                    key={post.id} 
                    className="post-card"
                    // Обработчик клика на всю карточку для перехода
                    onClick={() => handlePostClick(post.id)} 
                    style={{ cursor: 'pointer' }}
                >
                    
                    {/* КНОПКА ДЕЙСТВИЙ (ОСТАЕТСЯ, но стилизуется через CSS, чтобы не мешать общему потоку) */}
                    <div className="post-actions-overlay" onClick={(e) => e.stopPropagation()}>
                        <PostActionsMenu 
                            postID={post.id} 
                            postAuthorID={post.user_id}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onReport={handleReport}
                        />
                    </div>

                    {/* 1. Слайдер фото (Копируем из UserPostsList.tsx) */}
                    <div className="post-photos-slider">
                        {post.photos && post.photos.length > 0 ? (
                            post.photos.map((photo, idx) => (
                                <img 
                                    key={idx} 
                                    src={photo.url} 
                                    alt="Post slide" 
                                    className="post-photo-img" 
                                />
                            ))
                        ) : (
                            <div className="post-photo-placeholder">Нет фото</div>
                        )}
                    </div>

                    {/* 2. Заголовок и дата (Копируем из UserPostsList.tsx) */}
                    <div className="post-header-row">
                        <span className="post-title">{post.title}</span>
                        <span className="post-date">{formatDate(post.created_at)}</span>
                    </div>

                    {/* 3. Текст публикации (Тизер) (Копируем из UserPostsList.tsx) */}
                    <div className="post-text-content">
                        {post.preview_text ? (
                             post.preview_text.length > 150 
                                ? post.preview_text.substring(0, 150) + '...' 
                                : post.preview_text
                        ) : (
                            <span style={{color: '#ccc'}}>Нет описания...</span>
                        )}
                    </div>

                    {/* 4. Футер (Место и иконки) (Копируем из UserPostsList.tsx) */}
                    <div className="post-footer">
                        <div className="post-meta-left">
                            <span className="post-place">{post.place_name}</span>
                            <span className="post-tags">
                                {(post.tags ?? []).length > 0 
                                    ? ' #' + (post.tags ?? []).join(' #') 
                                    : ''}
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
            
            {/* Модальное окно жалобы (Остается) */}
            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                onSubmit={handleSubmitReport}
            />
        </div>
    );
};

export default PostFeed;