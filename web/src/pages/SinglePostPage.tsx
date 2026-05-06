import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './SinglePostPage.css';
import PostActionsMenu from '../components/PostActionsMenu.tsx'; 
import ReportModal from '../components/ReportModal.tsx';
import { BsGlobeAmericas } from "react-icons/bs";
import { FaRegBookmark, FaBookmark, FaAngleDoubleLeft, FaAngleDoubleRight, FaTimes, FaComment, FaCommentSlash, FaHeart, FaRegHeart } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx'; 
import CommentsSection from '../components/CommentsSection.tsx';

interface ParagraphData {
    id: number;
    content: string;
    order: number;
}

interface PhotoData {
    id: string;
    url: string;
    order: number;
}

interface CollaboratorData {
    id: number;
    user_id: number;
    username: string;
    avatar: string;
    role: string;
    joined_at: string;
}

interface PostDetailData {
    id: string;
    user_id: number;
    title: string;
    created_at: string;
    settlement_name: string;
    settlement_id: number;
    tags: string[] | null;
    likes_count: number;
    paragraphs: ParagraphData[] | null;
    photos: PhotoData[] | null;
    comments_disabled: boolean;
    is_collaborative?: boolean;
    author_info?: {
        username: string;
        image_url: string;
    };
}

const SinglePostPage: React.FC = () => {
    const { id } = useParams<{ id: string }>(); 
    const navigate = useNavigate();
    const { user, isLoggedIn } = useAuth(); 

    const [post, setPost] = useState<PostDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentSlide, setCurrentSlide] = useState(0);

    const [isLiked, setIsLiked] = useState(false);
    const [isFavourite, setIsFavourite] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [clickedPostId, setClickedPostId] = useState<number | null>(null);
    const [clickedLikePostId, setClickedLikePostId] = useState<number | null>(null);
    const [isLikeAnimating, setIsLikeAnimating] = useState(false);

    const [userAvatar, setUserAvatar] = useState<string>('');
    const [postUserName, setPostUserName] = useState<string>('');

    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [fullscreenImageAlt, setFullscreenImageAlt] = useState<string>('');

    const [commentsDisabled, setCommentsDisabled] = useState(false);

    const [collaborators, setCollaborators] = useState<CollaboratorData[]>([]);
    const [isCollaborator, setIsCollaborator] = useState(false);
    const [collaboratorRole, setCollaboratorRole] = useState<'editor' | 'viewer' | null>(null);
    const [isCollaboratorMenuOpen, setIsCollaboratorMenuOpen] = useState(false);

    const paragraphs = post?.paragraphs || [];
    const photos = post?.photos || [];
    const maxSlides = Math.max(paragraphs.length, photos.length, 1);
    
    const currentOrder = currentSlide + 1;
    const currentText = paragraphs.find(p => p.order === currentOrder);
    const currentPhoto = photos.find(p => p.order === currentOrder);
    
    const postIdNum = post ? parseInt(post.id) : 0;
    
    useEffect(() => {
        const fetchPost = async () => {
            try {
                const response = await axios.get(`/api/posts/${id}`, {
                    withCredentials: true 
                });
                
                if (response.data) {
                    console.log('Post data:', response.data);
                    setPost(response.data);
                    setLikesCount(response.data.likes_count || 0);
                    setCommentsDisabled(response.data.comments_disabled || false);
                    
                    if (response.data.author_info) {
                        setUserAvatar(response.data.author_info.image_url || '');
                        setPostUserName(response.data.author_info.username || 'Автор');
                    } else {
                        await fetchAuthorInfo(response.data.user_id);
                    }
                    
                    await loadLikeStatus(parseInt(response.data.id));
                    await loadFavouriteStatus(parseInt(response.data.id));
                    
                    await fetchCollaborators(parseInt(response.data.id));
                    
                    if (isLoggedIn) {
                        await checkCollaboratorStatus(parseInt(response.data.id));
                    }
                } else {
                    setError('Пост не найден.');
                }
                
            } catch (err) {
                console.error("Ошибка при получении поста:", err);
                setError('Не удалось загрузить пост.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchPost();
        }
    }, [id, isLoggedIn]);

    const fetchAuthorInfo = useCallback(async (userId: number) => {
        try {
            const response = await axios.get(
                `/api/user/${userId}/profile`,
                { withCredentials: true }
            );
            setUserAvatar(response.data.image_url || '');
            setPostUserName(response.data.username);
        } catch (err) {
            console.error('Ошибка загрузки информации об авторе:', err);
        }
    }, []);

    const fetchCollaborators = async (postId: number) => {
        try {
            const response = await axios.get(`/api/posts/${postId}/collaborators`, {
                withCredentials: true
            });
            setCollaborators(response.data.collaborators || []);
        } catch (error) {
            console.error('Ошибка загрузки соавторов:', error);
            setCollaborators([]);
        }
    };

    const checkCollaboratorStatus = async (postId: number) => {
        try {
            const response = await axios.get(`/api/posts/${postId}/collaborators/check`, {
                withCredentials: true
            });
            setIsCollaborator(response.data.is_collaborator);
            setCollaboratorRole(response.data.role);
        } catch (error) {
            console.error('Ошибка проверки статуса соавтора:', error);
            setIsCollaborator(false);
            setCollaboratorRole(null);
        }
    };

    const loadLikeStatus = async (postId: number) => {
        if (!isLoggedIn) return;
        try {
            const response = await axios.get<{is_liked: boolean}>(
                `/api/likes/check/${postId}`,
                { withCredentials: true }
            );
            setIsLiked(response.data.is_liked);
        } catch (err) {
            console.error("Ошибка при загрузке статуса лайка:", err);
        }
    };

    const loadFavouriteStatus = async (postId: number) => {
        if (!isLoggedIn) return;
        try {
            const response = await axios.get<{is_favourite: boolean}>(
                `/api/favourites/check/${postId}`,
                { withCredentials: true }
            );
            setIsFavourite(response.data.is_favourite);
        } catch (err) {
            console.error("Ошибка при загрузке статуса избранного:", err);
        }
    };

    const loadLikesCount = async (postId: number) => {
        try {
            const response = await axios.get<{likes_count: number}>(
                `/api/likes/count/${postId}`,
                { withCredentials: true }
            );
            setLikesCount(response.data.likes_count);
        } catch (err) {
            console.error("Ошибка при загрузке количества лайков:", err);
        }
    };

    const toggleLike = async () => {
        if (!isLoggedIn) {
            alert("Необходимо авторизоваться");
            navigate('/login');
            return;
        }

        if (!post || clickedLikePostId === postIdNum) return;
        
        setClickedLikePostId(postIdNum);
        setIsLikeAnimating(true);
        
        const wasLiked = isLiked;
        const newLikesCount = wasLiked ? likesCount - 1 : likesCount + 1;
        
        setIsLiked(!wasLiked);
        setLikesCount(newLikesCount);
        
        try {
            if (wasLiked) {
                await axios.delete(`/api/likes/${postIdNum}`, { withCredentials: true });
            } else {
                await axios.post(`/api/likes/${postIdNum}`, {}, { withCredentials: true });
            }
            
            setTimeout(() => loadLikesCount(postIdNum), 100);
            
        } catch (err: any) {
            console.error("Ошибка при обновлении лайка:", err);
            setIsLiked(wasLiked);
            setLikesCount(likesCount);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            }
        } finally {
            setTimeout(() => {
                setClickedLikePostId(null);
                setIsLikeAnimating(false);
            }, 300);
        }
    };

    const toggleFavourite = async () => {
        if (!isLoggedIn) {
            alert("Необходимо авторизоваться");
            navigate('/login');
            return;
        }

        if (!post || clickedPostId === postIdNum) return;
        
        setClickedPostId(postIdNum);
        
        const wasFavourite = isFavourite;
        setIsFavourite(!wasFavourite);
        
        try {
            if (wasFavourite) {
                await axios.delete(`/api/favourites/${postIdNum}`, { withCredentials: true });
            } else {
                await axios.post(`/api/favourites/${postIdNum}`, {}, { withCredentials: true });
            }
        } catch (err: any) {
            console.error("Ошибка при обновлении закладки:", err);
            setIsFavourite(wasFavourite);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            }
        } finally {
            setTimeout(() => setClickedPostId(null), 300);
        }
    };

    const handleEdit = (postId: number) => {
        navigate(`/post/edit/${postId}`);
    };

    const handleDelete = async (postId: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить этот пост?')) return;

        try {
            await axios.delete(`/api/posts/${postId}`, { withCredentials: true });
            alert('Пост удален!');
            navigate('/profile');
        } catch (error) {
            console.error('Ошибка удаления:', error);
            alert('Не удалось удалить пост.');
        }
    };
    
    const handleReport = async (postId: number, reason: string) => {
        try {
            await axios.post(`/api/posts/${postId}/report`, 
                { reason }, 
                { withCredentials: true }
            );
            alert("Жалоба отправлена.");
            return Promise.resolve();
        } catch (err: any) {
            console.error('Ошибка при отправке жалобы:', err);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            } else {
                alert("Ошибка при отправке жалобы.");
            }
            return Promise.reject(err);
        }
    };

    const toggleComments = async () => {
        if (!post || !isLoggedIn) return;
        
        if (user?.id !== post.user_id) {
            alert("Только автор может изменять настройки комментариев");
            return;
        }
        
        try {
            const response = await axios.patch(
                `/api/posts/${post.id}/comments`,
                { disabled: !commentsDisabled },
                { withCredentials: true }
            );
            
            setCommentsDisabled(response.data.comments_disabled);
            alert(`Комментарии ${response.data.comments_disabled ? 'отключены' : 'включены'}`);
        } catch (err: any) {
            console.error("Ошибка при изменении статуса комментариев:", err);
            alert("Не удалось изменить настройки комментариев");
        }
    };

    const handleLeaveCollaboration = async (postId: number) => {
        try {
            await axios.post(`/api/posts/${postId}/leave`, {}, {
                withCredentials: true
            });
            alert('Вы вышли из соавторов поста');
            setIsCollaborator(false);
            setCollaboratorRole(null);
            window.location.reload();
        } catch (error: any) {
            console.error('Ошибка при выходе из соавторов:', error);
            alert(error.response?.data?.error || 'Не удалось выйти из соавторов');
        }
    };

    const handleManageCollaborators = (postId: number) => {
        navigate(`/posts/${postId}/collaborators`);
    };

    const handleNext = () => {
        if (currentSlide < maxSlides - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleAuthorClick = () => {
        if (post?.user_id) {
            navigate(`/user/${post.user_id}`);
        }
    };

    const handleCollaboratorClick = (userId: number) => {
        navigate(`/user/${userId}`);
        setIsCollaboratorMenuOpen(false);
    };

    const handleImageClick = (imageUrl: string) => {
        setFullscreenImage(imageUrl);
        setFullscreenImageAlt(`Фото из поста "${post?.title}"`);
        setIsImageModalOpen(true);
    };

    const closeImageModal = () => {
        setIsImageModalOpen(false);
        setFullscreenImage(null);
    };

    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isImageModalOpen) {
                closeImageModal();
            }
        };
        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [isImageModalOpen]);

    if (loading) {
        return (
            <ContentLayout>
                <div className="loading-state">Загрузка поста...</div>
            </ContentLayout>
        );
    }

    if (error || !post) {
        return (
            <ContentLayout>
                <div className="error-state">Ошибка: {error || 'Пост не найден.'}</div>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout>
            <div className="single-post-container">
                
                <div className="sp-top-meta-area">
                    <h1 className="sp-post-title">{post.title}</h1>
                    
                    <div className="sp-meta-info">
                        <div className="sp-authors-stack">
                            <div className="sp-avatars-stack">
                                <img 
                                    src={userAvatar || '/default-avatar.png'} 
                                    alt={postUserName || 'Автор'}
                                    className="sp-avatar-item"
                                    onClick={handleAuthorClick}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/default-avatar.png';
                                    }}
                                />
                                
                                {collaborators.slice(0, 2).map(collab => (
                                    <img 
                                        key={collab.id}
                                        src={collab.avatar || '/default-avatar.png'} 
                                        alt={collab.username}
                                        className="sp-avatar-item"
                                        onClick={() => handleCollaboratorClick(collab.user_id)}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/default-avatar.png';
                                        }}
                                    />
                                ))}
                                
                                {collaborators.length > 2 && (
                                    <div 
                                        className="sp-avatar-more"
                                        onClick={() => setIsCollaboratorMenuOpen(!isCollaboratorMenuOpen)}
                                    >
                                        +{collaborators.length - 2}
                                    </div>
                                )}
                            </div>
                            
                            <div className="sp-authors-names">
                                <span className="sp-author-link" onClick={handleAuthorClick}>
                                    {postUserName || 'Автор'}
                                </span>
                                
                                {collaborators.length === 1 && (
                                    <>
                                        <span className="sp-author-separator">и</span>
                                        <span 
                                            className="sp-author-link" 
                                            onClick={() => handleCollaboratorClick(collaborators[0].user_id)}
                                        >
                                            {collaborators[0].username}
                                        </span>
                                    </>
                                )}
                                
                                {collaborators.length === 2 && (
                                    <>
                                        <span className="sp-author-separator">,</span>
                                        <span 
                                            className="sp-author-link" 
                                            onClick={() => handleCollaboratorClick(collaborators[0].user_id)}
                                        >
                                            {collaborators[0].username}
                                        </span>
                                        <span className="sp-author-separator">и</span>
                                        <span 
                                            className="sp-author-link" 
                                            onClick={() => handleCollaboratorClick(collaborators[1].user_id)}
                                        >
                                            {collaborators[1].username}
                                        </span>
                                    </>
                                )}
                                
                                {collaborators.length > 2 && (
                                    <>
                                        <span className="sp-author-separator">,</span>
                                        <span 
                                            className="sp-author-link" 
                                            onClick={() => handleCollaboratorClick(collaborators[0].user_id)}
                                        >
                                            {collaborators[0].username}
                                        </span>
                                        <span className="sp-author-separator">и</span>
                                        <span 
                                            className="sp-author-count" 
                                            onClick={() => setIsCollaboratorMenuOpen(!isCollaboratorMenuOpen)}
                                        >
                                            ещё {collaborators.length - 1}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {isCollaboratorMenuOpen && (
                            <div className="collaborators-dropdown">
                                <div className="collaborators-dropdown-header">
                                    Все авторы
                                </div>
                                <div className="collaborators-dropdown-list">
                                    <div 
                                        className="collaborator-item"
                                        onClick={handleAuthorClick}
                                    >
                                        <img 
                                            src={userAvatar || '/default-avatar.png'} 
                                            alt={postUserName || 'Автор'}
                                            className="collaborator-avatar"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/default-avatar.png';
                                            }}
                                        />
                                        <div className="collaborator-info">
                                            <div className="collaborator-username">{postUserName || 'Автор'}</div>
                                            <div className="collaborator-role collaborator-role-editor">👑 Владелец</div>
                                        </div>
                                    </div>
                                    
                                    {collaborators.length > 0 && (
                                        <div className="collaborator-divider" />
                                    )}
                                    
                                    {collaborators.map(collab => (
                                        <div 
                                            key={collab.id} 
                                            className="collaborator-item"
                                            onClick={() => handleCollaboratorClick(collab.user_id)}
                                        >
                                            <img 
                                                src={collab.avatar || '/default-avatar.png'} 
                                                alt={collab.username}
                                                className="collaborator-avatar"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/default-avatar.png';
                                                }}
                                            />
                                            <div className="collaborator-info">
                                                <div className="collaborator-username">{collab.username}</div>
                                                <div className={`collaborator-role ${collab.role === 'editor' ? 'collaborator-role-editor' : 'collaborator-role-viewer'}`}>
                                                    {collab.role === 'editor' ? '✏️ Редактор' : '👁️ Читатель'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <span className="sp-date">
                            {new Date(post.created_at).toLocaleDateString()}
                        </span>
                        
                        <span className="sp-place-name">
                            <BsGlobeAmericas size={14}/> {post.settlement_name}
                        </span>
                        
                        {/* Улучшенная кнопка лайка с визуальной обратной связью */}
                        <button 
                            className={`sp-like-button ${isLiked ? 'liked' : ''} ${isLikeAnimating ? 'animate' : ''}`}
                            onClick={toggleLike}
                            disabled={clickedLikePostId === postIdNum}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: isLoggedIn && clickedLikePostId !== postIdNum ? 'pointer' : 'default',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                borderRadius: '20px',
                                transition: 'all 0.2s ease',
                                fontSize: '15px'
                            }}
                        >
                            {isLiked ? (
                                <FaHeart 
                                    size={18} 
                                    style={{ 
                                        color: '#ff4757',
                                        animation: isLikeAnimating ? 'heartBeat 0.3s ease' : 'none'
                                    }} 
                                />
                            ) : (
                                <FaRegHeart size={18} style={{ color: '#666' }} />
                            )}
                            <span style={{ 
                                fontWeight: '500',
                                color: isLiked ? '#ff4757' : '#666'
                            }}>
                                {likesCount}
                            </span>
                        </button>
                        
                        <div 
                            onClick={toggleFavourite}
                            style={{
                                cursor: isLoggedIn && clickedPostId !== postIdNum ? 'pointer' : 'default',
                                opacity: clickedPostId === postIdNum ? 0.6 : 1
                            }}
                        >
                            {isFavourite ? (
                                <FaBookmark className="sp-icon-bookmark" style={{ color: '#ffd700' }} />
                            ) : (
                                <FaRegBookmark className="sp-icon-bookmark" />
                            )}
                        </div>
                        
                        <span className="sp-tags">
                            {(post.tags ?? []).length > 0 
                                ? ' #' + (post.tags ?? []).join(' #') 
                                : ''}
                        </span>

                        <span className="sp-comments-status">
                            {commentsDisabled ? (
                                <>
                                    <FaCommentSlash size={14} color="#ff6b6b" />
                                    <span style={{ color: '#ff6b6b' }}>Комментарии отключены</span>
                                </>
                            ) : (
                                <>
                                    <FaComment size={14} color="#666" />
                                    <span>Комментарии включены</span>
                                </>
                            )}
                        </span>

                        {isCollaborator && collaboratorRole && (
                            <span className="sp-collaborator-badge" style={{
                                fontSize: '12px',
                                background: collaboratorRole === 'editor' ? '#e8f5e9' : '#fff3e0',
                                color: collaboratorRole === 'editor' ? '#2e7d32' : '#ef6c00',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                {collaboratorRole === 'editor' ? '✏️' : '👁️'} 
                                {collaboratorRole === 'editor' ? 'Редактор' : 'Читатель'}
                            </span>
                        )}
                    </div>
                    
                    {post.user_id && (
                        <div className="sp-author-actions">
                            <PostActionsMenu 
                                postID={postIdNum}
                                postAuthorID={post.user_id}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onReport={handleReport}
                                onToggleComments={toggleComments}
                                commentsDisabled={commentsDisabled}
                                userRole={user?.role_id}
                                isCollaborator={isCollaborator}
                                collaboratorRole={collaboratorRole}
                                onLeaveCollaboration={handleLeaveCollaboration}
                                onManageCollaborators={handleManageCollaborators}
                            />
                        </div>
                    )}
                </div>

                <div className="sp-content-slider">
                    <button className="sp-nav-arrow" onClick={handlePrev} disabled={currentSlide === 0}>
                        <FaAngleDoubleLeft />
                    </button>

                    <div className="sp-slide-view sp-slider-box">
                        <div className="sp-slide-meta">
                            <span className="sp-slide-info">
                                Слайд {currentSlide + 1} из {maxSlides}
                            </span>
                        </div>

                        <div className="sp-slide-body">
                            <div className="sp-photo-area">
                                {currentPhoto ? (
                                    <img 
                                        src={currentPhoto.url} 
                                        alt={`Слайд ${currentSlide + 1}`} 
                                        className="sp-photo-img"
                                        onClick={() => handleImageClick(currentPhoto.url)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                ) : (
                                    <span style={{color: '#999'}}>Нет фото</span>
                                )}
                            </div>
                            <div className="sp-text-area">
                                {currentText ? currentText.content : ""}
                            </div>
                        </div>
                    </div>

                    <button className="sp-nav-arrow" onClick={handleNext} disabled={currentSlide >= maxSlides - 1}>
                        <FaAngleDoubleRight />
                    </button>
                </div>

                <div className="sp-comments-section-wrapper">
                    <CommentsSection 
                        postId={postIdNum} 
                        commentsDisabled={commentsDisabled}
                    />
                </div>
                
                <div className="sp-back-btn-container">
                    <button className="sp-back-btn" onClick={() => navigate(-1)}>
                        Вернуться назад
                    </button>
                </div>
            </div>
            
            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                onSubmit={async (reason: string) => {
                    if (reportPostId) {
                        await handleReport(reportPostId, reason);
                        setReportModalOpen(false);
                    }
                }}
            />

            {isImageModalOpen && fullscreenImage && (
                <div className="image-modal-overlay" onClick={closeImageModal}>
                    <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="image-modal-close" onClick={closeImageModal}>
                            <FaTimes size={24} />
                        </button>
                        <img 
                            src={fullscreenImage} 
                            alt={fullscreenImageAlt} 
                            className="fullscreen-image"
                        />
                    </div>
                </div>
            )}
        </ContentLayout>
    );
};

export default SinglePostPage;