import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import './MapView.css';

// ==========================================================
// ФИКС ИКОНОК LEAFLET
// ==========================================================
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// ==========================================================
// ГРАНИЦЫ И МАСШТАБ
// ==========================================================
const StrictBelarusBounds: L.LatLngBoundsLiteral = [[51.1, 23.0], [56.3, 32.5]];
const BELARUS_CENTER: L.LatLngTuple = [53.9, 27.5667];

// Кастомные иконки
const reviewOnlyIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const postOnlyIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const reviewWithPostIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const selectedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34]
});

interface MapViewProps {
  targetUserId?: number;
}

interface MapData {
  reviews: ReviewMarker[];
  posts: PostMarker[];
  userPosts?: UserPost[];
  user?: {
    id: number;
    username: string;
    avatar: string;
  };
}

interface ReviewMarker {
  id: string;
  place_id: number;
  content: string;
  rating: number;
  created_at: string;
  place_name: string;
  latitude: number;
  longitude: number;
  user_name: string;
  user_avatar: string;
  user_id: number;
}

interface PostMarker {
  id: number;
  title: string;
  place_id: number;
  place_name: string;
  latitude: number;
  longitude: number;
  created_at: string;
  photos: string[];
  likes_count: number;
  user_id: number;
  user_name: string;
}

interface UserPost {
  id: number;
  title: string;
  created_at: string;
  place_id: number | null;
  user_id?: number;
  photos?: Array<{ url: string }>;
}

interface NewReviewData {
  name: string;
  content: string;
  rating: number;
  latitude: number;
  longitude: number;
  attachPostId?: string;
}

// Компонент для выбора мест на карте
function PlaceSelector({ onPlaceSelect }: { onPlaceSelect: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPlaceSelect(e.latlng);
    }
  });
  return null;
}

// Объединенный интерфейс для мест
interface PlaceData {
  id: number;
  place_id: number;
  place_name: string;
  latitude: number;
  longitude: number;
  type: 'review' | 'post' | 'both';
  review?: ReviewMarker;
  post?: PostMarker;
}

// Компонент превью поста
interface PostPreviewProps {
  post: PostMarker;
  onViewPost: (postId: number) => void;
  compact?: boolean;
}

