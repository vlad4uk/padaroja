import React, { useEffect, useState, useCallback, useRef } from 'react';
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
    settlement_name: string;
    settlement_id: number;
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
    sortBy?: string;
    isFavourites?: boolean;
    isLikes?: boolean;
}

interface SSEMessage {
    type: 'NEW_POST' | 'UPDATE_POST' | 'DELETE_POST' | 'HEARTBEAT' | 'CONNECTED';
    data: any;
}

const PostFeed: React.FC<PostFeedProps> = ({
    searchQuery = '',
    tagQuery = '',
    sortBy = 'new',
    isFavourites = false,
    isLikes = false
}) => {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [favourites, setFavourites] = useState<Set<number>>(new Set<number>());
    const [likes, setLikes] = useState<Set<number>>(new Set<number>());
    const [processingFavourite, setProcessingFavourite] = useState<Set<number>>(new Set());
    const [processingLike, setProcessingLike] = useState<Set<number>>(new Set());
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);
    const [sseConnected, setSseConnected] = useState(false);
    const [likesCounts, setLikesCounts] = useState<Map<number, number>>(new Map());

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const formatDate = useCallback((dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        });
    }, []);

    // Загрузка статусов избранного и лайков
    const loadInteractionStatuses = useCallback(async (postIds: number[]) => {
        if (!isLoggedIn || postIds.length === 0 || isFavourites || isLikes) return;

        try {
            // Загружаем статусы избранного
            const favResponse = await axios.get<{[key: string]: boolean}>('/api/favourites/check-multiple', {
                params: { post_ids: postIds.join(',') },
                withCredentials: true,
                timeout: 5000
            });

            const favouriteIds = new Set<number>();
            Object.entries(favResponse.data).forEach(([id, isFav]) => {
                if (isFav) favouriteIds.add(parseInt(id));
            });
            setFavourites(favouriteIds);

            // Загружаем статусы лайков по одному (более надежно)
            const likedIds = new Set<number>();
            
            for (const postId of postIds) {
                try {
                    const response = await axios.get<{is_liked: boolean}>(`/api/likes/check/${postId}`, {
                        withCredentials: true,
                        timeout: 3000
                    });
                    if (response.data.is_liked) {
                        likedIds.add(postId);
                    }
                } catch (err) {
                    console.error(`Ошибка при проверке лайка для поста ${postId}:`, err);
                }
            }
            
            setLikes(likedIds);

        } catch (err) {
            console.error("Ошибка при загрузке статусов:", err);
        }
    }, [isLoggedIn, isFavourites, isLikes]);

    // Загрузка количества лайков
    const loadLikesCounts = useCallback(async (postIds: number[]) => {
        if (postIds.length === 0) return;

        try {
            const countPromises = postIds.map(postId =>
                axios.get<{likes_count: number}>(`/api/likes/count/${postId}`, {
                    withCredentials: true,
                    timeout: 5000
                })
            );

            const countResults = await Promise.all(countPromises);
            const newLikesCounts = new Map<number, number>();

            countResults.forEach((result, index) => {
                newLikesCounts.set(postIds[index], result.data.likes_count);
            });

            setLikesCounts(newLikesCounts);

            setPosts(prev => prev.map(post => ({
                ...post,
                likes_count: newLikesCounts.get(post.id) ?? post.likes_count
            })));
        } catch (err) {
            console.error("Ошибка при загрузке количества лайков:", err);
        }
    }, []);

    // Загрузка постов
    const loadPosts = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            let url = '/api/posts';
            const params = new URLSearchParams();

            if (isFavourites) {
                url = '/api/favourites';
            } else if (isLikes) {
                url = '/api/likes';
            } else {
                if (searchQuery) params.append('search', searchQuery);
                if (tagQuery) params.append('tags', tagQuery);
                if (sortBy) params.append('sort', sortBy);
            }

            const response = await axios.get<PostData[]>(
                isFavourites || isLikes ? url : `${url}?${params.toString()}`,
                { 
                    withCredentials: true,
                    timeout: 10000
                }
            );

            let postsData = response.data || [];
            
            // Нормализуем данные
            postsData = postsData.map(post => ({
                ...post,
                likes_count: post.likes_count || 0
            }));
            
            setPosts(postsData);

            // Загружаем дополнительные данные
            if (postsData.length > 0) {
                const postIds = postsData.map(post => post.id);

                if (isFavourites) {
                    const favouriteIds = new Set<number>(postIds);
                    setFavourites(favouriteIds);
                } else if (isLikes) {
                    const likedIds = new Set<number>(postIds);
                    setLikes(likedIds);
                }

                if (isLoggedIn && !isFavourites && !isLikes) {
                    await loadInteractionStatuses(postIds);
                }

                await loadLikesCounts(postIds);
            }

        } catch (err: any) {
            console.error("Ошибка при получении постов:", err);
            if (err.code === 'ECONNABORTED') {
                setError('Превышено время ожидания. Проверьте подключение к серверу.');
            } else if (err.response?.status === 401) {
                if (isFavourites || isLikes) {
                    setError('Необходимо авторизоваться для просмотра этой страницы');
                }
            } else if (err.response?.status === 404) {
                setError('Ресурс не найден');
            } else {
                setError('Не удалось загрузить ленту. Пожалуйста, попробуйте позже.');
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery, tagQuery, sortBy, isFavourites, isLikes, isLoggedIn, loadInteractionStatuses, loadLikesCounts]);

    // SSE подключение - НЕ подключаемся на страницах избранного и лайков
    useEffect(() => {
        // Не подключаем SSE на страницах избранного и лайков
        if (isFavourites || isLikes) {
            return;
        }

        const connectSSE = () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const url = new URL('/api/posts/stream', window.location.origin);
            if (searchQuery) url.searchParams.append('search', searchQuery);
            if (tagQuery) url.searchParams.append('tags', tagQuery);
            if (sortBy) url.searchParams.append('sort', sortBy);

            const eventSource = new EventSource(url.toString(), {
                withCredentials: true
            });

            eventSource.onopen = () => {
                console.log('SSE connection opened');
                setSseConnected(true);
                reconnectAttemptsRef.current = 0;
            };

            eventSource.onmessage = (event) => {
                try {
                    const message: SSEMessage = JSON.parse(event.data);

                    if (message.type === 'HEARTBEAT' || message.type === 'CONNECTED') {
                        return;
                    }

                    switch (message.type) {
                        case 'NEW_POST': {
                            const newPost = message.data as PostData;

                            // Проверяем фильтры
                            if (searchQuery) {
                                const matchesSearch = 
                                    newPost.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    newPost.settlement_name?.toLowerCase().includes(searchQuery.toLowerCase());
                                if (!matchesSearch) return;
                            }

                            if (tagQuery && newPost.tags) {
                                const matchesTag = newPost.tags.some((tag: string) =>
                                    tag.toLowerCase().includes(tagQuery.toLowerCase())
                                );
                                if (!matchesTag) return;
                            }

                            setPosts(prev => [newPost, ...prev]);

                            // Загружаем статусы для нового поста
                            if (isLoggedIn) {
                                loadInteractionStatuses([newPost.id]);
                                loadLikesCounts([newPost.id]);
                            }
                            break;
                        }

                        case 'UPDATE_POST': {
                            setPosts(prev => prev.map(post =>
                                post.id === message.data.id ? { ...post, ...message.data } : post
                            ));
                            break;
                        }

                        case 'DELETE_POST': {
                            const postId = message.data.postId;
                            setPosts(prev => prev.filter(post => post.id !== postId));
                            
                            setFavourites(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(postId);
                                return newSet;
                            });
                            setLikes(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(postId);
                                return newSet;
                            });
                            break;
                        }
                    }
                } catch (err) {
                    console.error('Error parsing SSE message:', err);
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE connection error:', err);
                setSseConnected(false);
                eventSource.close();

                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    
                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                    }

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
                        connectSSE();
                    }, delay);
                }
            };

            eventSourceRef.current = eventSource;
        };

        connectSSE();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [searchQuery, tagQuery, sortBy, isFavourites, isLikes, isLoggedIn, loadInteractionStatuses, loadLikesCounts]);

    // Загрузка постов при изменении параметров
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadPosts();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [loadPosts]);

    // Обработчик избранного
    const toggleFavourite = useCallback(async (postId: number, event: React.MouseEvent) => {
        event.stopPropagation();

        if (!isLoggedIn) {
            navigate('/login');
            return;
        }

        if (processingFavourite.has(postId)) return;
        setProcessingFavourite(prev => new Set(prev).add(postId));

        const wasFavourite = favourites.has(postId);
        
        // Оптимистичное обновление UI
        setFavourites(prev => {
            const newSet = new Set(prev);
            if (wasFavourite) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });

        try {
            if (wasFavourite) {
                await axios.delete(`/api/favourites/${postId}`, {
                    withCredentials: true,
                    timeout: 5000
                });

                if (isFavourites) {
                    setPosts(prev => prev.filter(post => post.id !== postId));
                }
            } else {
                await axios.post(`/api/favourites/${postId}`, {}, {
                    withCredentials: true,
                    timeout: 5000
                });
            }
        } catch (err: any) {
            console.error("Ошибка при обновлении закладки:", err);

            setFavourites(prev => {
                const newSet = new Set(prev);
                if (wasFavourite) {
                    newSet.add(postId);
                } else {
                    newSet.delete(postId);
                }
                return newSet;
            });

            if (err.response?.status === 401) {
                navigate('/login');
            } else {
                alert('Не удалось обновить закладку. Пожалуйста, попробуйте позже.');
            }
        } finally {
            setProcessingFavourite(prev => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });
        }
    }, [favourites, isFavourites, isLoggedIn, navigate, processingFavourite]);

    // Обработчик лайков - ИСПРАВЛЕН
    // Обработчик лайков - ИСПРАВЛЕН
