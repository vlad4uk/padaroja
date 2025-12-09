// src/components/PostFeed.tsx

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import './UserPostsFeed.css';
import { FaRegBookmark, FaBookmark } from 'react-icons/fa';
import { BsGlobeAmericas } from "react-icons/bs";
import { useNavigate } from 'react-router-dom';
import PostActionsMenu from './PostActionsMenu.tsx'; 
import ReportModal from './ReportModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';

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
    is_favourite?: boolean;
    is_liked?: boolean;
}

interface PostFeedProps {
    searchQuery?: string;
    tagQuery?: string;
    isFavourites?: boolean;
    isLikes?: boolean;
}

const PostFeed: React.FC<PostFeedProps> = ({ 
    searchQuery = '', 
    tagQuery = '', 
    isFavourites = false, 
    isLikes = false 
}) => {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [favourites, setFavourites] = useState<Set<number>>(new Set<number>());
    const [likes, setLikes] = useState<Set<number>>(new Set<number>());
    const [clickedPostId, setClickedPostId] = useState<number | null>(null);
    const [clickedLikePostId, setClickedLikePostId] = useState<number | null>(null);
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    // Форматирование даты
    const formatDate = useCallback((dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }, []);

    // Загрузка статуса избранного
    const loadFavouritesStatus = useCallback(async (postIds: number[]) => {
        if (!isLoggedIn || postIds.length === 0) {
            setFavourites(new Set<number>());
            return;
        }
        
        try {
            const favouritePromises = postIds.map(postId => 
                axios.get<{is_favourite: boolean}>(`/api/favourites/check/${postId}`, {
                    withCredentials: true
                })
            );
            
            const results = await Promise.all(favouritePromises);
            const favouriteIds = new Set<number>(
                results
                    .filter(result => result.data.is_favourite)
                    .map(result => {
                        const url = result.config.url;
                        const postIdMatch = url?.match(/check\/(\d+)/);
                        return postIdMatch ? parseInt(postIdMatch[1]) : 0;
                    })
                    .filter(id => id > 0)
            );
            
            setFavourites(favouriteIds);
        } catch (err) {
            console.error("Ошибка при загрузке статуса избранного:", err);
            setFavourites(new Set<number>());
        }
    }, [isLoggedIn]);

    // Загрузка статуса лайков
    const loadLikesStatus = useCallback(async (postIds: number[]) => {
        if (!isLoggedIn || postIds.length === 0) {
            setLikes(new Set<number>());
            return;
        }
        
        try {
            const likePromises = postIds.map(postId => 
                axios.get<{is_liked: boolean}>(`/api/likes/check/${postId}`, {
                    withCredentials: true
                })
            );
            
            const results = await Promise.all(likePromises);
            const likedIds = new Set<number>(
                results
                    .filter(result => result.data.is_liked)
                    .map(result => {
                        const url = result.config.url;
                        const postIdMatch = url?.match(/check\/(\d+)/);
                        return postIdMatch ? parseInt(postIdMatch[1]) : 0;
                    })
                    .filter(id => id > 0)
            );
            
            setLikes(likedIds);
        } catch (err) {
            console.error("Ошибка при загрузке статуса лайков:", err);
            setLikes(new Set<number>());
        }
    }, [isLoggedIn]);

    // Загрузка количества лайков для всех постов
    const loadLikesCounts = useCallback(async (postIds: number[]) => {
        if (postIds.length === 0) return;
        
        try {
            const countPromises = postIds.map(postId => 
                axios.get<{likes_count: number}>(`/api/likes/count/${postId}`, {
                    withCredentials: true
                })
            );
            
            const results = await Promise.all(countPromises);
            
            // Создаем мапу для обновления постов
            const likesCountMap = new Map<number, number>();
            results.forEach((result, index) => {
                const postId = postIds[index];
                likesCountMap.set(postId, result.data.likes_count);
            });
            
            // Обновляем посты
            setPosts(prev => prev.map(post => 
                likesCountMap.has(post.id) 
                    ? { ...post, likes_count: likesCountMap.get(post.id)! }
                    : post
            ));
        } catch (err) {
            console.error("Ошибка при загрузке количества лайков:", err);
        }
    }, []);

    // Загрузка постов
    const loadPosts = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/api/posts';
            const params = new URLSearchParams();
            
            if (isFavourites) {
                // Запрос для закладок
                url = '/api/favourites';
            } else if (isLikes) {
                // Запрос для лайков
                url = '/api/likes';
            } else {
                if (searchQuery) params.append('search', searchQuery);
                if (tagQuery) params.append('tags', tagQuery);
            }

            const response = await axios.get<PostData[]>(
                isFavourites || isLikes ? url : `${url}?${params.toString()}`, 
                { withCredentials: true }
            );
            
            let postsData = response.data || [];
            
            // Для всех страниц загружаем актуальное количество лайков
            const postIds = postsData.map((post: PostData) => post.id);
            if (postIds.length > 0) {
                // Загружаем актуальные счетчики лайков
                const countPromises = postIds.map(postId => 
                    axios.get<{likes_count: number}>(`/api/likes/count/${postId}`, {
                        withCredentials: true
                    })
                );
                
                const countResults = await Promise.all(countPromises);
                
                // Обновляем данные постов с актуальными счетчиками
                postsData = postsData.map((post, index) => ({
                    ...post,
                    likes_count: countResults[index].data.likes_count
                }));
            }
            
            setPosts(postsData);
            
            if (isFavourites) {
                // Для страницы закладок все посты уже в избранном
                const favouriteIds = new Set<number>(postsData.map((post: PostData) => post.id));
                setFavourites(favouriteIds);
            } else if (isLikes) {
                // Для страницы лайков все посты уже лайкнуты
                const likedIds = new Set<number>(postsData.map((post: PostData) => post.id));
                setLikes(likedIds);
            } else {
                // Для общей ленты загружаем статусы
                await loadFavouritesStatus(postIds);
                await loadLikesStatus(postIds);
            }
            
            setError('');
        } catch (err: any) {
            console.error("Ошибка при получении постов:", err);
            if (err.response?.status === 401 && (isFavourites || isLikes)) {
                setError('Необходимо авторизоваться');
            } else {
                setError('Не удалось загрузить ленту.');
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery, tagQuery, isFavourites, isLikes, loadFavouritesStatus, loadLikesStatus]);

    // Работа с закладками
    const toggleFavourite = useCallback(async (postId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        
        // Защита от множественных кликов
        if (clickedPostId === postId) return;
        setClickedPostId(postId);
        
        // Оптимистичное обновление UI
        const wasFavourite = favourites.has(postId);
        const newFavourites = new Set<number>(favourites);
        
        if (wasFavourite) {
            newFavourites.delete(postId);
        } else {
            newFavourites.add(postId);
        }
        setFavourites(newFavourites);
        
        try {
            if (wasFavourite) {
                // Удаляем из закладок
                await axios.delete(`/api/favourites/${postId}`, {
                    withCredentials: true
                });
                
                // Если мы на странице закладок, удаляем пост из списка
                if (isFavourites) {
                    setPosts(prev => prev.filter(post => post.id !== postId));
                }
            } else {
                // Добавляем в закладки
                await axios.post(`/api/favourites/${postId}`, {}, {
                    withCredentials: true
                });
            }
        } catch (err: any) {
            console.error("Ошибка при обновлении закладки:", err);
            
            // Откатываем оптимистичное обновление при ошибке
            const revertedFavourites = new Set<number>(favourites);
            setFavourites(revertedFavourites);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            } else if (err.response?.status === 409) {
                // Если пост уже в избранном, обновляем состояние
                revertedFavourites.add(postId);
                setFavourites(revertedFavourites);
            } else {
                alert("Не удалось обновить закладку");
            }
        } finally {
            // Снимаем блокировку
            setTimeout(() => setClickedPostId(null), 300);
        }
    }, [favourites, isFavourites, navigate, clickedPostId]);

    // Работа с лайками (иконка земли)
    const toggleLike = useCallback(async (postId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        
        // Защита от множественных кликов
        if (clickedLikePostId === postId) return;
        setClickedLikePostId(postId);
        
        // Оптимистичное обновление UI
        const wasLiked = likes.has(postId);
        const newLikes = new Set<number>(likes);
        
        if (wasLiked) {
            newLikes.delete(postId);
        } else {
            newLikes.add(postId);
        }
        setLikes(newLikes);
        
        try {
            if (wasLiked) {
                // Удаляем лайк
                await axios.delete(`/api/likes/${postId}`, {
                    withCredentials: true
                });
                
                // Если мы на странице лайков, удаляем пост из списка
                if (isLikes) {
                    setPosts(prev => prev.filter(post => post.id !== postId));
                }
            } else {
                // Добавляем лайк
                await axios.post(`/api/likes/${postId}`, {}, {
                    withCredentials: true
                });
            }
            
            // После успешного действия обновляем актуальное количество лайков для ВСЕХ постов
            setTimeout(() => {
                const allPostIds = posts.map(post => post.id);
                if (allPostIds.length > 0) {
                    loadLikesCounts(allPostIds);
                }
            }, 100);
            
        } catch (err: any) {
            console.error("Ошибка при обновлении лайка:", err);
            
            // Откатываем оптимистичное обновление при ошибке
            const revertedLikes = new Set<number>(likes);
            setLikes(revertedLikes);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            } else if (err.response?.status === 409) {
                // Если пост уже лайкнут, обновляем состояние
                revertedLikes.add(postId);
                setLikes(revertedLikes);
            } else {
                alert("Не удалось обновить лайк");
            }
        } finally {
            // Снимаем блокировку
            setTimeout(() => setClickedLikePostId(null), 300);
        }
    }, [likes, posts, isLikes, navigate, clickedLikePostId, loadLikesCounts]);

    // Обработчики постов
    const handlePostClick = useCallback((id: number) => {
        navigate(`/post/${id}`);
    }, [navigate]);

    const handleUserClick = useCallback((userId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        navigate(`/user/${userId}`);
    }, [navigate]);

    const handleEdit = useCallback((id: number) => {
        navigate(`/post/edit/${id}`);
    }, [navigate]);

    const handleDelete = useCallback(async (id: number) => {
        if (!window.confirm("Удалить этот пост?")) return;
        try {
            await axios.delete(`/api/posts/${id}`, { withCredentials: true });
            setPosts(prev => prev.filter(post => post.id !== id));
            // Также удаляем из favourites и likes если были там
            const newFavourites = new Set<number>(favourites);
            const newLikes = new Set<number>(likes);
            newFavourites.delete(id);
            newLikes.delete(id);
            setFavourites(newFavourites);
            setLikes(newLikes);
        } catch (err) { 
            alert("Ошибка удаления"); 
        }
    }, [favourites, likes]);

    const handleReport = useCallback((id: number) => {
        setReportPostId(id);
        setReportModalOpen(true);
    }, []);

    const handleSubmitReport = useCallback(async (reason: string) => {
        if (!reportPostId) return;
        try {
            await axios.post(`/api/posts/${reportPostId}/report`, 
                { reason: reason }, { withCredentials: true }
            );
            alert("Жалоба отправлена.");
            setReportModalOpen(false);
        } catch (err: any) {
            alert(err.response?.status === 401 ? "Нужно авторизоваться." : "Ошибка отправки.");
        }
    }, [reportPostId]);

    // Загрузка данных при изменении параметров
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadPosts();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [loadPosts]);

    // Состояния загрузки и ошибок
    if (loading) {
        return (
            <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                color: '#666',
                fontSize: '16px'
            }}>
                Загрузка...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#e74c3c',
                fontSize: '16px'
            }}>
                {error}
            </div>
        );
    }

    if (posts.length === 0) {
        let message = 'Публикации не найдены';
        if (isFavourites) message = 'Закладок пока нет';
        if (isLikes) message = 'Лайков пока нет';
        
        return (
            <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px', 
                color: '#7f8c8d',
                fontSize: '18px'
            }}>
                {message}
            </div>
        );
    }

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
                            {/* Иконка лайка (земля с счетчиком) */}
                            {isLoggedIn && (
                                <div 
                                    className="meta-icon-group-new"
                                    onClick={(e) => toggleLike(post.id, e)}
                                    style={{ 
                                        cursor: clickedLikePostId === post.id ? 'not-allowed' : 'pointer',
                                        opacity: clickedLikePostId === post.id ? 0.6 : 1
                                    }}
                                >
                                    <BsGlobeAmericas style={{ 
                                        color: likes.has(post.id) ? '#e74c3c' : '#fff' 
                                    }} /> 
                                    <span className="map-count-new">{post.likes_count}</span>
                                </div>
                            )}
                            
                            {/* Иконка закладки */}
                            {isLoggedIn && (
                                <div 
                                    className="icon-bookmark-new" 
                                    onClick={(e) => toggleFavourite(post.id, e)}
                                    style={{ 
                                        cursor: clickedPostId === post.id ? 'not-allowed' : 'pointer',
                                        opacity: clickedPostId === post.id ? 0.6 : 1
                                    }}
                                >
                                    {favourites.has(post.id) ? (
                                        <FaBookmark style={{ color: '#ffd700' }} />
                                    ) : (
                                        <FaRegBookmark style={{ color: '#fff' }} />
                                    )}
                                </div>
                            )}
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