import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './SinglePostPage.css';
import PostActionsMenu from '../components/PostActionsMenu.tsx'; 
import ReportModal from '../components/ReportModal.tsx';
import { BsGlobeAmericas } from "react-icons/bs";
import { FaRegBookmark, FaBookmark, FaAngleDoubleLeft, FaAngleDoubleRight, FaTimes, FaComment, FaCommentSlash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx'; 
import CommentsSection from '../components/CommentsSection.tsx';

// --- ИНТЕРФЕЙСЫ ---

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

interface PostDetailData {
    id: string;
    title: string;
    created_at: string;
    place_name: string;
    tags: string[] | null;
    likes_count: number;
    paragraphs: ParagraphData[] | null;
    photos: PhotoData[] | null;
    user_id: number;
    comments_disabled: boolean; // ✅ Обязательно добавляем
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

    // --- СТЕЙТЫ ДЛЯ ЛАЙКОВ И ИЗБРАННОГО ---
    const [isLiked, setIsLiked] = useState(false);
    const [isFavourite, setIsFavourite] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [clickedPostId, setClickedPostId] = useState<number | null>(null);
    const [clickedLikePostId, setClickedLikePostId] = useState<number | null>(null);

    // --- СТЕЙТЫ ДЛЯ АВТОРА ПОСТА ---
    const [userAvatar, setUserAvatar] = useState<string>('');
    const [postUserName, setPostUserName] = useState<string>('');

    // --- СТЕЙТЫ ДЛЯ МОДАЛЬНОГО ОКНА ЖАЛОБЫ ---
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [reportPostId, setReportPostId] = useState<number | null>(null);

    // --- СТЕЙТЫ ДЛЯ ПОЛНОЭКРАННОГО ПРОСМОТРА ФОТО ---
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [fullscreenImageAlt, setFullscreenImageAlt] = useState<string>('');

    // --- СТЕЙТ ДЛЯ КОММЕНТАРИЕВ ---
    const [commentsDisabled, setCommentsDisabled] = useState(false);

    const paragraphs = post?.paragraphs || [];
    const photos = post?.photos || [];
    // Определяем максимальное количество слайдов
    const maxSlides = Math.max(paragraphs.length, photos.length); 
    
    const currentOrder = currentSlide + 1;
    // Находим текст и фото, соответствующие текущему порядку (слайду)
    const currentText = paragraphs.find(p => p.order === currentOrder);
    const currentPhoto = photos.find(p => p.order === currentOrder);
    
    // Преобразуем строковый ID поста в число для PostActionsMenu
    const postIdNum = post ? parseInt(post.id) : 0;
    
    // Загрузка поста и статусов лайков/избранного
    useEffect(() => {
        const fetchPost = async () => {
            try {
                const response = await axios.get(`http://localhost:8080/api/posts/${id}`, {
                    withCredentials: true 
                });
                
                if (response.data) {
                    setPost(response.data);
                    setLikesCount(response.data.likes_count || 0);
                    setCommentsDisabled(response.data.comments_disabled || false); // Загружаем статус комментариев
                    
                    // Загружаем информацию об авторе
                    if (response.data.author_info) {
                        setUserAvatar(response.data.author_info.image_url || '');
                        setPostUserName(response.data.author_info.username || 'Автор');
                    } else {
                        // Если авторская информация не пришла, загружаем отдельно
                        await fetchAuthorInfo(response.data.user_id);
                    }
                    
                    // Загружаем статусы лайков и избранного
                    await loadLikeStatus(parseInt(response.data.id));
                    await loadFavouriteStatus(parseInt(response.data.id));
                } else {
                    setError('Пост не найден.');
                }
                
            } catch (err) {
                console.error("Ошибка при получении поста:", err);
                setError('Не удалось загрузить пост. Возможно, он был удален или доступ ограничен.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchPost();
        }
    }, [id]);

    // Загрузка информации об авторе
    const fetchAuthorInfo = useCallback(async (userId: number) => {
        try {
            const response = await axios.get(
                `http://localhost:8080/api/user/${userId}/profile`,
                { withCredentials: true }
            );
            setUserAvatar(response.data.image_url || '');
            setPostUserName(response.data.username);
        } catch (err) {
            console.error('Ошибка загрузки информации об авторе:', err);
        }
    }, []);

    // Загрузка статуса лайка
    const loadLikeStatus = async (postId: number) => {
        if (!isLoggedIn) return;
        
        try {
            const response = await axios.get<{is_liked: boolean}>(
                `http://localhost:8080/api/likes/check/${postId}`,
                { withCredentials: true }
            );
            setIsLiked(response.data.is_liked);
        } catch (err) {
            console.error("Ошибка при загрузке статуса лайка:", err);
        }
    };

    // Загрузка статуса избранного
    const loadFavouriteStatus = async (postId: number) => {
        if (!isLoggedIn) return;
        
        try {
            const response = await axios.get<{is_favourite: boolean}>(
                `http://localhost:8080/api/favourites/check/${postId}`,
                { withCredentials: true }
            );
            setIsFavourite(response.data.is_favourite);
        } catch (err) {
            console.error("Ошибка при загрузке статуса избранного:", err);
        }
    };

    // Загрузка количества лайков
    const loadLikesCount = async (postId: number) => {
        try {
            const response = await axios.get<{likes_count: number}>(
                `http://localhost:8080/api/likes/count/${postId}`,
                { withCredentials: true }
            );
            setLikesCount(response.data.likes_count);
        } catch (err) {
            console.error("Ошибка при загрузке количества лайков:", err);
        }
    };

    // --- ОБРАБОТЧИКИ ЛАЙКОВ ---
    const toggleLike = async () => {
        if (!isLoggedIn) {
            alert("Необходимо авторизоваться");
            navigate('/login');
            return;
        }

        if (!post || clickedLikePostId === postIdNum) return;
        
        setClickedLikePostId(postIdNum);
        
        // Оптимистичное обновление
        const wasLiked = isLiked;
        const newLikesCount = wasLiked ? likesCount - 1 : likesCount + 1;
        
        setIsLiked(!wasLiked);
        setLikesCount(newLikesCount);
        
        try {
            if (wasLiked) {
                await axios.delete(`http://localhost:8080/api/likes/${postIdNum}`, {
                    withCredentials: true
                });
            } else {
                await axios.post(`http://localhost:8080/api/likes/${postIdNum}`, {}, {
                    withCredentials: true
                });
            }
            
            // Обновляем актуальное количество лайков
            setTimeout(() => {
                loadLikesCount(postIdNum);
                // Дополнительное обновление через секунду для синхронизации
                setTimeout(() => {
                    loadLikesCount(postIdNum);
                }, 1000);
            }, 100);
            
        } catch (err: any) {
            console.error("Ошибка при обновлении лайка:", err);
            
            // Откатываем изменения при ошибке
            setIsLiked(wasLiked);
            setLikesCount(likesCount);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            } else {
                alert("Не удалось обновить лайк");
            }
        } finally {
            setTimeout(() => setClickedLikePostId(null), 300);
        }
    };

    // --- ОБРАБОТЧИКИ ИЗБРАННОГО ---
    const toggleFavourite = async () => {
        if (!isLoggedIn) {
            alert("Необходимо авторизоваться");
            navigate('/login');
            return;
        }

        if (!post || clickedPostId === postIdNum) return;
        
        setClickedPostId(postIdNum);
        
        // Оптимистичное обновление
        const wasFavourite = isFavourite;
        setIsFavourite(!wasFavourite);
        
        try {
            if (wasFavourite) {
                await axios.delete(`http://localhost:8080/api/favourites/${postIdNum}`, {
                    withCredentials: true
                });
            } else {
                await axios.post(`http://localhost:8080/api/favourites/${postIdNum}`, {}, {
                    withCredentials: true
                });
            }
        } catch (err: any) {
            console.error("Ошибка при обновлении закладки:", err);
            
            // Откатываем изменения при ошибке
            setIsFavourite(wasFavourite);
            
            if (err.response?.status === 401) {
                alert("Необходимо авторизоваться");
                navigate('/login');
            } else {
                alert("Не удалось обновить закладку");
            }
        } finally {
            setTimeout(() => setClickedPostId(null), 300);
        }
    };

    // --- ОБРАБОТЧИКИ ДЛЯ PostActionsMenu ---
    const handleEdit = (postId: number) => {
        navigate(`/post/edit/${postId}`);
    };

    const handleDelete = async (postId: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить этот пост? Это действие необратимо.')) {
            return;
        }

        try {
            await axios.delete(`http://localhost:8080/api/posts/${postId}`, {
                withCredentials: true
            });
            alert('Пост успешно удален!');
            navigate('/profile'); 
        } catch (error) {
            console.error('Ошибка удаления поста:', error);
            alert('Не удалось удалить пост. Убедитесь, что вы являетесь его автором.');
        }
    };
    
    // --- ОБРАБОТЧИКИ ЖАЛОБЫ ---
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

    // --- ОБРАБОТЧИКИ ДЛЯ КОММЕНТАРИЕВ ---
    const toggleComments = async () => {
    if (!post || !isLoggedIn) return;
    
    // Проверяем, что пользователь - автор поста
    if (user?.id !== post.user_id) {
        alert("Только автор может изменять настройки комментариев");
        return;
    }
    
    try {
        const response = await axios.patch(
            `http://localhost:8080/api/posts/${post.id}/comments`,
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

    // --- НАВИГАЦИЯ ПО СЛАЙДАМ ---
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

    // Переход на страницу автора
    const handleAuthorClick = () => {
        if (post?.user_id) {
            navigate(`/user/${post.user_id}`);
        }
    };

    // --- ОБРАБОТЧИКИ ДЛЯ ПОЛНОЭКРАННОГО ПРОСМОТРА ФОТО ---
    const handleImageClick = (imageUrl: string) => {
        setFullscreenImage(imageUrl);
        setFullscreenImageAlt(`Фото из поста "${post?.title}" - слайд ${currentSlide + 1}`);
        setIsImageModalOpen(true);
    };

    const closeImageModal = () => {
        setIsImageModalOpen(false);
        setFullscreenImage(null);
        setFullscreenImageAlt('');
    };

    // Закрытие по ESC
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isImageModalOpen) {
                closeImageModal();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [isImageModalOpen]);

    // --- РЕНДЕРИНГ СОСТОЯНИЙ ---
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
                        {/* Аватар и имя автора */}
                        <div 
                            className="sp-author-info"
                            onClick={handleAuthorClick}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <img 
                                src={userAvatar || '/default-avatar.png'} 
                                alt={postUserName || 'Автор'}
                                className="sp-author-avatar"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/default-avatar.png';
                                }}
                            />
                            <span className="sp-author-name">{postUserName || 'Автор'}</span>
                        </div>
                        
                        <span className="sp-date">Опубликовано: {new Date(post.created_at).toLocaleDateString()}</span>
                        <span className="sp-place-name"><BsGlobeAmericas size={14}/> {post.place_name}</span>
                        
                       
                        
                        {/* Лайки с возможностью клика */}
                        <span 
                            className="sp-likes-count"
                            onClick={toggleLike}
                            style={{
                                cursor: isLoggedIn && clickedLikePostId !== postIdNum ? 'pointer' : 'default',
                                opacity: clickedLikePostId === postIdNum ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            <BsGlobeAmericas 
                                size={14} 
                                style={{ 
                                    color: isLiked ? '#e74c3c' : '#666' 
                                }} 
                            />
                            {likesCount}
                        </span>
                        
                        {/* Закладка с возможностью клика */}
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

                         {/* Индикатор статуса комментариев */}
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
                    </div>
                    
                    {/* ИНТЕГРАЦИЯ PostActionsMenu */}
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
                            />
                        </div>
                    )}
                </div>

                {/* Слайдер с контентом */}
                <div className="sp-content-slider">
                    <button className="sp-nav-arrow" onClick={handlePrev} disabled={currentSlide === 0}>
                        <FaAngleDoubleLeft />
                    </button>

                    <div className="sp-slide-view sp-slider-box">
                        <div className="sp-slide-meta">
                            <span className="sp-slide-info">Слайд {currentSlide + 1} из {maxSlides}</span>
                        </div>

                        <div className="sp-slide-body">
                            <div className="sp-photo-area">
                                {currentPhoto ? (
                                    <img 
                                        src={currentPhoto.url} 
                                        alt={`Slide ${currentSlide + 1}`} 
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

                {/* Раздел комментариев отдельно */}
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
            
            {/* МОДАЛЬНОЕ ОКНО ЖАЛОБЫ */}
            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                onSubmit={handleSubmitReport}
            />

            {/* МОДАЛЬНОЕ ОКНО ДЛЯ ПОЛНОЭКРАННОГО ПРОСМОТРА ФОТО */}
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
                        <div className="image-modal-info">
                            <span>{fullscreenImageAlt}</span>
                        </div>
                    </div>
                </div>
            )}
        </ContentLayout>
    );
};

export default SinglePostPage;