const toggleLike = useCallback(async (postId: number, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!isLoggedIn) {
        navigate('/login');
        return;
    }

    if (processingLike.has(postId)) return;
    setProcessingLike(prev => new Set(prev).add(postId));

    const wasLiked = likes.has(postId);
    const currentPost = posts.find(p => p.id === postId);
    const currentLikesCount = currentPost?.likes_count || 0;
    
    // Оптимистичное обновление UI
    setLikes(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
            newSet.delete(postId);
        } else {
            newSet.add(postId);
        }
        return newSet;
    });

    setPosts(prev => prev.map(post =>
        post.id === postId
            ? { 
                ...post, 
                likes_count: Math.max(0, post.likes_count + (wasLiked ? -1 : 1))
            }
            : post
    ));

    try {
        if (wasLiked) {
            await axios.delete(`/api/likes/${postId}`, {
                withCredentials: true,
                timeout: 5000
            });

            if (isLikes) {
                setPosts(prev => prev.filter(post => post.id !== postId));
            }
        } else {
            await axios.post(`/api/likes/${postId}`, {}, {
                withCredentials: true,
                timeout: 5000
            });
        }

        // После успешного запроса, получаем актуальное количество лайков
        const countResponse = await axios.get<{likes_count: number}>(`/api/likes/count/${postId}`, {
            withCredentials: true,
            timeout: 3000
        });

        setPosts(prev => prev.map(post =>
            post.id === postId
                ? { ...post, likes_count: countResponse.data.likes_count }
                : post
        ));

    } catch (err: any) {
        console.error("Ошибка при обновлении лайка:", err);
        
        // ИСПРАВЛЕНИЕ: Обрабатываем 409 Conflict как успех (пост уже лайкнут)
        if (err.response?.status === 409) {
            console.log("Пост уже лайкнут, обновляем статус");
            // Убеждаемся, что статус лайка установлен правильно
            setLikes(prev => {
                const newSet = new Set(prev);
                newSet.add(postId);
                return newSet;
            });
            
            // Получаем актуальное количество лайков
            try {
                const countResponse = await axios.get<{likes_count: number}>(`/api/likes/count/${postId}`, {
                    withCredentials: true,
                    timeout: 3000
                });
                setPosts(prev => prev.map(post =>
                    post.id === postId
                        ? { ...post, likes_count: countResponse.data.likes_count }
                        : post
                ));
            } catch (countErr) {
                console.error("Ошибка при получении количества лайков:", countErr);
            }
            
            setProcessingLike(prev => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });
            return;
        }

        // Откатываем изменения для других ошибок
        setLikes(prev => {
            const newSet = new Set(prev);
            if (wasLiked) {
                newSet.add(postId);
            } else {
                newSet.delete(postId);
            }
            return newSet;
        });

        setPosts(prev => prev.map(post =>
            post.id === postId
                ? { ...post, likes_count: currentLikesCount }
                : post
        ));

        if (err.response?.status === 401) {
            navigate('/login');
        } else if (err.response?.status !== 409) { // Не показываем alert для 409
            alert('Не удалось обновить лайк. Пожалуйста, попробуйте позже.');
        }
    } finally {
        setProcessingLike(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
        });
    }
}, [likes, posts, isLikes, isLoggedIn, navigate, processingLike]);

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
        if (!window.confirm('Вы уверены, что хотите удалить этот пост?')) return;

        try {
            await axios.delete(`/api/posts/${id}`, {
                withCredentials: true,
                timeout: 5000
            });

            setPosts(prev => prev.filter(post => post.id !== id));
            setFavourites(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            setLikes(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } catch (err) {
            console.error('Ошибка при удалении поста:', err);
            alert('Не удалось удалить пост. Пожалуйста, попробуйте позже.');
        }
    }, []);

    const handleReport = useCallback((id: number) => {
        setReportPostId(id);
        setReportModalOpen(true);
    }, []);

    const handleSubmitReport = useCallback(async (reason: string) => {
        if (!reportPostId) return;

        try {
            await axios.post(`/api/posts/${reportPostId}/report`,
                { reason },
                {
                    withCredentials: true,
                    timeout: 5000
                }
            );
            alert('Жалоба успешно отправлена. Спасибо за помощь!');
            setReportModalOpen(false);
            setReportPostId(null);
        } catch (err: any) {
            console.error('Ошибка при отправке жалобы:', err);

            if (err.response?.status === 401) {
                alert('Необходимо авторизоваться для отправки жалобы');
                navigate('/login');
            } else if (err.response?.status === 400) {
                alert('Вы уже отправляли жалобу на этот пост');
            } else {
                alert('Не удалось отправить жалобу. Пожалуйста, попробуйте позже.');
            }
        }
    }, [reportPostId, navigate]);

    if (loading) {
        return (
            <div className="posts-feed-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка публикаций...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="posts-feed-error">
                <p>{error}</p>
                <button onClick={loadPosts} className="retry-button">
                    Попробовать снова
                </button>
            </div>
        );
    }

    if (posts.length === 0) {
        let message = 'Публикации не найдены';
        if (isFavourites) message = 'У вас пока нет сохраненных публикаций';
        if (isLikes) message = 'У вас пока нет понравившихся публикаций';

        return (
            <div className="posts-feed-empty">
                <p>{message}</p>
                {!isFavourites && !isLikes && searchQuery && (
                    <p>Попробуйте изменить параметры поиска</p>
                )}
            </div>
        );
    }

    return (
        <>
            {!sseConnected && !error && !isFavourites && !isLikes && (
                <div className="sse-connection-warning">
                    Подключение к реальному времени потеряно. Обновления могут задерживаться.
                </div>
            )}

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
                        <div className="post-card-overlay"></div>

                        <div className="post-actions-overlay" onClick={(e) => e.stopPropagation()}>
                            <PostActionsMenu
                                postID={post.id}
                                postAuthorID={post.user_id}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onReport={handleReport}
                            />
                        </div>

                        <div
                            className="post-user-info"
                            onClick={(e) => handleUserClick(post.user_id, e)}
                        >
                            <img
                                src={post.user_avatar || '/default-avatar.png'}
                                alt={post.user_name}
                                className="post-user-avatar"
                                onError={(e) => {
                                    e.currentTarget.src = '/default-avatar.png';
                                }}
                            />
                            <span className="post-user-name">{post.user_name}</span>
                        </div>

                        <div className="post-header-row-new">
                            <span className="post-title-new">{post.title}</span>
                            <span className="post-date-new">{formatDate(post.created_at)}</span>
                        </div>

                        <div className="post-footer-new">
                            <div className="post-meta-left-new">
                                <span className="post-place-new">{post.settlement_name}</span>
                                {post.tags && post.tags.length > 0 && (
                                    <span className="post-tags-new">
                                        {' #' + post.tags.join(' #')}
                                    </span>
                                )}
                            </div>

                            <div className="post-meta-right-new">
                                {isLoggedIn && (
                                    <div
                                        className={`meta-icon-group-new ${processingLike.has(post.id) ? 'disabled' : ''}`}
                                        onClick={(e) => toggleLike(post.id, e)}
                                    >
                                        <BsGlobeAmericas
                                            style={{
                                                // ИСПРАВЛЕНО: красный для лайкнутых, белый для нелайкнутых
                                                color: likes.has(post.id) ? '#e74c3c' : '#ffffff'
                                            }}
                                        />
                                        <span className="map-count-new">{post.likes_count}</span>
                                    </div>
                                )}

                                {isLoggedIn && (
                                    <div
                                        className={`icon-bookmark-new ${processingFavourite.has(post.id) ? 'disabled' : ''}`}
                                        onClick={(e) => toggleFavourite(post.id, e)}
                                    >
                                        {favourites.has(post.id) ? (
                                            <FaBookmark style={{ color: '#ffd700' }} />
                                        ) : (
                                            <FaRegBookmark style={{ color: '#ffffff' }} />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => {
                    setReportModalOpen(false);
                    setReportPostId(null);
                }}
                onSubmit={handleSubmitReport}
            />
        </>
    );
};

export default PostFeed;