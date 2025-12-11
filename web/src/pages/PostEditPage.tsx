import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import './PostEditPage.css'; 
import { uploadImage } from '../firebase/uploadImage'; 
import { FaPlus, FaAngleDoubleLeft, FaAngleDoubleRight, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx';

interface SlideData {
    id: number;
    text: string;
    imageUrl: string;
    isLoadingImage: boolean;
}

const MAX_SLIDES = 20;

const PostEditPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth(); 

    const [title, setTitle] = useState('');
    const [place, setPlace] = useState('');
    const [tags, setTags] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [slides, setSlides] = useState<SlideData[]>([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPostData = async () => {
            try {
                const response = await axios.get(`/api/posts/${id}`, { withCredentials: true });
                const data = response.data;

                setTitle(data.title);
                setPlace(data.place_name);
                setTags(data.tags ? data.tags.map((t: string) => `#${t}`).join(' ') : '');

                const loadedSlides: SlideData[] = [];
                const paragraphs = data.paragraphs || [];
                const photos = data.photos || [];

                const maxOrderText = paragraphs.length > 0 ? Math.max(...paragraphs.map((p: any) => p.order)) : 0;
                const maxOrderPhoto = photos.length > 0 ? Math.max(...photos.map((p: any) => p.order)) : 0;
                const totalSlides = Math.max(maxOrderText, maxOrderPhoto);

                for (let i = 1; i <= totalSlides; i++) {
                    const p = paragraphs.find((item: any) => item.order === i);
                    const ph = photos.find((item: any) => item.order === i);

                    loadedSlides.push({
                        id: Date.now() + i,
                        text: p ? p.content : '',
                        imageUrl: ph ? ph.url : '',
                        isLoadingImage: false
                    });
                }

                if (loadedSlides.length === 0) {
                    loadedSlides.push({ id: Date.now(), text: '', imageUrl: '', isLoadingImage: false });
                }

                setSlides(loadedSlides);

            } catch (error) {
                console.error("Ошибка загрузки:", error);
                alert("Не удалось загрузить пост.");
                navigate('/profile');
            } finally {
                setLoading(false);
            }
        };

        if (isLoggedIn && id) {
            fetchPostData();
        }
    }, [id, isLoggedIn, navigate]);

    const handleNextSlide = () => currentSlideIndex < slides.length - 1 && setCurrentSlideIndex(prev => prev + 1);
    const handlePrevSlide = () => currentSlideIndex > 0 && setCurrentSlideIndex(prev => prev - 1);

    const handleAddSlide = () => {
        if (slides.length >= MAX_SLIDES) return;
        setSlides(prev => [...prev, { id: Date.now(), text: '', imageUrl: '', isLoadingImage: false }]);
        setCurrentSlideIndex(slides.length); 
    };
    
    const handleRemoveSlide = () => {
        if (slides.length === 1) return;
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

    const triggerFileSelect = (e: React.MouseEvent) => { e.preventDefault(); fileInputRef.current?.click(); };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            updateCurrentSlide('isLoadingImage', true);
            try {
                const url = await uploadImage(file);
                updateCurrentSlide('imageUrl', url);
            } catch (error) {
                alert("Ошибка загрузки фото");
            } finally {
                updateCurrentSlide('isLoadingImage', false);
                 if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveImage = (e: React.MouseEvent) => { e.stopPropagation(); updateCurrentSlide('imageUrl', ''); };

    const handleUpdate = async () => {
        if (!title.trim() || !place.trim()) return alert('Заполните название и место');
        setIsSaving(true);

        const parsedTags = tags.split(/\s+/).map(t => t.replace('#', '')).filter(t => t.trim() !== "").map(t => t.toLowerCase()); 
        const paragraphs = slides.map((slide, index) => ({ content: slide.text, order: index + 1 })).filter(p => p.content.trim() !== "");
        const photos = slides.map((slide, index) => slide.imageUrl ? ({ url: slide.imageUrl, order: index + 1, is_approved: true }) : null).filter((p): p is { url: string; order: number; is_approved: boolean } => p !== null);

        const postData = {
            title,
            place_data: { name: place, desc: "", latitude: 0, longitude: 0 },
            tags: parsedTags, 
            paragraphs,
            photos
        };

        try {
            await axios.put(`/api/posts/${id}`, postData, { withCredentials: true });
            alert('Публикация обновлена!');
            navigate(`/post/${id}`);
        } catch (error) {
            console.error(error);
            alert('Ошибка при обновлении.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Вы уверены, что хотите удалить этот пост безвозвратно?")) return;
        
        try {
            await axios.delete(`/api/posts/${id}`, { withCredentials: true });
            alert('Пост удален.');
            navigate('/profile');
        } catch (error) {
            console.error(error);
            alert('Ошибка при удалении.');
        }
    };

    if (loading) return (
        <ContentLayout>
            <div style={{padding: 50, textAlign: 'center'}}>Загрузка...</div>
        </ContentLayout>
    );

    const currentSlide = slides[currentSlideIndex];

    return (
        <ContentLayout>
            <div className="edit-post-container">
                <div className="edit-form-wrapper">
                    <h2 className="edit-page-title">Изменение публикации</h2>

                    {/* Поле Название */}
                    <div className="input-wrapper">
                        <span className="input-label">Название</span>
                        <input 
                            type="text" 
                            className="edit-input" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                        />
                    </div>

                    {/* Поле Место */}
                    <div className="input-wrapper">
                        <span className="input-label">Место</span>
                        <input 
                            type="text" 
                            className="edit-input" 
                            value={place} 
                            onChange={(e) => setPlace(e.target.value)} 
                        />
                    </div>

                    {/* --- Слайдер / Редактор слайда --- */}
                    <div className="edit-slider-area">
                        <button className="edit-nav-btn left" onClick={handlePrevSlide} disabled={currentSlideIndex === 0}>
                            <FaAngleDoubleLeft />
                        </button>

                        <div className="edit-slide-card">
                            {/* Область Текста */}
                            <div className="input-wrapper" style={{ flexGrow: 1, marginBottom: 0, position: 'relative' }}>
                                <span className="slide-text-label">Текст</span>
                                <textarea 
                                    className="edit-textarea" 
                                    value={currentSlide.text}
                                    onChange={(e) => updateCurrentSlide('text', e.target.value)}
                                    placeholder={slides.length > 1 ? "Введите текст слайда" : "Введите основной текст публикации"}
                                />
                            </div>
                            
                            {/* Область Фото */}
                            <div className="edit-photo-zone">
                                <div className="input-wrapper" style={{ margin: 0, position: 'relative' }}>
                                    {currentSlide.imageUrl ? (
                                        <div className="photo-container" onClick={triggerFileSelect}>
                                            <img src={currentSlide.imageUrl} alt="preview" />
                                            <button className="remove-img-btn" onClick={handleRemoveImage}><FaTimes size={12}/></button>
                                        </div>
                                    ) : (
                                        <div className="photo-container" onClick={triggerFileSelect} style={{ border: '1px dashed #8c57ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="add-photo-label-inner">Фото</span>
                                            <button className="plus-btn-photo" disabled={currentSlide.isLoadingImage}>
                                                {currentSlide.isLoadingImage ? '...' : <FaPlus />}
                                            </button>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageChange} />
                                </div>
                            </div>
                            
                            {/* Кнопка удаления слайда */}
                            {slides.length > 1 && (
                                <div style={{textAlign: 'center', marginTop: '10px'}}>
                                     <span className="delete-slide-link" onClick={handleRemoveSlide}>Удалить слайд</span>
                                </div>
                            )}
                        </div>

                        <button className="edit-nav-btn right" onClick={handleNextSlide} disabled={currentSlideIndex === slides.length - 1}>
                            <FaAngleDoubleRight />
                        </button>
                    </div>

                    {/* Кнопка Добавить слайд */}
                    <div className="add-slide-center">
                         <span className="add-slide-label">Добавить слайд</span>
                         <button className="plus-btn-large" onClick={handleAddSlide} disabled={slides.length >= MAX_SLIDES}>
                            <FaPlus />
                         </button>
                    </div>

                    {/* Поле Теги */}
                    <div className="input-wrapper">
                        <span className="input-label">Теги</span>
                        <input 
                            type="text" 
                            className="edit-input" 
                            value={tags} 
                            onChange={(e) => setTags(e.target.value)} 
                        />
                    </div>

                    {/* Нижние кнопки действий */}
                    <div className="edit-actions-footer">
                        <button className="btn-delete-post" onClick={handleDelete}>Удалить пост</button>
                        <button className="btn-save-post" onClick={handleUpdate} disabled={isSaving}>
                            {isSaving ? 'Применяется...' : 'Применить'}
                        </button>
                    </div>

                </div>
            </div>
        </ContentLayout>
    );
};

export default PostEditPage;