import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '../components/ContentLayout.tsx';
import { FaRegBookmark, FaBookmark } from 'react-icons/fa';
import { BsGlobeAmericas } from "react-icons/bs";
import PostActionsMenu from '../components/PostActionsMenu.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import './RecommendationsPage.css';

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
}

const RecommendationsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'geo' | 'follow'>('geo');
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [favourites, setFavourites] = useState<Set<number>>(new Set());
    const [likes, setLikes] = useState<Set<number>>(new Set());
    const [processingFavourite, setProcessingFavourite] = useState<Set<number>>(new Set());
    const [processingLike, setProcessingLike] = useState<Set<number>>(new Set());

    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth();

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('ru-RU');
    };

    const loadRecommendations = async () => {
        setLoading(true);
        setError('');
        try {
            const url = activeTab === 'geo' 
                ? '/api/recommendations/geo?limit=20'
                : '/api/recommendations/follow?limit=20';
            const response = await axios.get(url, { withCredentials: true });
            setPosts(response.data.posts || []);
            
            // Загружаем статусы для авторизованного пользователя
            if (isLoggedIn && response.data.posts?.length) {
                const postIds = response.data.posts.map((p: PostData) => p.id);
                await loadInteractionStatuses(postIds);
            }
        } catch (err: any) {
            setError(err.response?.status === 401 ? 'Необходимо авторизоваться' : 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    const loadInteractionStatuses = async (postIds: number[]) => {
        try {
            const favRes = await axios.get('/api/favourites/check-multiple', {
                params: { post_ids: postIds.join(',') },
                withCredentials: true
            });
            const favSet = new Set<number>();
            Object.entries(favRes.data).forEach(([id, isFav]) => {
                if (isFav) favSet.add(parseInt(id));
            });
            setFavourites(favSet);

            const likeSet = new Set<number>();
            for (const id of postIds) {
                const res = await axios.get(`/api/likes/check/${id}`, { withCredentials: true });
                if (res.data.is_liked) likeSet.add(id);
            }
            setLikes(likeSet);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadRecommendations();
    }, [activeTab]);

    const toggleLike = async (postId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isLoggedIn) return navigate('/login');
        if (processingLike.has(postId)) return;
        
        setProcessingLike(prev => new Set(prev).add(postId));
        const wasLiked = likes.has(postId);
        
        setLikes(prev => {
            const newSet = new Set(prev);
            wasLiked ? newSet.delete(postId) : newSet.add(postId);
            return newSet;
        });
        setPosts(prev => prev.map(p => p.id === postId 
            ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) }
            : p
        ));

        try {
            if (wasLiked) {
                await axios.delete(`/api/likes/${postId}`, { withCredentials: true });
            } else {
                await axios.post(`/api/likes/${postId}`, {}, { withCredentials: true });
            }
            const countRes = await axios.get(`/api/likes/count/${postId}`, { withCredentials: true });
            setPosts(prev => prev.map(p => p.id === postId 
                ? { ...p, likes_count: countRes.data.likes_count }
                : p
            ));
        } catch (err) {
            setLikes(prev => {
                const newSet = new Set(prev);
                wasLiked ? newSet.add(postId) : newSet.delete(postId);
                return newSet;
            });
            setPosts(prev => prev.map(p => p.id === postId 
                ? { ...p, likes_count: p.likes_count + (wasLiked ? 1 : -1) }
                : p
            ));
        } finally {
            setProcessingLike(prev => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });
        }
    };

    const toggleFavourite = async (postId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isLoggedIn) return navigate('/login');
        if (processingFavourite.has(postId)) return;
        
        setProcessingFavourite(prev => new Set(prev).add(postId));
        const wasFav = favourites.has(postId);
        
        setFavourites(prev => {
            const newSet = new Set(prev);
            wasFav ? newSet.delete(postId) : newSet.add(postId);
            return newSet;
        });

        try {
            if (wasFav) {
                await axios.delete(`/api/favourites/${postId}`, { withCredentials: true });
            } else {
                await axios.post(`/api/favourites/${postId}`, {}, { withCredentials: true });
            }
        } catch (err) {
            setFavourites(prev => {
                const newSet = new Set(prev);
                wasFav ? newSet.add(postId) : newSet.delete(postId);
                return newSet;
            });
        } finally {
            setProcessingFavourite(prev => {
                const newSet = new Set(prev);
                newSet.delete(postId);
                return newSet;
            });
        }
    };

    if (loading) {
        return (
            <ContentLayout>
                <div className="rec-loading"><div className="loading-spinner"></div><p>Загрузка...</p></div>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout>
            <div className="rec-container">
                <div className="rec-header">
                    <h1>Рекомендации</h1>
                    <div className="rec-tabs">
                        <button className={`rec-tab ${activeTab === 'geo' ? 'active' : ''}`} onClick={() => setActiveTab('geo')}>
                            Похожие места
                        </button>
                        <button className={`rec-tab ${activeTab === 'follow' ? 'active' : ''}`} onClick={() => setActiveTab('follow')}>
                            От подписок
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="rec-error"><p>{error}</p><button onClick={loadRecommendations}>Повторить</button></div>
                ) : posts.length === 0 ? (
                    <div className="rec-empty">
                        <p>{activeTab === 'geo' ? 'Нет рекомендаций по местам' : 'Нет рекомендаций от подписок'}</p>
                        {activeTab === 'geo' && <p className="hint">Лайкайте посты, чтобы получать персональные рекомендации</p>}
                        {activeTab === 'follow' && <p className="hint">Подпишитесь на авторов, чтобы видеть их посты</p>}
                    </div>
                ) : (
                    <div className="posts-grid">
                        {posts.map(post => (
                            <div key={post.id} className="post-card-new" onClick={() => navigate(`/post/${post.id}`)} style={{
                                backgroundImage: post.photos?.[0]?.url 
                                    ? `url(${post.photos[0].url})`
                                    : 'linear-gradient(135deg, #667eea, #764ba2)'
                            }}>
                                <div className="post-card-overlay"></div>
                                
                                <div className="post-actions-overlay" onClick={e => e.stopPropagation()}>
                                    <PostActionsMenu postID={post.id} postAuthorID={post.user_id} userRole={user?.role_id} />
                                </div>

                                <div className="post-user-info" onClick={e => { e.stopPropagation(); navigate(`/user/${post.user_id}`); }}>
                                    <img src={post.user_avatar || '/default-avatar.png'} className="post-user-avatar" />
                                    <span className="post-user-name">{post.user_name}</span>
                                </div>

                                <div className="post-header-row-new">
                                    <span className="post-title-new">{post.title}</span>
                                    <span className="post-date-new">{formatDate(post.created_at)}</span>
                                </div>

                                <div className="post-footer-new">
                                    <div className="post-meta-left-new">
                                        <span className="post-place-new">{post.settlement_name}</span>
                                        {post.tags?.length > 0 && (
                                            <span className="post-tags-new"> #{post.tags.join(' #')}</span>
                                        )}
                                    </div>
                                    <div className="post-meta-right-new">
                                        {isLoggedIn && (
                                            <div className={`meta-icon-group-new ${processingLike.has(post.id) ? 'disabled' : ''}`} onClick={e => toggleLike(post.id, e)}>
                                                <BsGlobeAmericas style={{ color: likes.has(post.id) ? '#e74c3c' : '#fff' }} />
                                                <span className="map-count-new">{post.likes_count}</span>
                                            </div>
                                        )}
                                        {isLoggedIn && (
                                            <div className={`icon-bookmark-new ${processingFavourite.has(post.id) ? 'disabled' : ''}`} onClick={e => toggleFavourite(post.id, e)}>
                                                {favourites.has(post.id) ? <FaBookmark style={{ color: '#ffd700' }} /> : <FaRegBookmark style={{ color: '#fff' }} />}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ContentLayout>
    );
};

export default RecommendationsPage;