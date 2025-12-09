import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './PostCreatePage.css';
import { uploadImage } from '../firebase/uploadImage'; 
import { FaPlus, FaAngleDoubleLeft, FaAngleDoubleRight, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx';

interface SlideData {
    id: number;
    text: string;
    imageUrl: string;
    isLoadingImage: boolean;
}

const MAX_SLIDES = 20;

const PostCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth(); 

    const [title, setTitle] = useState('');
    const [place, setPlace] = useState('');
    const [tags, setTags] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);

    const [slides, setSlides] = useState<SlideData[]>([
        { id: Date.now(), text: '', imageUrl: '', isLoadingImage: false }
    ]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Управление слайдами ---

    const handleNextSlide = () => currentSlideIndex < slides.length - 1 && setCurrentSlideIndex(prev => prev + 1);
    const handlePrevSlide = () => currentSlideIndex > 0 && setCurrentSlideIndex(prev => prev - 1);

    const handleAddSlide = () => {
        if (slides.length >= MAX_SLIDES) {
            alert(`Достигнут лимит слайдов: ${MAX_SLIDES}`);
            return;
        }
        setSlides(prev => [...prev, { id: Date.now(), text: '', imageUrl: '', isLoadingImage: false }]);
        setCurrentSlideIndex(slides.length); 
    };
    
    const handleRemoveSlide = () => {
        if (slides.length === 1) {
            alert("Нельзя удалить единственный слайд!");
            return;
        }
        if (!window.confirm("Вы уверены, что хотите удалить этот слайд?")) return;

        setSlides(prev => {
            const newSlides = prev.filter((_, index) => index !== currentSlideIndex);
            setCurrentSlideIndex(prevIdx => (prevIdx >= newSlides.length ? newSlides.length - 1 : prevIdx));
            return newSlides;
        });
    };

    const updateCurrentSlide = (key: keyof SlideData, value: any) => {
        setSlides(prev => {
            const newSlides = [...prev];
            newSlides[currentSlideIndex] = { ...newSlides[currentSlideIndex], [key]: value };
            return newSlides;
        });
    };

    // --- Работа с фото ---
    const triggerFileSelect = (e: React.MouseEvent) => { e.preventDefault(); fileInputRef.current?.click(); };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            updateCurrentSlide('isLoadingImage', true);
            try {
                const url = await uploadImage(file);
                updateCurrentSlide('imageUrl', url);
            } catch (error) {
                console.error("Ошибка загрузки фото:", error);
                alert("Не удалось загрузить фото");
            } finally {
                updateCurrentSlide('isLoadingImage', false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveImage = (e: React.MouseEvent) => { e.stopPropagation(); updateCurrentSlide('imageUrl', ''); };

    const handlePublish = async () => {
        if (!isLoggedIn) {
             alert('Для публикации необходимо войти в систему.');
             navigate('/login');
             return;
        }
        if (!title.trim()) return alert('Введите название поста');
        if (!place.trim()) return alert('Укажите место');
        
        setIsPublishing(true);

        // 1. Парсинг тегов: разбиваем по пробелам, очищаем от '#' и пустых
        const parsedTags = tags
            .split(/\s+/) 
            .map(t => t.startsWith('#') ? t.substring(1) : t) 
            .filter(t => t.trim() !== "") 
            .map(t => t.toLowerCase()); 

        // 2. Подготовка параграфов
        const paragraphs = slides
            .map((slide, index) => ({
                content: slide.text,
                order: index + 1,
            }))
            .filter(p => p.content.trim() !== "");

        // 3. Подготовка фото
        const photos = slides
            .filter(slide => slide.imageUrl)
            .map((slide, index) => ({
                url: slide.imageUrl,
                order: index + 1,
                is_approved: true
            }));

        // 4. Сборка итогового JSON
        const postData = {
            title: title,
            place_data: {
                name: place,
                desc: "", 
                latitude: 0.0, 
                longitude: 0.0 
            },
            tags: parsedTags, 
            paragraphs: paragraphs,
            photos: photos
        };

        try {
            const response = await axios.post('/api/posts', postData, {
                withCredentials: true, 
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 201) {
                alert('Публикация успешно создана!');
                navigate('/profile'); 
            }
        } catch (error: any) {
            console.error('Ошибка публикации:', error);
            const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message;
            
            if (error.response && error.response.status === 401) {
                alert('Вы не авторизованы. Перенаправление на страницу входа.');
                navigate('/login');
            } else {
                alert('Ошибка при создании поста: ' + errorMessage);
            }
        } finally {
            setIsPublishing(false);
        }
    };

    const currentSlide = slides[currentSlideIndex];
    const isMaxSlidesReached = slides.length >= MAX_SLIDES;
    const isOnlyOneSlide = slides.length === 1;

    return (
        <ContentLayout>
            <div className="create-post-container">
                
                <div className="create-post-form">
                    <h2 className="form-title">Создание публикации</h2>

                    {/* Название и Место */}
                    <input type="text" className="custom-input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <input type="text" className="custom-input" placeholder="Место" value={place} onChange={(e) => setPlace(e.target.value)} />

                    {/* Слайдер область */}
                    <div className="slide-container">
                        
                        <button className="nav-arrow" onClick={handlePrevSlide} disabled={currentSlideIndex === 0}><FaAngleDoubleLeft /></button>

                        {/* Карточка слайда */}
                        <div className="slide-content-box">
                            
                            <div className="slide-counter">{currentSlideIndex + 1} / {slides.length}</div>
                            
                            {/* Текстовая область */}
                            <div className="text-area-wrapper">
                                <textarea 
                                    className="slide-textarea" 
                                    placeholder="Текст слайда"
                                    value={currentSlide.text}
                                    onChange={(e) => updateCurrentSlide('text', e.target.value)}
                                />
                            </div>
                            
                            {/* Блок действий (Фото) */}
                            <div className="slide-action-area">
                                <div className="add-photo-btn-container">
                                    <span className="photo-label">Фото</span>
                                    <button className="add-photo-btn" onClick={triggerFileSelect} disabled={currentSlide.isLoadingImage}>
                                        <FaPlus />
                                    </button>
                                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageChange} />
                                </div>

                                {currentSlide.imageUrl && (
                                    <div className="image-preview-area">
                                        <img src={currentSlide.imageUrl} alt="Slide preview" className="slide-image-preview" />
                                        <button className="remove-image-btn" onClick={handleRemoveImage}><FaTimes /></button>
                                    </div>
                                )}
                                {currentSlide.isLoadingImage && !currentSlide.imageUrl && <p className="loading-message">Загрузка фото...</p>}
                            </div>
                        </div>

                        <button className="nav-arrow" onClick={handleNextSlide} disabled={currentSlideIndex === slides.length - 1}><FaAngleDoubleRight /></button>
                    </div>

                    {/* Кнопки "Добавить слайд" и "Удалить слайд" */}
                    <div className="slide-actions-bottom">
                        <div className={`add-slide-action ${isMaxSlidesReached ? 'disabled' : ''}`} onClick={isMaxSlidesReached ? undefined : handleAddSlide}>
                            <div className="add-slide-icon-box"><FaPlus /></div>
                            <span className="add-slide-text">Добавить слайд</span>
                        </div>

                        {!isOnlyOneSlide && (
                            <div className="remove-slide-action" onClick={handleRemoveSlide}>
                                <div className="remove-slide-icon-box"><FaTrashAlt /></div>
                                <span className="remove-slide-text">Удалить слайд</span>
                            </div>
                        )}
                    </div>
                    {isMaxSlidesReached && <p className="limit-message">Лимит слайдов ({MAX_SLIDES}) достигнут.</p>}


                    {/* Теги */}
                    <input type="text" className="custom-input" placeholder="Теги (через пробел, например: #фуд #отдых)" value={tags} onChange={(e) => setTags(e.target.value)} style={{ marginTop: '10px' }} />

                    {/* Опубликовать */}
                    <button 
                        className="publish-btn" 
                        onClick={handlePublish} 
                        disabled={isPublishing}
                    >
                        {isPublishing ? 'Публикация...' : 'Опубликовать'}
                    </button>
                </div>
            </div>
        </ContentLayout>
    );
};

export default PostCreatePage;