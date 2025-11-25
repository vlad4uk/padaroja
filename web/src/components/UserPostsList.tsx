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
}

interface UserPostsListProps {
    targetUserId?: number;
}

const UserPostsList: React.FC<UserPostsListProps> = ({ targetUserId }) => {
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

    // Функция для загрузки постов
    const fetchPosts = useCallback(async () => {
        try {
            let url: string;
            
            if (targetUserId) {
                url = `http://localhost:8080/api/user/${targetUserId}/posts`;
                console.log(`Loading posts for user ID: ${targetUserId}, URL: ${url}`);
            } else {
                url = 'http://localhost:8080/api/user/posts';
                console.log('Loading posts for current user');
            }
            
            const response = await axios.get(url, {
                withCredentials: true,      
            });
            console.log('Posts loaded:', response.data);
            const postsData = response.data || [];
            setPosts(postsData);
            
            // Загружаем статусы лайков и избранного
            if (isLoggedIn && postsData.length > 0) {
                await loadFavouritesStatus(postsData.map((post: PostData) => post.id));
                await loadLikesStatus(postsData.map((post: PostData) => post.id));
            }
            
        } catch (err: any) {
            console.error("Ошибка при загрузке постов:", err);
            console.error("URL был:", err.config?.url);
            console.error("Status:", err.response?.status);
            setError('Не удалось загрузить публикации');
        } finally {
            setLoading(false);
        }
    }, [targetUserId, isLoggedIn]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Загрузка статуса избранного
    const loadFavouritesStatus = async (postIds: number[]) => {
        if (!isLoggedIn || postIds.length === 0) {
            setFavourites(new Set<number>());
            return;
        }
        
        try {
            const favouritePromises = postIds.map(postId => 
                axios.get<{is_favourite: boolean}>(`http://localhost:8080/api/favourites/check/${postId}`, {
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
    };

    // Загрузка статуса лайков
    const loadLikesStatus = async (postIds: number[]) => {
        if (!isLoggedIn || postIds.length === 0) {
            setLikes(new Set<number>());
            return;
        }
        
        try {
            const likePromises = postIds.map(postId => 
                axios.get<{is_liked: boolean}>(`http://localhost:8080/api/likes/check/${postId}`, {
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
    };

    // Загрузка количества лайков для всех постов
    const loadLikesCounts = useCallback(async (postIds: number[]) => {
        if (postIds.length === 0) return;
        
        try {
            const countPromises = postIds.map(postId => 
                axios.get<{likes_count: number}>(`http://localhost:8080/api/likes/count/${postId}`, {
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

    // Обработчики постов
    const handlePostClick = (id: number) => navigate(`/post/${id}`);
    const handleEdit = (id: number) => navigate(`/post/edit/${id}`);
    
    const handleDelete = async (id: number) => {
        if (!window.confirm("Удалить этот пост?")) return;
        try {
            await axios.delete(`http://localhost:8080/api/posts/${id}`, { withCredentials: true });
            setPosts(prev => prev.filter(post => post.id !== id));
            // Удаляем из локальных состояний
            const newFavourites = new Set<number>(favourites);
            const newLikes = new Set<number>(likes);
            newFavourites.delete(id);
            newLikes.delete(id);
            setFavourites(newFavourites);
            setLikes(newLikes);
        } catch (err) { 
            alert("Ошибка удаления"); 
        }
    };

    // --- ОБРАБОТЧИКИ ЛАЙКОВ ---
    const toggleLike = useCallback(async (postId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        
        if (!isLoggedIn) {
            alert("Необходимо авторизоваться");
            navigate('/login');
            return;
        }

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
                await axios.delete(`http://localhost:8080/api/likes/${postId}`, {
                    withCredentials: true
                });
            } else {
                await axios.post(`http://localhost:8080/api/likes/${postId}`, {}, {
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
            
            // Откатываем изменения при ошибке
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
            setTimeout(() => setClickedLikePostId(null), 300);
        }
    }, [likes, posts, isLoggedIn, navigate, clickedLikePostId, loadLikesCounts]);

    // --- ОБРАБОТЧИКИ ИЗБРАННОГО ---
    const toggleFavourite = useCallback(async (postId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        
        if (!isLoggedIn) {
            alert("Необходимо авторизоваться");
            navigate('/login');
            return;
        }

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
                await axios.delete(`http://localhost:8080/api/favourites/${postId}`, {
                    withCredentials: true
                });
            } else {
                await axios.post(`http://localhost:8080/api/favourites/${postId}`, {}, {
                    withCredentials: true
                });
            }
        } catch (err: any) {
            console.error("Ошибка при обновлении закладки:", err);
            
            // Откатываем изменения при ошибке
            const revertedFavourites = new Set<number>(favourites);
            setFavourites(revertedFavourites);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            } else {
                alert("Не удалось обновить закладку");
            }
        } finally {
            setTimeout(() => setClickedPostId(null), 300);
        }
    }, [favourites, isLoggedIn, navigate, clickedPostId]);

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