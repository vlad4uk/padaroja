// src/pages/SinglePostPage.tsx (Финальная версия с обновленной разметкой)

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar.tsx';
import '../components/MainLayout.css';
import './SinglePostPage.css';
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
    user_id: number; // ID автора поста
}

const SinglePostPage: React.FC = () => {
    const { id } = useParams<{ id: string }>(); 
    const navigate = useNavigate();
    const { user } = useAuth(); 

    const [post, setPost] = useState<PostDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentSlide, setCurrentSlide] = useState(0);

    // Логика для слайдов
    const paragraphs = post?.paragraphs || [];
    const photos = post?.photos || [];
    const maxSlides = Math.max(paragraphs.length, photos.length); 
    
    // Получаем контент для текущего слайда (используем order, который равен currentSlide + 1)
    // Внимание: если order в базе начинается с 1, то currentSlide должен быть (order - 1). 
    // Если order начинается с 0, то currentSlide = order. Мы исправили в PostEditPage на order=index+1.
    const currentOrder = currentSlide + 1;
    const currentText = paragraphs.find(p => p.order === currentOrder);
    const currentPhoto = photos.find(p => p.order === currentOrder);
    
    const isAuthor = post && user && post.user_id === user.id;

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
    
    // Функция удаления поста
    const handleDelete = async () => {
        if (!isAuthor || !post) return;

        if (window.confirm('Вы уверены, что хотите удалить этот пост? Это действие необратимо.')) {
            try {
                await axios.delete(`http://localhost:8080/api/posts/${post.id}`, {
                    withCredentials: true
                });
                alert('Пост успешно удален!');
                navigate('/profile'); 
            } catch (error) {
                console.error('Ошибка удаления поста:', error);
                alert('Не удалось удалить пост. Убедитесь, что вы являетесь его автором.');
            }
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
                    
                    {/* БЛОК ЗАГОЛОВКА, МЕТЫ И КНОПОК ДЕЙСТВИЯ */}
                    <div className="sp-top-meta-area">
                        <h1 className="sp-post-title">{post.title}</h1>
                        
                        {/* Метаинформация (под заголовком) */}
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
                        
                        {/* УСЛОВНЫЙ РЕНДЕРИНГ КНОПОК (над заголовком, справа) */}
                        {isAuthor && (
                            <div className="sp-author-actions">
                                <button
                                    onClick={() => navigate(`/post/edit/${post.id}`)}
                                    className="action-btn sp-edit-btn"
                                >
                                    Изменить
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="action-btn sp-delete-btn"
                                >
                                    Удалить
                                </button>
                            </div>
                        )}
                    </div>
                    {/* ---------------------------------- */}


                    {/* Слайдер с контентом */}
                    <div className="sp-content-slider">
                        <button className="sp-nav-arrow" onClick={handlePrev} disabled={currentSlide === 0}>
                            <FaAngleDoubleLeft />
                        </button>

                        {/* Карточка слайда с фиолетовой рамкой */}
                        <div className="sp-slide-view sp-slider-box">
                            <div className="sp-slide-meta">
                                <span className="sp-slide-info">Слайд {currentSlide + 1} из {maxSlides}</span>
                                {/* Убрал user_id отсюда, оставим его в блоке sp-user-info ниже, как на макете */}
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
                            
                            {/* Информация об авторе и Комментарии */}
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