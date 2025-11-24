// src/components/UserPostsFeed.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './UserPostsFeed.css';
import { FaRegBookmark } from 'react-icons/fa';
import { BsGlobeAmericas } from "react-icons/bs";
import { useNavigate } from 'react-router-dom'; // ✅ Импорт

// Интерфейс, соответствующий ответу Go (PostResponse)
interface PostData {
    id: string; // UUID это строка
    title: string;
    created_at: string;
    place_name: string;
    tags: string[];
    preview_text: string; // Текст первого слайда
    photos: { url: string }[]; // Нам нужен только url от фото
    likes_count: number;
}

const UserPostsFeed: React.FC = () => {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const navigate = useNavigate(); // ✅ Хук навигации

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const response = await axios.get('http://localhost:8080/api/user/posts', {
                    withCredentials: true // Обязательно для Auth
                });
                setPosts(response.data || []);
            } catch (err) {
                console.error("Ошибка при загрузке постов:", err);
                setError('Не удалось загрузить публикации');
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, []);

    // Функция форматирования даты (из "2025-11-18T12:00:00Z" в "18.11.2025")
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    };

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка публикаций...</div>;
    if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>;
    if (!posts || posts.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Публикаций пока нет.</div>;   

    const handlePostClick = (id: string) => {
        navigate(`/post/${id}`); // ✅ Переход на страницу поста
    };

    return (
        <div className="posts-grid">
            {posts.map((post) => (
                <div key={post.id} className="post-card"
                onClick={() => handlePostClick(post.id)} // ✅ Обработчик клика
                    style={{ cursor: 'pointer' }}
                >
                    
                    {/* 1. Слайдер фото */}
                    {/* Если фото есть - показываем их. Если нет - показываем заглушку или ничего */}
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
                            // Если фото нет, можно показать заглушку, как на дизайне
                            <div className="post-photo-placeholder">Нет фото</div>
                        )}
                    </div>

                    {/* 2. Заголовок и дата */}
                    <div className="post-header-row">
                        <span className="post-title">{post.title}</span>
                        <span className="post-date">{formatDate(post.created_at)}</span>
                    </div>

                    {/* 3. Текст публикации (Тизер из 1 слайда) */}
                    <div className="post-text-content">
                        {/* Обрезаем текст, если он слишком длинный, для красоты карточки */}
                        {post.preview_text ? (
                             post.preview_text.length > 150 
                                ? post.preview_text.substring(0, 150) + '...' 
                                : post.preview_text
                        ) : (
                            <span style={{color: '#ccc'}}>Нет описания...</span>
                        )}
                    </div>

                    {/* 4. Футер (Место и иконки) */}
                    <div className="post-footer">
                        <div className="post-meta-left">
                            <span className="post-place">{post.place_name}</span>
                            {/* Теги */}
                           {/* Теги */}
                            <span className="post-tags">
                                {(post.tags ?? []).length > 0 
                                    ? ' #' + (post.tags ?? []).join(' #') 
                                    : ''}
                            </span>
                        </div>

                        <div className="post-meta-right">
                            {/* Иконка с цифрой (лайки) */}
                            <div className="meta-icon-group" style={{ background: 'none', border: '1px solid #333', padding: '2px 4px', borderRadius: '4px' }}>
                                <BsGlobeAmericas style={{ color: '#2c8c98' }} /> 
                                <span className="map-count">{post.likes_count}</span>
                            </div>
                            
                            {/* Закладка */}
                            <FaRegBookmark className="icon-bookmark" style={{ strokeWidth: '20px' }} /> 
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserPostsFeed;