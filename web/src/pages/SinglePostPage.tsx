// src/pages/SinglePostPage.tsx (ФИНАЛЬНАЯ ВЕРСИЯ)

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar.tsx';
import '../components/MainLayout.css';
import './SinglePostPage.css';
import PostActionsMenu from '../components/PostActionsMenu.tsx'; 
import { BsGlobeAmericas } from "react-icons/bs";
import { FaRegBookmark, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx'; 

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
}

const SinglePostPage: React.FC = () => {
    const { id } = useParams<{ id: string }>(); 
    const navigate = useNavigate();
    const { user } = useAuth(); 

    const [post, setPost] = useState<PostDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentSlide, setCurrentSlide] = useState(0);

    const paragraphs = post?.paragraphs || [];
    const photos = post?.photos || [];
    const maxSlides = Math.max(paragraphs.length, photos.length); 
    
    const currentOrder = currentSlide + 1;
    const currentText = paragraphs.find(p => p.order === currentOrder);
    const currentPhoto = photos.find(p => p.order === currentOrder);
    
    const postIdNum = post ? parseInt(post.id) : 0;
    
    useEffect(() => {
        const fetchPost = async () => {
            try {
                const response = await axios.get(`http://localhost:8080/api/posts/${id}`, {
                    withCredentials: true 
                });
                
                if (response.data) {
                    setPost(response.data);
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
    
    const handleReport = (postId: number) => {
        alert(`Функционал жалобы на пост #${postId} пока не реализован.`);
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
    
    // --- РЕНДЕРИНГ ---

    if (loading) {
        return <div className="loading-state">Загрузка поста...</div>;
    }

    if (error || !post) {
        return <div className="error-state">Ошибка: {error || 'Пост не найден.'}</div>;
    }


    return (
        <div className="app-container">
            <Sidebar />

            <main className="main-content">
                <div className="single-post-container">
                    
                    <div className="sp-top-meta-area">
                        <h1 className="sp-post-title">{post.title}</h1>
                        
                        <div className="sp-meta-info">
                            <span className="sp-date">Опубликовано: {new Date(post.created_at).toLocaleDateString()}</span>
                            <span className="sp-place-name"><BsGlobeAmericas size={14}/> {post.place_name}</span>
                            <span className="sp-likes-count">Лайков: {post.likes_count}</span>
                            <FaRegBookmark className="sp-icon-bookmark" />
                            
                            <span className="sp-tags">
                                {(post.tags ?? []).length > 0 
                                    ? ' #' + (post.tags ?? []).join(' #') 
                                    : ''}
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
                                        <img src={currentPhoto.url} alt="Slide" className="sp-photo-img" />
                                    ) : (
                                        <span style={{color: '#999'}}>Нет фото</span>
                                    )}
                                </div>
                                <div className="sp-text-area">
                                    {currentText ? currentText.content : ""}
                                </div>
                            </div>
                            
                            <div className="sp-user-info">
                                <div className="sp-avatar" />
                                <span className="sp-username">Автор ID: {post.user_id}</span>
                            </div>
                            <div className="sp-comments-placeholder">Комментарии</div>
                        </div>

                        <button className="sp-nav-arrow" onClick={handleNext} disabled={currentSlide >= maxSlides - 1}>
                            <FaAngleDoubleRight />
                        </button>
                    </div>

                    <div className="sp-back-btn-container">
                        <button className="sp-back-btn" onClick={() => navigate(-1)}>
                            Вернуться назад
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SinglePostPage;