import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ContentLayout from '../components/ContentLayout.tsx';
import SearchBox from '../components/SearchBox.tsx';
import './PostCreatePage.css';
import { uploadImage } from '../firebase/uploadImage'; 
import { FaPlus, FaAngleDoubleLeft, FaAngleDoubleRight, FaTimes, FaTrashAlt, FaUserPlus, FaUserTimes, FaSearch } from 'react-icons/fa';
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

interface CollaboratorInvite {
    username: string;
    user_id: number;
    role: string;
    status: 'pending' | 'accepted' | 'declined';
}

interface SearchUserResult {
    id: number;
    username: string;
    image_url: string;
    is_followed: boolean;
}

const MAX_SLIDES = 20;

const PostCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isLoggedIn } = useAuth(); 

    const [title, setTitle] = useState('');
    const [selectedSettlement, setSelectedSettlement] = useState<SettlementResult | null>(null);
    const [settlementInput, setSettlementInput] = useState('');
    const [tags, setTags] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);

    const [slides, setSlides] = useState<SlideData[]>([
        { id: Date.now(), text: '', imageUrl: '', isLoadingImage: false }
    ]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // Стейты для соавторов
    const [collaborators, setCollaborators] = useState<CollaboratorInvite[]>([]);
    const [isCollaboratorSearchOpen, setIsCollaboratorSearchOpen] = useState(false);
    const [collaboratorSearchInput, setCollaboratorSearchInput] = useState('');
    const [collaboratorSearchResults, setCollaboratorSearchResults] = useState<SearchUserResult[]>([]);
    const [isSearchingCollaborators, setIsSearchingCollaborators] = useState(false);
    const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
    
    // Ref для debounce
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Очистка таймера при размонтировании
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const handleSettlementSelect = (result: SettlementResult) => {
        console.log('Settlement selected:', result);
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
            } catch (error) {
                console.error("Ошибка загрузки фото:", error);
                alert("Не удалось загрузить фото");
            } finally {
                updateCurrentSlide('isLoadingImage', false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveImage = (e: React.MouseEvent) => { 
        e.stopPropagation(); 
        updateCurrentSlide('imageUrl', ''); 
    };

    // Функция выполнения поиска
    const performSearch = async (query: string) => {
        if (query.length < 2) return;
        
        setIsSearchingCollaborators(true);
        try {
            const response = await axios.get(`/api/user/search/invite?q=${encodeURIComponent(query)}`, {
                withCredentials: true
            });
            console.log('Search results:', response.data);
            setCollaboratorSearchResults(response.data.results || []);
        } catch (error) {
            console.error('Ошибка поиска пользователей:', error);
            setCollaboratorSearchResults([]);
        } finally {
            setIsSearchingCollaborators(false);
        }
    };

    // Обработчик ввода с debounce
    const handleCollaboratorSearch = (value: string) => {
        setCollaboratorSearchInput(value);
        
        // Очищаем предыдущий таймер
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        // Устанавливаем новый таймер
        searchTimeoutRef.current = setTimeout(() => {
            if (value.length >= 2) {
                performSearch(value);
            } else {
                setCollaboratorSearchResults([]);
            }
        }, 500);
    };

    // Отправка приглашения
    const inviteCollaborator = (userId: number, username: string) => {
        // Проверяем, не приглашён ли уже
        if (collaborators.some(c => c.user_id === userId)) {
            alert('Этот пользователь уже приглашён');
            return;
        }
        
        // Добавляем в локальный список со статусом pending
        setCollaborators(prev => [...prev, {
            username: username,
            user_id: userId,
            role: inviteRole,
            status: 'pending'
        }]);
        
        // Закрываем модалку и очищаем
        setIsCollaboratorSearchOpen(false);
        setCollaboratorSearchInput('');
        setCollaboratorSearchResults([]);
    };

    // Удаление приглашённого
    const removeCollaboratorInvite = (userId: number) => {
        setCollaborators(prev => prev.filter(c => c.user_id !== userId));
    };

    const handlePublish = async () => {
        if (!isLoggedIn) {
            alert('Для публикации необходимо войти в систему.');
            navigate('/login');
            return;
        }
        
        if (!title.trim()) {
            alert('Введите название поста');
            return;
        }
        
        if (!selectedSettlement) {
            alert('Выберите населенный пункт из списка');
            return;
        }

        console.log('Selected settlement:', selectedSettlement);
        console.log('Settlement input:', settlementInput);
        
        setIsPublishing(true);

        // Обработка тегов
        const parsedTags = tags
            .split(/\s+/)
            .map(t => t.startsWith('#') ? t.substring(1) : t)
            .filter(t => t.trim() !== "")
            .map(t => t.toLowerCase());

        // Подготовка параграфов
        const paragraphs = slides
            .map((slide, index) => ({
                content: slide.text,
                order: index + 1,
            }))
            .filter(p => p.content.trim() !== "");

        // Подготовка фото
        const photos = slides
            .filter(slide => slide.imageUrl)
            .map((slide, index) => ({
                url: slide.imageUrl,
                order: index + 1,
                is_approved: true
            }));

        // Подготовка данных поста с приглашениями
        const postData = {
            title: title,
            settlement_id: Number(selectedSettlement.id),
            settlement_name: settlementInput || selectedSettlement.name,
            tags: parsedTags,
            paragraphs: paragraphs,
            photos: photos,
            invites: collaborators.map(c => ({
                user_id: c.user_id,
                role: c.role
            }))
        };

        console.log('Sending post data (final):', JSON.stringify(postData, null, 2));

        try {
            const response = await axios.post('/api/posts', postData, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 201) {
                const inviteCount = collaborators.length;
                const message = inviteCount > 0 
                    ? `Публикация успешно создана! Приглашения отправлены ${inviteCount} пользователям.`
                    : 'Публикация успешно создана!';
                alert(message);
                navigate('/profile');
            }
        } catch (error: any) {
            console.error('Ошибка публикации:', error);
            console.error('Response data:', error.response?.data);
            
            let errorMessage = 'Неизвестная ошибка';
            if (error.response?.data?.details) {
                errorMessage = error.response.data.details;
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
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

    // Модальное окно поиска соавторов
    const CollaboratorSearchModal = () => (
        <div className="collaborator-modal-overlay" onClick={() => {
            setIsCollaboratorSearchOpen(false);
            setCollaboratorSearchInput('');
            setCollaboratorSearchResults([]);
        }}>
            <div className="collaborator-modal" onClick={e => e.stopPropagation()}>
                <div className="collaborator-modal-header">
                    <h3>Пригласить соавтора</h3>
                    <button 
                        className="close-btn" 
                        onClick={() => {
                            setIsCollaboratorSearchOpen(false);
                            setCollaboratorSearchInput('');
                            setCollaboratorSearchResults([]);
                        }}
                    >
                        ✕
                    </button>
                </div>
                
                <div className="collaborator-modal-body">
                    <div className="role-selector">
                        <label>Роль приглашённого:</label>
                        <div className="role-buttons">
                            <button 
                                className={`role-btn ${inviteRole === 'editor' ? 'active' : ''}`}
                                onClick={() => setInviteRole('editor')}
                            >
                                Редактор
                            </button>
                            <button 
                                className={`role-btn ${inviteRole === 'viewer' ? 'active' : ''}`}
                                onClick={() => setInviteRole('viewer')}
                            >
                                Читатель
                            </button>
                        </div>
                    </div>
                    
                    <div className="search-box">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Введите username (минимум 2 символа)..."
                            value={collaboratorSearchInput}
                            onChange={(e) => handleCollaboratorSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    <div className="search-results">
                        {isSearchingCollaborators && (
                            <div className="search-loading">Поиск...</div>
                        )}
                        {!isSearchingCollaborators && collaboratorSearchResults.length === 0 && collaboratorSearchInput.length >= 2 && (
                            <div className="no-results">Пользователи не найдены</div>
                        )}
                        {!isSearchingCollaborators && collaboratorSearchResults.map(searchUser => (
                            <div 
                                key={searchUser.id} 
                                className="search-result-item" 
                                onClick={() => inviteCollaborator(searchUser.id, searchUser.username)}
                            >
                                <img src={searchUser.image_url || '/default-avatar.png'} alt={searchUser.username} />
                                <span>@{searchUser.username}</span>
                                {searchUser.is_followed && (
                                    <span className="follow-badge">Подписан(а)</span>
                                )}
                                <button className="invite-btn">Пригласить</button>
                            </div>
                        ))}
                    </div>
                    
                    <div className="invite-info">
                        <p>Приглашённый пользователь получит уведомление и сможет принять или отклонить приглашение. Автором поста остаётесь вы.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <ContentLayout>
            <div className="create-post-container">
                <div className="create-post-form">
                    <h2 className="form-title">Создание публикации</h2>

                    {/* Название поста */}
                    <input 
                        type="text" 
                        className="custom-input" 
                        placeholder="Название" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                    />

                    {/* Поиск населенного пункта */}
                    <SearchBox 
                        onSelect={handleSettlementSelect}
                        placeholder="Введите населенный пункт..."
                        initialValue={settlementInput}
                    />

                    {/* Слайдер область */}
                    <div className="slide-container">
                        <button 
                            className="nav-arrow" 
                            onClick={handlePrevSlide} 
                            disabled={currentSlideIndex === 0}
                        >
                            <FaAngleDoubleLeft />
                        </button>

                        {/* Карточка текущего слайда */}
                        <div className="slide-content-box">
                            <div className="slide-counter">
                                {currentSlideIndex + 1} / {slides.length}
                            </div>
                            
                            {/* Текстовая область слайда */}
                            <div className="text-area-wrapper">
                                <textarea 
                                    className="slide-textarea" 
                                    placeholder="Текст слайда"
                                    value={currentSlide.text}
                                    onChange={(e) => updateCurrentSlide('text', e.target.value)}
                                />
                            </div>
                            
                            {/* Блок для фото */}
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

                    {/* Кнопки управления слайдами */}
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

                    {/* Теги */}
                    <input 
                        type="text" 
                        className="custom-input" 
                        placeholder="Теги (через пробел, например: #фуд #отдых)" 
                        value={tags} 
                        onChange={(e) => setTags(e.target.value)} 
                        style={{ marginTop: '10px' }}
                    />

                    {/* Блок соавторов */}
                    <div className="collaborators-section">
                        <div className="collaborators-header">
                            <span className="collaborators-title">
                                <FaUserPlus /> Соавторы (опционально)
                            </span>
                            <button 
                                className="add-collaborator-btn"
                                onClick={() => setIsCollaboratorSearchOpen(true)}
                            >
                                + Пригласить
                            </button>
                        </div>
                        
                        {collaborators.length > 0 && (
                            <div className="collaborators-list">
                                {collaborators.map(collab => (
                                    <div key={collab.user_id} className="collaborator-chip">
                                        <span>@{collab.username}</span>
                                        {collab.status === 'pending' && (
                                            <span className="status-badge pending">⏳ ожидает</span>
                                        )}
                                        <button 
                                            className="remove-collaborator"
                                            onClick={() => removeCollaboratorInvite(collab.user_id)}
                                        >
                                            <FaUserTimes />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <p className="collaborators-hint">
                            Соавторы смогут добавлять контент в пост после принятия приглашения.
                            Автором поста остаётесь вы.
                        </p>
                    </div>

                    {/* Кнопка публикации */}
                    <button 
                        className="publish-btn" 
                        onClick={handlePublish} 
                        disabled={isPublishing}
                    >
                        {isPublishing ? 'Публикация...' : 'Опубликовать'}
                    </button>
                </div>
            </div>

            {/* Модальное окно приглашения соавторов */}
            {isCollaboratorSearchOpen && <CollaboratorSearchModal />}
        </ContentLayout>
    );
};

export default PostCreatePage;