import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import './UserPostsFeed.css';
import { FaRegBookmark, FaBookmark } from 'react-icons/fa';
import { BsGlobeAmericas } from "react-icons/bs";
import { useNavigate, useParams } from 'react-router-dom';
import PostActionsMenu from './PostActionsMenu.tsx';
import ReportModal from './ReportModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';

// Интерфейсы
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

interface UserPostsListProps {
    targetUserId?: number;
}

// Типы SSE сообщений
interface SSEMessage {
    type: 'NEW_POST' | 'UPDATE_POST' | 'DELETE_POST' | 'HEARTBEAT' | 'CONNECTED';
    data: any;
}

const UserPostsList: React.FC<UserPostsListProps> = ({ targetUserId }) => {
    // Состояния
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

    // Refs
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    // Hooks
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();
    const params = useParams();
    
    // Определяем ID пользователя (из пропсов или из URL)
    const effectiveUserId = targetUserId || (params.userId ? parseInt(params.userId) : undefined);

    // Форматирование даты
    const formatDate = useCallback((dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        });
    }, []);

    // Загрузка статуса избранного
    const loadFavouritesStatus = useCallback(async (postIds: number[]) => {
        if (!isLoggedIn || postIds.length === 0) {
            setFavourites(new Set<number>());
            return;
        }

        try {
            // Используем множественный запрос для эффективности
            if (postIds.length > 5) {
                const response = await axios.get<{[key: string]: boolean}>('/api/favourites/check-multiple', {
                    params: { post_ids: postIds.join(',') },
                    withCredentials: true,
                    timeout: 5000
                });
                
                const favouriteIds = new Set<number>();
                Object.entries(response.data).forEach(([id, isFav]) => {
                    if (isFav) favouriteIds.add(parseInt(id));
                });
                
                setFavourites(favouriteIds);
            } else {
                // Для небольшого количества постов - по одному
                const favouritePromises = postIds.map(postId =>
                    axios.get<{is_favourite: boolean}>(`/api/favourites/check/${postId}`, {
                        withCredentials: true,
                        timeout: 5000
                    }).catch(() => ({ data: { is_favourite: false } }))
                );

                const results = await Promise.all(favouritePromises);
                const favouriteIds = new Set<number>(
                    results
                        .filter(result => result.data.is_favourite)
                        .map((result, index) => postIds[index])
                );

                setFavourites(favouriteIds);
            }
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
            console.error("Ошибка при загрузке статуса лайков:", err);
            setLikes(new Set<number>());
        }
    }, [isLoggedIn]);

    // Загрузка количества лайков
    const loadLikesCounts = useCallback(async (postIds: number[]) => {
        if (postIds.length === 0) return;

        try {
            const countPromises = postIds.map(postId =>
                axios.get<{likes_count: number}>(`/api/likes/count/${postId}`, {
                    withCredentials: true,
                    timeout: 5000
                }).catch(() => ({ data: { likes_count: 0 } }))
            );

            const results = await Promise.all(countPromises);
            const newLikesCounts = new Map<number, number>();

            results.forEach((result, index) => {
                newLikesCounts.set(postIds[index], result.data.likes_count || 0);
            });

            setLikesCounts(newLikesCounts);

            setPosts(prev => prev.map(post => ({
                ...post,
                likes_count: newLikesCounts.get(post.id) ?? post.likes_count ?? 0
            })));
        } catch (err) {
            console.error("Ошибка при загрузке количества лайков:", err);
        }
    }, []);

    // Загрузка постов пользователя
    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            let url: string;

            if (effectiveUserId) {
                url = `/api/user/${effectiveUserId}/posts`;
                console.log(`Loading posts for user ID: ${effectiveUserId}, URL: ${url}`);
            } else {
                url = '/api/user/posts';
                console.log('Loading posts for current user');
            }

            const response = await axios.get(url, {
                withCredentials: true,
                timeout: 10000 // 10 секунд таймаут
            });

            console.log('Posts loaded:', response.data);
            const postsData = (response.data || []).map((post: PostData) => ({
                ...post,
                likes_count: post.likes_count || 0
            }));
            
            setPosts(postsData);

            // Загружаем статусы для авторизованных пользователей
            if (isLoggedIn && postsData.length > 0) {
                const postIds = postsData.map((post: PostData) => post.id);
                
                await Promise.all([
                    loadFavouritesStatus(postIds),
                    loadLikesStatus(postIds),
                    loadLikesCounts(postIds)
                ]);
            } else {
                // Сбрасываем статусы для неавторизованных
                setFavourites(new Set());
                setLikes(new Set());
            }

        } catch (err: any) {
            console.error("Ошибка при загрузке постов:", err);
            console.error("URL был:", err.config?.url);
            console.error("Status:", err.response?.status);

            if (err.code === 'ECONNABORTED') {
                setError('Превышено время ожидания. Проверьте подключение к серверу.');
            } else if (err.response?.status === 401) {
                setError('Необходимо авторизоваться для просмотра этой страницы');
            } else if (err.response?.status === 404) {
                setError('Пользователь не найден');
            } else {
                setError('Не удалось загрузить публикации. Пожалуйста, попробуйте позже.');
            }
        } finally {
            setLoading(false);
        }
    }, [effectiveUserId, isLoggedIn, loadFavouritesStatus, loadLikesStatus, loadLikesCounts]);

    // SSE подключение для стрима пользователя
    useEffect(() => {
        if (!effectiveUserId) return;

        const connectSSE = () => {
            // Закрываем существующее подключение
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const eventSource = new EventSource(`/api/posts/stream/user?id=${effectiveUserId}`, {
                withCredentials: true
            });

            eventSource.onopen = () => {
                console.log(`SSE connection opened for user ${effectiveUserId}`);
                setSseConnected(true);
                reconnectAttemptsRef.current = 0; // Сбрасываем счетчик попыток
            };

            eventSource.onmessage = (event) => {
                try {
                    const message: SSEMessage = JSON.parse(event.data);

                    // Игнорируем heartbeat сообщения
                    if (message.type === 'HEARTBEAT' || message.type === 'CONNECTED') {
                        return;
                    }

                    // Обрабатываем сообщения в зависимости от типа
                    switch (message.type) {
                        case 'NEW_POST': {
                            const newPost = message.data;
                            
                            // Добавляем только посты текущего пользователя
                            if (newPost.user_id === effectiveUserId) {
                                setPosts(prev => [{
                                    ...newPost,
                                    likes_count: newPost.likes_count || 0
                                }, ...prev]);

                                // Загружаем статусы для нового поста
                                if (isLoggedIn) {
                                    loadFavouritesStatus([newPost.id]);
                                    loadLikesStatus([newPost.id]);
                                    loadLikesCounts([newPost.id]);
                                }
                            }
                            break;
                        }

                        case 'UPDATE_POST': {
                            setPosts(prev => prev.map(post =>
                                post.id === message.data.id 
                                    ? { ...post, ...message.data, likes_count: message.data.likes_count ?? post.likes_count }
                                    : post
                            ));
                            break;
                        }

                        case 'DELETE_POST': {
                            const postId = message.data.postId;
                            setPosts(prev => prev.filter(post => post.id !== postId));

                            // Очищаем статусы
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

                        default:
                            console.log('Unknown message type:', message.type);
                    }
                } catch (err) {
                    console.error('Error parsing SSE message:', err);
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE connection error:', err);
                setSseConnected(false);

                // Закрываем проблемное соединение
                eventSource.close();

                // Пытаемся переподключиться с экспоненциальной задержкой
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
                } else {
                    console.error('Max reconnection attempts reached');
                }
            };

            eventSourceRef.current = eventSource;
        };

        connectSSE();

        // Очистка при размонтировании
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [effectiveUserId, isLoggedIn, loadFavouritesStatus, loadLikesStatus, loadLikesCounts]);

    // Загрузка постов при изменении пользователя
    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Обработчики действий
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
            } else {
                await axios.post(`/api/favourites/${postId}`, {}, {
                    withCredentials: true,
                    timeout: 5000
                });
            }
        } catch (err: any) {
            console.error("Ошибка при обновлении закладки:", err);

            // Откатываем изменения при ошибке
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
    }, [favourites, isLoggedIn, navigate, processingFavourite]);

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

        // Оптимистичное обновление счетчика
        setPosts(prev => prev.map(post =>
            post.id === postId
                ? { ...post, likes_count: Math.max(0, post.likes_count + (wasLiked ? -1 : 1)) }
                : post
        ));

        try {
            if (wasLiked) {
                await axios.delete(`/api/likes/${postId}`, {
                    withCredentials: true,
                    timeout: 5000
                });
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

            // Откатываем изменения
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
            } else {
                alert('Не удалось обновить лайк. Пожалуйста, попробуйте позже.');
            }
        } finally {
            setProcessingLike(prev => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });
        }
    }, [likes, posts, isLoggedIn, navigate, processingLike]);

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

    // Рендер состояния загрузки
    if (loading) {
        return (
            <div className="posts-feed-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка публикаций...</p>
            </div>
        );
    }

    // Рендер ошибки
    if (error) {
        return (
            <div className="posts-feed-error">
                <p>{error}</p>
                <button onClick={fetchPosts} className="retry-button">
                    Попробовать снова
                </button>
            </div>
        );
    }

    // Рендер пустого состояния
    if (!posts || posts.length === 0) {
        return (
            <div className="posts-feed-empty">
                <p>Публикаций пока нет</p>
            </div>
        );
    }

    // Основной рендер
    return (
        <>
            {!sseConnected && effectiveUserId && (
                <div className="sse-connection-warning">
                    ⚡ Подключение к реальному времени потеряно. Обновления могут задерживаться.
                </div>
            )}

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

export default UserPostsList;