const PostPreview: React.FC<PostPreviewProps> = ({ post, onViewPost, compact = false }) => {
  const hasPhoto = post.photos && post.photos.length > 0;
  const previewText = post.title.length > 60 ? post.title.substring(0, 60) + '...' : post.title;

  return (
    <div 
      className="post-preview" 
      onClick={() => onViewPost(post.id)}
      style={{
        cursor: 'pointer',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        margin: compact ? '0' : '8px 0',
        border: '1px solid #e5e5e5',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        e.currentTarget.style.borderColor = '#696cff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        e.currentTarget.style.borderColor = '#e5e5e5';
      }}
    >
      {hasPhoto && (
        <div 
          style={{
            height: compact ? '70px' : '100px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <img 
            src={post.photos[0]} 
            alt={post.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
          />
          <div style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            fontSize: '11px',
            padding: '3px 6px',
            borderRadius: '4px',
            backdropFilter: 'blur(2px)'
          }}>
            📸
          </div>
        </div>
      )}
      <div style={{
        padding: compact ? '8px' : '12px'
      }}>
        <div style={{
          fontWeight: 600,
          fontSize: compact ? '13px' : '14px',
          marginBottom: '6px',
          color: '#262626',
          lineHeight: 1.4,
          letterSpacing: '-0.01em'
        }}>
          {previewText}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: compact ? '11px' : '12px',
          color: '#666'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#ff4757' }}>❤️</span>
            <span>{post.likes_count || 0}</span>
          </span>
          <span style={{ 
            fontSize: '11px',
            background: '#f8f9fa',
            padding: '2px 6px',
            borderRadius: '10px',
            border: '1px solid #e9ecef'
          }}>
            {new Date(post.created_at).toLocaleDateString('ru-RU', { 
              day: 'numeric', 
              month: 'short' 
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

const MapView: React.FC<MapViewProps> = ({ targetUserId }) => {
  const { user: currentUser, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const controlsRef = useRef<HTMLDivElement>(null);
  
  const [mapData, setMapData] = useState<MapData>({ 
    reviews: [], 
    posts: [], 
    userPosts: [] 
  });
  
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<L.LatLng | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'attach'>('view');
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);
  
  const [reviewData, setReviewData] = useState<NewReviewData>({
    name: '',
    content: '',
    rating: 5,
    latitude: 0,
    longitude: 0,
    attachPostId: ''
  });
  
  const [selectedPostForAttach, setSelectedPostForAttach] = useState<string>('');

  // Определяем, это своя карта или чужая
  const isOwnProfile = useMemo(() => {
    if (!targetUserId && currentUser && isLoggedIn) return true;
    if (targetUserId && currentUser) return targetUserId === currentUser.id;
    return false;
  }, [targetUserId, currentUser, isLoggedIn]);

  // Загрузка данных для карты
  useEffect(() => {
    const loadMapData = async () => {
      try {
        setLoading(true);
        
        let endpoint: string;
        let config = { withCredentials: true };
        
        // ВСЕГДА проверяем targetUserId в первую очередь
        if (targetUserId) {
          // Страница другого пользователя (/user/:userId)
          endpoint = `/api/map/user/${targetUserId}/data`;
          config = { withCredentials: false };
        } else if (isLoggedIn && currentUser) {
          // Своя страница (/profile)
          endpoint = `/api/map/user-data`;
          config = { withCredentials: true };
        } else {
          setLoading(false);
          return;
        }
        
        const mapResponse = await axios.get(endpoint, config);
        const mapDataResponse = mapResponse.data;
        
        // Для своей карты дополнительно загружаем посты для прикрепления
        let userPostsData = [];
        if (!targetUserId && currentUser?.id && isLoggedIn) {
          try {
            const postsResponse = await axios.get(`/api/user/posts`, {
              withCredentials: true
            });
            userPostsData = postsResponse.data || [];
          } catch (error) {
            console.error('Ошибка при загрузке постов для прикрепления:', error);
          }
        }
        
        setMapData({
          reviews: mapDataResponse.reviews || [],
          posts: mapDataResponse.posts || [],
          userPosts: userPostsData,
          user: mapDataResponse.user
        });
        
      } catch (error: any) {
        console.error('Ошибка загрузки карты:', error);
        setMapData({ reviews: [], posts: [], userPosts: [] });
      } finally {
        setLoading(false);
        setForceRefresh(false);
      }
    };
    
    loadMapData();
  }, [targetUserId, currentUser?.id, isLoggedIn, forceRefresh]);

  // Функция для обновления данных
  const refreshData = () => {
    setForceRefresh(true);
    setSelectedPlace(null);
    setSelectedLocation(null);
    setMode('view');
  };

  // Объединяем отзывы и посты в места
  const placesData = useMemo(() => {
    const placesMap = new Map<number, PlaceData>();
    
    mapData.reviews.forEach(review => {
      placesMap.set(review.place_id, {
        id: review.place_id,
        place_id: review.place_id,
        place_name: review.place_name,
        latitude: review.latitude,
        longitude: review.longitude,
        type: 'review',
        review: review
      });
    });
    
    mapData.posts.forEach(post => {
      const existingPlace = placesMap.get(post.place_id);
      if (existingPlace) {
        existingPlace.type = 'both';
        existingPlace.post = post;
      } else {
        placesMap.set(post.place_id, {
          id: post.place_id,
          place_id: post.place_id,
          place_name: post.place_name,
          latitude: post.latitude,
          longitude: post.longitude,
          type: 'post',
          post: post
        });
      }
    });
    
    return Array.from(placesMap.values());
  }, [mapData.reviews, mapData.posts]);

  // Доступные посты для прикрепления (только для своей карты)
  const availablePostsForAttach = useMemo(() => {
    if (!isOwnProfile || !mapData.userPosts || mapData.userPosts.length === 0) return [];
    
    const attachedPlaceIds = new Set(
      mapData.posts.map(post => post.place_id)
    );
    
    return mapData.userPosts.filter(post => {
      return !post.place_id || !attachedPlaceIds.has(post.place_id);
    });
  }, [mapData.userPosts, mapData.posts, isOwnProfile]);

  const handlePlaceSelect = (latlng: L.LatLng) => {
    if (!isOwnProfile) {
      alert('Вы можете создавать отзывы только на своей карте');
      return;
    }
    
    if (!isLoggedIn) {
      alert('Для создания отзывов необходимо войти в систему');
      return;
    }
    
    setSelectedLocation(latlng);
    setSelectedPlace(null);
    setMode('create');
    setReviewData({ 
      name: '', 
      content: '',
      rating: 5,
      latitude: latlng.lat,
      longitude: latlng.lng,
      attachPostId: ''
    });
    setSelectedPostForAttach('');
  };

  const handleCreateReview = async () => {
    if (!selectedLocation || !reviewData.name.trim()) {
      alert('Пожалуйста, выберите место на карте и введите название места');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Создаем место
      const placeResponse = await axios.post('/api/places', {
        name: reviewData.name,
        desc: '',
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      }, {
        withCredentials: true
      });
      
      const newPlace = placeResponse.data.place;
      
      // 2. Создаем отзыв
      await axios.post('/api/reviews', {
        place_id: newPlace.id,
        rating: reviewData.rating,
        content: reviewData.content,
        is_public: true
      }, {
        withCredentials: true
      });

      // 3. Если выбран пост для прикрепления, привязываем его
      if (reviewData.attachPostId) {
        await axios.put(`/api/posts/${reviewData.attachPostId}/attach-to-place`, {
          place_id: newPlace.id,
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng
        }, {
          withCredentials: true
        });
      }

      // Сбрасываем форму и обновляем данные
      setReviewData({ 
        name: '', 
        content: '', 
        rating: 5, 
        latitude: 0, 
        longitude: 0, 
        attachPostId: '' 
      });
      setSelectedLocation(null);
      setMode('view');
      
      // Обновляем данные
      refreshData();
      
    } catch (error: any) {
      console.error('Ошибка при создании:', error);
      alert(error.response?.data?.error || 'Ошибка при создании');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string, placeId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот отзыв и связанный пост?')) {
      return;
    }

    try {
      setLoading(true);
      
      // Находим пост, связанный с этим местом
      const postToDelete = mapData.posts.find(p => p.place_id === placeId);
      
      // Удаляем отзыв
      await axios.delete(`/api/reviews/${reviewId}`, {
        withCredentials: true
      });

      // Если есть пост, удаляем его
      if (postToDelete) {
        await axios.delete(`/api/posts/${postToDelete.id}`, {
          withCredentials: true
        });
      }

      // Обновляем данные
      refreshData();
      
    } catch (error: any) {
      console.error('Ошибка при удалении:', error);
      alert(error.response?.data?.error || 'Ошибка при удалении');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachPostToSelectedPlace = async () => {
    if (!selectedPlace || !selectedPostForAttach) {
      alert('Пожалуйста, выберите пост для прикрепления');
      return;
    }

    if (selectedPlace.type !== 'review') {
      alert('Можно прикреплять посты только к отзывам без публикаций');
      return;
    }

    if (!isOwnProfile) {
      alert('Вы можете прикреплять посты только на своей карте');
      return;
    }

    try {
      setLoading(true);
      
      await axios.put(`/api/posts/${selectedPostForAttach}/attach-to-place`, {
        place_id: selectedPlace.place_id,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude
      }, {
        withCredentials: true
      });

      // Обновляем данные
      refreshData();
      
    } catch (error: any) {
      console.error('Ошибка при прикреплении поста:', error);
      alert(error.response?.data?.error || 'Ошибка при прикреплении поста');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceClick = (place: PlaceData) => {
    setSelectedPlace(place);
    setSelectedLocation(null);
    setMode('view');
    setSelectedPostForAttach('');
  };

  const handleViewPost = (postId: number) => {
    navigate(`/post/${postId}`);
  };

  // Кастомный скролл для панели управления
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const controls = controlsRef.current;
      if (!controls) return;
      
      const isScrollable = controls.scrollHeight > controls.clientHeight;
      const isAtTop = controls.scrollTop === 0;
      const isAtBottom = controls.scrollTop + controls.clientHeight >= controls.scrollHeight;
      
      if (isScrollable) {
        if (!(isAtTop && e.deltaY < 0) && !(isAtBottom && e.deltaY > 0)) {
          e.preventDefault();
          controls.scrollTop += e.deltaY * 0.5;
        }
      }
    };

    const controls = controlsRef.current;
    if (controls) {
      controls.addEventListener('wheel', handleWheel, { passive: false });
      return () => controls.removeEventListener('wheel', handleWheel);
    }
  }, []);

  if (loading && !forceRefresh) {
    return (
      <div className="map-view-container">
        <div className="map-loading">
          <div>Загрузка карты...</div>
        </div>
      </div>
    );
  }

  // Выбираем иконку в зависимости от типа места
  const getIconForPlace = (place: PlaceData) => {
    switch (place.type) {
      case 'review': return reviewOnlyIcon;
      case 'post': return postOnlyIcon;
      case 'both': return reviewWithPostIcon;
      default: return reviewOnlyIcon;
    }
  };

  return (
    <div className="map-view-container">
      {/* Карта */}
      <div className="map-container">
        <MapContainer
          center={BELARUS_CENTER}
          zoom={3}
          className="leaflet-map"
          maxBounds={StrictBelarusBounds}
          minZoom={6}
          maxZoom={25}
          scrollWheelZoom={true}
          dragging={true}
          attributionControl={false}
        >
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {isOwnProfile && (
            <PlaceSelector onPlaceSelect={handlePlaceSelect} />
          )}
          
          {selectedLocation && (
            <Marker 
              position={selectedLocation}
              icon={selectedIcon}
            >
              <Popup>
                <div style={{ padding: '8px', textAlign: 'center' }}>
                  <strong style={{ color: '#696cff' }}>Новое место</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>
                    Заполните форму справа
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Отображение мест */}
          {placesData.map((place) => (
            <Marker 
              key={`place-${place.id}`} 
              position={[place.latitude, place.longitude]} 
              icon={getIconForPlace(place)}
              eventHandlers={{
                click: () => handlePlaceClick(place)
              }}
            >
              <Popup>
                <div className="marker-popup" style={{ minWidth: '240px', maxWidth: '300px' }}>
                  <div style={{ 
                    padding: '8px 12px', 
                    background: place.type === 'review' ? '#e8f5e9' : 
                               place.type === 'post' ? '#e3f2fd' : 
                               '#f3e5f5',
                    borderBottom: '1px solid #e9ecef',
                    margin: '-12px -12px 12px -12px',
                    borderTopLeftRadius: '6px',
                    borderTopRightRadius: '6px'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '15px', 
                      fontWeight: 600,
                      color: place.type === 'review' ? '#2e7d32' : 
                             place.type === 'post' ? '#1565c0' : 
                             '#7b1fa2'
                    }}>
                      {place.place_name}
                    </h4>
                    <div style={{ 
                      fontSize: '11px', 
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ 
                        background: place.type === 'review' ? '#4caf50' : 
                                   place.type === 'post' ? '#2196f3' : 
                                   '#9c27b0',
                        color: 'white',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '10px'
                      }}>
                        {place.type === 'review' ? 'Отзыв' : 
                         place.type === 'post' ? 'Публикация' : 
                         'Отзыв + Публикация'}
                      </span>
                    </div>
                  </div>
                  
                  {place.type === 'review' && place.review && (
                    <div className="review-content" style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ 
                          fontSize: '14px', 
                          color: '#ff9800',
                          marginRight: '8px' 
                        }}>
                          {'⭐'.repeat(place.review.rating)}
                        </span>
                        <span style={{ fontSize: '11px', color: '#666' }}>Рейтинг</span>
                      </div>
                      {place.review.content && (
                        <div style={{ 
                          background: '#f8f9fa', 
                          padding: '10px', 
                          borderRadius: '6px',
                          marginBottom: '10px'
                        }}>
                          <p style={{ 
                            fontSize: '13px', 
                            lineHeight: 1.4,
                            marginBottom: '0',
                            color: '#333'
                          }}>
                            {place.review.content}
                          </p>
                        </div>
                      )}
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ 
                          background: '#e0e0e0', 
                          borderRadius: '50%', 
                          width: '20px', 
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px'
                        }}>👤</span>
                        <span>{place.review.user_name}</span>
                      </div>
                    </div>
                  )}
                  
                  {place.type === 'post' && place.post && (
                    <div className="post-content" style={{ padding: '8px 0' }}>
                      <PostPreview 
                        post={place.post} 
                        onViewPost={handleViewPost}
                        compact={true}
                      />
                    </div>
                  )}
                  
                  {place.type === 'both' && (
                    <div style={{ padding: '8px 0' }}>
                      {place.review && (
                        <div style={{ 
                          background: '#e8f5e9', 
                          padding: '10px', 
                          borderRadius: '6px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ 
                              fontSize: '13px', 
                              color: '#ff9800',
                              marginRight: '8px' 
                            }}>
                              {'⭐'.repeat(place.review.rating)}
                            </span>
                            <span style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 500 }}>Отзыв</span>
                          </div>
                          {place.review.content && (
                            <p style={{ 
                              fontSize: '12px', 
                              lineHeight: 1.4,
                              color: '#333',
                              margin: 0
                            }}>
                              {place.review.content.length > 120 
                                ? place.review.content.substring(0, 120) + '...' 
                                : place.review.content}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {place.post && (
                        <div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#666', 
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span style={{ 
                              background: '#e3f2fd', 
                              borderRadius: '50%', 
                              width: '20px', 
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px'
                            }}>📝</span>
                            <span>Прикрепленная публикация:</span>
                          </div>
                          <PostPreview 
                            post={place.post} 
                            onViewPost={handleViewPost}
                            compact={true}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Панель управления */}
      <div 
        className="map-controls" 
        ref={controlsRef}
        style={{
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#696cff #f1f1f1'
        }}
      >
        <div className="controls-header">
          <h3>
            {mode === 'create' ? 'Создать отзыв' : 
             mode === 'attach' ? 'Прикрепить пост' :
             isOwnProfile ? 'Мои места' : `Места пользователя ${mapData.user?.username || ''}`}
          </h3>
          
          {isOwnProfile ? (
            <div className="mode-buttons">
              <button 
                className={`mode-button ${mode === 'view' ? 'active' : ''}`}
                onClick={() => {
                  setMode('view');
                  setSelectedPlace(null);
                  setSelectedLocation(null);
                  setSelectedPostForAttach('');
                }}
              >
                Просмотр
              </button>
              <button 
                className={`mode-button ${mode === 'create' ? 'active' : ''}`}
                onClick={() => {
                  setMode('create');
                  setSelectedLocation(null);
                  setSelectedPlace(null);
                  setSelectedPostForAttach('');
                }}
              >
                Новый отзыв
              </button>
            </div>
          ) : (
            <div className="mode-buttons">
              <button className="mode-button active">
                Просмотр
              </button>
            </div>
          )}
        </div>

        {/* Форма создания отзыва (только для своей карты) */}
        {mode === 'create' && selectedLocation && isOwnProfile && (
          <div className="create-form">
            <div className="selected-location">
              <div className="coordinates">
                <strong>Координаты:</strong> {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </div>
            </div>

            <div className="form-group">
              <label>Название места: *</label>
              <input 
                type="text"
                value={reviewData.name}
                onChange={(e) => setReviewData(prev => ({...prev, name: e.target.value}))}
                placeholder="Введите название места"
                required
              />
            </div>

            <div className="form-group">
              <label>Рейтинг: *</label>
              <select 
                value={reviewData.rating}
                onChange={(e) => setReviewData(prev => ({...prev, rating: parseInt(e.target.value)}))}
              >
                <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                <option value="4">⭐⭐⭐⭐ (4)</option>
                <option value="3">⭐⭐⭐ (3)</option>
                <option value="2">⭐⭐ (2)</option>
                <option value="1">⭐ (1)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Комментарий (отзыв):</label>
              <textarea 
                value={reviewData.content}
                onChange={(e) => setReviewData(prev => ({...prev, content: e.target.value}))}
                placeholder="Напишите ваш отзыв об этом месте..."
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>Прикрепить пост (опционально):</label>
              <select 
                value={reviewData.attachPostId || ''}
                onChange={(e) => setReviewData(prev => ({...prev, attachPostId: e.target.value}))}
              >
                <option value="">Не прикреплять пост</option>
                {availablePostsForAttach.map(post => (
                  <option key={post.id} value={post.id}>
                    {post.title} ({new Date(post.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {availablePostsForAttach.length === 0 && (
                <div className="hint">
                  У вас нет доступных постов для прикрепления
                </div>
              )}
            </div>

            <div className="action-buttons-bottom">
              <button 
                onClick={handleCreateReview}
                disabled={!reviewData.name.trim() || loading}
                className="primary-button"
              >
                {loading ? 'Создание...' : 
                 reviewData.attachPostId ? 'Создать отзыв и прикрепить пост' : 'Создать отзыв'}
              </button>
              
              <button 
                onClick={() => {
                  setMode('view');
                  setSelectedLocation(null);
                }}
                className="secondary-button"
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Детали выбранного места */}
        {mode === 'view' && selectedPlace && (
          <div className="marker-details">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px',
              paddingBottom: '10px',
              borderBottom: '1px solid #e9ecef'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: selectedPlace.type === 'review' ? '#4caf50' : 
                           selectedPlace.type === 'post' ? '#2196f3' : 
                           '#9c27b0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                {selectedPlace.type === 'review' ? '📍' : 
                 selectedPlace.type === 'post' ? '📝' : '📌'}
              </div>
              <div>
                <h4 style={{ margin: 0 }}>{selectedPlace.place_name}</h4>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  marginTop: '2px'
                }}>
                  {selectedPlace.type === 'review' ? 'Отзыв' : 
                   selectedPlace.type === 'post' ? 'Публикация' : 
                   'Отзыв с публикацией'}
                </div>
              </div>
            </div>
            
            {selectedPlace.type === 'review' && selectedPlace.review && (
              <>
                <div className="content-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <strong>Рейтинг:</strong>
                    <span style={{ fontSize: '16px', color: '#ff9800' }}>
                      {'⭐'.repeat(selectedPlace.review.rating)}
                    </span>
                  </div>
                </div>
                {selectedPlace.review.content && (
                  <div className="content-section">
                    <strong>Комментарий:</strong>
                    <p style={{ 
                      background: '#f8f9fa', 
                      padding: '12px', 
                      borderRadius: '6px',
                      marginTop: '8px'
                    }}>
                      {selectedPlace.review.content}
                    </p>
                  </div>
                )}
                {selectedPlace.review.user_name && (
                  <div className="content-section">
                    <strong>Автор:</strong>
                    <p>{selectedPlace.review.user_name}</p>
                  </div>
                )}
                
                {/* Кнопка для прикрепления поста к этому отзыву */}
                {isOwnProfile && availablePostsForAttach.length > 0 && selectedPlace.review.user_id === currentUser?.id && (
                  <div className="content-section" style={{ 
                    background: '#fff3cd', 
                    border: '1px solid #ffeaa7',
                    borderRadius: '6px',
                    padding: '12px',
                    marginTop: '15px'
                  }}>
                    <strong style={{ color: '#856404' }}>📎 Прикрепить пост к этому отзыву</strong>
                    <select 
                      value={selectedPostForAttach}
                      onChange={(e) => setSelectedPostForAttach(e.target.value)}
                      style={{ 
                        width: '100%', 
                        marginTop: '8px',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #dbdbdb'
                      }}
                    >
                      <option value="">Выберите пост...</option>
                      {availablePostsForAttach.map(post => (
                        <option key={post.id} value={post.id}>
                          {post.title}
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={handleAttachPostToSelectedPlace}
                      disabled={!selectedPostForAttach || loading}
                      className="primary-button"
                      style={{ marginTop: '10px', width: '100%' }}
                    >
                      {loading ? 'Прикрепление...' : 'Прикрепить пост'}
                    </button>
                  </div>
                )}
                
                <div className="action-buttons-bottom">
                  <button 
                    onClick={() => setSelectedPlace(null)}
                    className="secondary-button"
                  >
                    Закрыть
                  </button>
                  
                  {isOwnProfile && selectedPlace.review.user_id === currentUser?.id && (
                    <button 
                      onClick={() => handleDeleteReview(selectedPlace.review!.id, selectedPlace.place_id)}
                      className="delete-button"
                    >
                      Удалить отзыв
                    </button>
                  )}
                </div>
              </>
            )}
            
            {selectedPlace.type === 'post' && selectedPlace.post && (
              <>
                <PostPreview 
                  post={selectedPlace.post} 
                  onViewPost={handleViewPost}
                />
                
                <div className="action-buttons-bottom">
                  <button 
                    onClick={() => setSelectedPlace(null)}
                    className="secondary-button"
                  >
                    Закрыть
                  </button>
                  <button 
                    onClick={() => handleViewPost(selectedPlace.post!.id)}
                    className="primary-button"
                  >
                    Открыть пост
                  </button>
                </div>
              </>
            )}
            
            {selectedPlace.type === 'both' && (
              <>
                {selectedPlace.review && (
                  <div className="content-section">
                    <strong>Отзыв:</strong>
                    <div style={{ 
                      background: '#e8f5e9', 
                      padding: '12px', 
                      borderRadius: '6px',
                      marginTop: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '16px', color: '#ff9800' }}>
                          {'⭐'.repeat(selectedPlace.review.rating)}
                        </span>
                      </div>
                      {selectedPlace.review.content && (
                        <p>{selectedPlace.review.content}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedPlace.post && (
                  <>
                    <div className="content-section">
                      <strong>Прикрепленная публикация:</strong>
                    </div>
                    <PostPreview 
                      post={selectedPlace.post} 
                      onViewPost={handleViewPost}
                    />
                  </>
                )}
                
                <div className="action-buttons-bottom">
                  <button 
                    onClick={() => setSelectedPlace(null)}
                    className="secondary-button"
                  >
                    Закрыть
                  </button>
                  
                  {selectedPlace.post && (
                    <button 
                      onClick={() => handleViewPost(selectedPlace.post!.id)}
                      className="primary-button"
                    >
                      Открыть пост
                    </button>
                  )}
                  
                  {isOwnProfile && selectedPlace.review && selectedPlace.review.user_id === currentUser?.id && (
                    <button 
                      onClick={() => handleDeleteReview(selectedPlace.review!.id, selectedPlace.place_id)}
                      className="delete-button"
                    >
                      Удалить отзыв
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Информация для чужой карты */}
        {mode === 'view' && !selectedPlace && !selectedLocation && !isOwnProfile && (
          <div className="info-message">
            <p>Публичная карта пользователя {mapData.user?.username || ''}</p>
            <p className="small">Вы просматриваете только публичные места этого пользователя</p>
            {placesData.length === 0 && (
              <p className="small" style={{ marginTop: '10px', color: '#999' }}>
                У пользователя пока нет публичных мест
              </p>
            )}
          </div>
        )}

        {/* Инструкция для своей карты */}
        {mode === 'view' && !selectedPlace && !selectedLocation && isOwnProfile && (
          <div className="info-message">
            <p>Ваша карта мест</p>
            <p className="small">Кликните на карте, чтобы добавить новое место</p>
            {placesData.length === 0 && (
              <p className="small" style={{ marginTop: '10px', color: '#999' }}>
                У вас пока нет добавленных мест. Нажмите на карте, чтобы создать первое!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MapView;