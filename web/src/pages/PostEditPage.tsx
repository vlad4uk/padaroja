import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import ContentLayout from '../components/ContentLayout.tsx';
import SearchBox from '../components/SearchBox.tsx';
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

interface SettlementResult {
    id: number;
    name: string;
    display_name: string;
    latitude?: number;
    longitude?: number;
}

interface CollaboratorStatus {
    is_collaborator: boolean;
    is_owner: boolean;
    role: string | null;
}

const MAX_SLIDES = 20;

const PostEditPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth(); 

    const [title, setTitle] = useState('');
    const [selectedSettlement, setSelectedSettlement] = useState<SettlementResult | null>(null);
    const [settlementInput, setSettlementInput] = useState('');
    const [tags, setTags] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    const [slides, setSlides] = useState<SlideData[]>([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkCollaboratorStatus = async () => {
            if (!id || !isLoggedIn) return;
            
            try {
                const response = await axios.get(`/api/posts/${id}/collaborators/check`, {
                    withCredentials: true
                });
                const data: CollaboratorStatus = response.data;
                
                console.log('Collaborator status:', data);
                
                if (data.is_owner) {
                    setCanEdit(true);
                    setIsOwner(true);
                    console.log('User is owner, can edit');
                } else if (data.is_collaborator && data.role === 'editor') {
                    setCanEdit(true);
                    setIsOwner(false);
                    console.log('User is editor collaborator, can edit');
                } else {
                    setCanEdit(false);
                    setIsOwner(false);
                    console.log('User cannot edit, role:', data.role);
                    toast.error('У вас нет прав на редактирование этого поста');
                    navigate(`/post/${id}`);
                }
            } catch (error) {
                console.error('Ошибка проверки прав:', error);
                toast.error('Ошибка при проверке прав доступа');
                setCanEdit(false);
            }
        };
        
        checkCollaboratorStatus();
    }, [id, isLoggedIn, navigate]);

    useEffect(() => {
        const fetchPostData = async () => {
            try {
                const response = await axios.get(`/api/posts/${id}`, { withCredentials: true });
                const data = response.data;

                setTitle(data.title);
                
                if (data.settlement_id && data.settlement_name) {
                    setSelectedSettlement({
                        id: data.settlement_id,
                        name: data.settlement_name,
                        display_name: data.settlement_name
                    });
                    setSettlementInput(data.settlement_name);
                }

                setTags(data.tags ? data.tags.map((t: string) => `#${t}`).join(' ') : '');

                const loadedSlides: SlideData[] = [];
                const paragraphs = data.paragraphs || [];
                const photos = data.photos || [];

                const maxOrderText = paragraphs.length > 0 ? Math.max(...paragraphs.map((p: any) => p.order)) : 0;
                const maxOrderPhoto = photos.length > 0 ? Math.max(...photos.map((p: any) => p.order)) : 0;
                const totalSlides = Math.max(maxOrderText, maxOrderPhoto, 1);

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

                setSlides(loadedSlides);
                setCurrentSlideIndex(0);

            } catch (error) {
                console.error("Ошибка загрузки:", error);
                toast.error("Не удалось загрузить пост.");
                navigate('/profile');
            } finally {
                setLoading(false);
            }
        };

        if (isLoggedIn && id && canEdit) {
            fetchPostData();
        } else if (isLoggedIn && id && !canEdit) {
            setLoading(false);
        }
    }, [id, isLoggedIn, navigate, canEdit]);

    const handleSettlementSelect = (result: SettlementResult) => {
        setSelectedSettlement(result);
        setSettlementInput(result.name);
    };

    const handleNextSlide = () => {
        if (currentSlideIndex < slides.length - 1) {
            setCurrentSlideIndex(prev => prev + 1);
        }
    };
    
    const handlePrevSlide = () => {
        if (currentSlideIndex > 0) {
            setCurrentSlideIndex(prev => prev - 1);
        }
    };

    const handleAddSlide = () => {
        if (slides.length >= MAX_SLIDES) {
            toast.error(`Достигнут лимит слайдов: ${MAX_SLIDES}`);
            return;
        }
        setSlides(prev => [...prev, { id: Date.now(), text: '', imageUrl: '', isLoadingImage: false }]);
        setCurrentSlideIndex(slides.length);
        toast.success('Слайд добавлен');
    };
    
    const handleRemoveSlide = () => {
        if (slides.length === 1) {
            toast.error("Нельзя удалить единственный слайд!");
            return;
        }
 
        setSlides(prev => {
            const newSlides = prev.filter((_, index) => index !== currentSlideIndex);
            setCurrentSlideIndex(prevIdx => (prevIdx >= newSlides.length ? newSlides.length - 1 : prevIdx));
            return newSlides;
        });
        toast.success('Слайд удален');
    };

    const updateCurrentSlide = (key: keyof SlideData, value: any) => {
        setSlides(prev => {
            const newSlides = [...prev];
            if (newSlides[currentSlideIndex]) {
                newSlides[currentSlideIndex] = { ...newSlides[currentSlideIndex], [key]: value };
            }
            return newSlides;
        });
    };

    const triggerFileSelect = (e: React.MouseEvent) => { 
        e.preventDefault(); 
        fileInputRef.current?.click(); 
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            updateCurrentSlide('isLoadingImage', true);
            try {
                const url = await uploadImage(file);
                updateCurrentSlide('imageUrl', url);
                toast.success('Фото успешно обновлено');
            } catch (error) {
                console.error("Ошибка загрузки фото:", error);
                toast.error("Не удалось загрузить фото");
            } finally {
                updateCurrentSlide('isLoadingImage', false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveImage = (e: React.MouseEvent) => { 
        e.stopPropagation(); 
        updateCurrentSlide('imageUrl', ''); 
        toast.success('Фото удалено');
    };

    const handleUpdate = async () => {
        if (!title.trim()) {
            toast.error('Введите название поста');
            return;
        }
        
        if (!selectedSettlement) {
            toast.error('Выберите населенный пункт из списка');
            return;
        }
        
        setIsSaving(true);

        const parsedTags = tags
            .split(/\s+/)
            .map(t => t.startsWith('#') ? t.substring(1) : t)
            .filter(t => t.trim() !== "")
            .map(t => t.toLowerCase());

        const paragraphs = slides
            .map((slide, index) => ({ 
                content: slide.text, 
                order: index + 1 
            }))
            .filter(p => p.content.trim() !== "");

        const photos = slides
            .map((slide, index) => slide.imageUrl ? ({ 
                url: slide.imageUrl, 
                order: index + 1, 
                is_approved: true 
            }) : null)
            .filter((p): p is { url: string; order: number; is_approved: boolean } => p !== null);

        const postData = {
            title,
            settlement_id: selectedSettlement.id,
            settlement_name: settlementInput,
            tags: parsedTags,
            paragraphs,
            photos
        };

        console.log('Updating post with data:', postData);

        try {
            await axios.put(`/api/posts/${id}`, postData, { 
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            toast.success('Публикация обновлена!');
            navigate(`/post/${id}`);
        } catch (error: any) {
            console.error('Ошибка обновления:', error);
            const errorMessage = error.response?.data?.details || error.response?.data?.error || 'Ошибка при обновлении';
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!isOwner) {
            toast.error('Только автор поста может удалить его');
            return;
        }
        
 
        try {
            await axios.delete(`/api/posts/${id}`, { withCredentials: true });
            toast.success('Пост успешно удален');
            navigate('/profile');
        } catch (error) {
            console.error(error);
            toast.error('Ошибка при удалении поста');
        }
    };

    if (loading) return (
        <ContentLayout>
            <div style={{padding: 50, textAlign: 'center'}}>Загрузка...</div>
        </ContentLayout>
    );

    if (!canEdit) {
        return (
            <ContentLayout>
                <div style={{padding: 50, textAlign: 'center'}}>
                    <p>У вас нет прав на редактирование этого поста.</p>
                    <button onClick={() => navigate(`/post/${id}`)}>Вернуться к посту</button>
                </div>
            </ContentLayout>
        );
    }

    if (slides.length === 0) {
        return (
            <ContentLayout>
                <div style={{padding: 50, textAlign: 'center'}}>Загрузка слайдов...</div>
            </ContentLayout>
        );
    }

    const currentSlide = slides[currentSlideIndex];
    const isMaxSlidesReached = slides.length >= MAX_SLIDES;
    const isOnlyOneSlide = slides.length === 1;

    return (
        <ContentLayout>
            <div className="create-post-container">
                <div className="create-post-form">
                    <h2 className="form-title">
                        {!isOwner ? 'Редактирование поста (соавтор)' : 'Редактирование публикации'}
                    </h2>

                    <input 
                        type="text" 
                        className="custom-input" 
                        placeholder="Название" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                    />

                    <SearchBox 
                        onSelect={handleSettlementSelect}
                        placeholder="Введите населенный пункт..."
                        initialValue={settlementInput}
                    />

                    <div className="slide-container">
                        <button 
                            className="nav-arrow" 
                            onClick={handlePrevSlide} 
                            disabled={currentSlideIndex === 0}
                        >
                            <FaAngleDoubleLeft />
                        </button>

                        <div className="slide-content-box">
                            <div className="slide-counter">
                                {currentSlideIndex + 1} / {slides.length}
                            </div>
                            
                            <div className="text-area-wrapper">
                                <textarea 
                                    className="slide-textarea" 
                                    placeholder="Текст слайда"
                                    value={currentSlide.text}
                                    onChange={(e) => updateCurrentSlide('text', e.target.value)}
                                />
                            </div>
                            
                            <div className="slide-action-area">
                                <div className="add-photo-btn-container">
                                    <span className="photo-label">Фото</span>
                                    <button 
                                        className="add-photo-btn" 
                                        onClick={triggerFileSelect} 
                                        disabled={currentSlide.isLoadingImage}
                                    >
                                        <FaPlus />
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        style={{ display: 'none' }} 
                                        accept="image/*" 
                                        onChange={handleImageChange} 
                                    />
                                </div>

                                {currentSlide.imageUrl && (
                                    <div className="image-preview-area">
                                        <img 
                                            src={currentSlide.imageUrl} 
                                            alt="Slide preview" 
                                            className="slide-image-preview" 
                                        />
                                        <button 
                                            className="remove-image-btn" 
                                            onClick={handleRemoveImage}
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                )}
                                {currentSlide.isLoadingImage && !currentSlide.imageUrl && (
                                    <p className="loading-message">Загрузка фото...</p>
                                )}
                            </div>
                        </div>

                        <button 
                            className="nav-arrow" 
                            onClick={handleNextSlide} 
                            disabled={currentSlideIndex === slides.length - 1}
                        >
                            <FaAngleDoubleRight />
                        </button>
                    </div>

                    <div className="slide-actions-bottom">
                        <div 
                            className={`add-slide-action ${isMaxSlidesReached ? 'disabled' : ''}`} 
                            onClick={isMaxSlidesReached ? undefined : handleAddSlide}
                        >
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
                    {isMaxSlidesReached && (
                        <p className="limit-message">Лимит слайдов ({MAX_SLIDES}) достигнут.</p>
                    )}

                    <input 
                        type="text" 
                        className="custom-input" 
                        placeholder="Теги (через пробел, например: #фуд #отдых)" 
                        value={tags} 
                        onChange={(e) => setTags(e.target.value)} 
                        style={{ marginTop: '10px' }}
                    />

                    {/* Блок с кнопками Удалить/Сохранить */}
                    <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                        {isOwner && (
                            <button 
                                className="btn-delete-post" 
                                onClick={handleDelete}
                                style={{
                                    flex: 1,
                                    padding: '15px',
                                    background: 'white',
                                    color: 'black',
                                    border: '1px solid black',
                                    borderRadius: '30px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'background 0.3s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e04444'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#ff5757'}
                            >
                                Удалить пост
                            </button>
                        )}
                        <button 
                            className="publish-btn" 
                            onClick={handleUpdate} 
                            disabled={isSaving}
                            style={{ marginTop: 0, flex: isOwner ? 1 : 1 }}
                        >
                            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                        </button>
                    </div>
                </div>
            </div>
        </ContentLayout>
    );
};

export default PostEditPage;