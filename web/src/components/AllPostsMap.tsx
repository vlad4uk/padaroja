// AllPostsMap.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { useNavigate } from 'react-router-dom';
import './AllPostsMap.css';

// Границы Беларуси - смещены левее, чтобы учесть панель справа
const BelarusBounds: L.LatLngBoundsLiteral = [[51.1, 23.0], [56.3, 32.5]];
// Смещаем центр карты левее (было 27.5667, стало 26.5)
const BELARUS_CENTER: L.LatLngTuple = [53.9, 50.0];

// Кастомная иконка для кластеров (только для кластеров с 2+ маркерами)
const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  let bgColor = '#696cff';
  let size = 40;
  
  if (count > 100) {
    bgColor = '#dc3545';
    size = 50;
  } else if (count > 10) {
    bgColor = '#ff9800';
    size = 45;
  }
  
  return L.divIcon({
    html: `<div style="
      background-color: ${bgColor};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${count > 100 ? '16px' : '14px'};
      font-weight: bold;
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      border: 2px solid white;
      transition: all 0.2s ease;
      cursor: pointer;
    ">${count}</div>`,
    className: 'marker-cluster-custom',
    iconSize: L.point(size, size, true),
  });
};

// Кастомная иконка для одиночного маркера (синий маркер)
const singleMarkerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

// Компонент для анимации к кластеру
function FlyToBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      map.flyToBounds(bounds, {
        duration: 1.2,
        padding: [50, 50],
        maxZoom: 12
      });
    }
  }, [bounds, map]);
  
  return null;
}

interface PostMarker {
  id: number;
  title: string;
  place_name: string;
  place_id: number;
  latitude: number;
  longitude: number;
  created_at: string;
  photos: string[];
  likes_count: number;
  user_id: number;
  user_name?: string;
}

interface AllPostsMapProps {
  onPlaceSelect?: (placeId: number, placeName: string, posts: PostMarker[]) => void;
}

const AllPostsMap: React.FC<AllPostsMapProps> = ({ onPlaceSelect }) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostMarker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<{ id: number; name: string; posts: PostMarker[] } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const postsMapRef = useRef<Map<number, PostMarker>>(new Map());

  useEffect(() => {
    const loadAllPosts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Загрузка постов для карты...');
        const response = await axios.get('/api/map/posts/all', {
          withCredentials: true,
          timeout: 30000
        });
        
        console.log('Ответ от API:', response.data);
        
        if (response.data && response.data.posts) {
          const postsData = response.data.posts;
          console.log(`Загружено ${postsData.length} постов`);
          
          const validPosts = postsData.filter((p: PostMarker) => 
            p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0
          );
          console.log(`Постов с координатами: ${validPosts.length}`);
          
          // Сохраняем посты в Map для быстрого доступа по ID
          validPosts.forEach((post: PostMarker) => {
            postsMapRef.current.set(post.id, post);
          });
          
          setPosts(validPosts);
        } else {
          console.warn('Нет данных о постах в ответе');
          setPosts([]);
        }
      } catch (err: any) {
        console.error('Ошибка загрузки постов:', err);
        
        let errorMessage = 'Не удалось загрузить посты';
        if (err.response) {
          if (err.response.status === 401) {
            errorMessage = 'Требуется авторизация. Пожалуйста, войдите в систему.';
          } else if (err.response.status === 404) {
            errorMessage = 'API endpoint не найден. Проверьте настройки сервера.';
          } else if (err.response.status === 500) {
            errorMessage = 'Ошибка сервера. Попробуйте позже.';
          }
        } else if (err.request) {
          errorMessage = 'Нет соединения с сервером. Проверьте подключение.';
        }
        
        setError(errorMessage);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadAllPosts();
  }, []);

  // Открыть панель с постами
  const openPostsPanel = useCallback((postsToShow: PostMarker[], bounds?: L.LatLngBounds) => {
    if (postsToShow.length === 0) return;
    
    // Анимация к границам, если они переданы
    if (bounds && mapRef.current) {
      mapRef.current.flyToBounds(bounds, {
        duration: 1.2,
        padding: [50, 50],
        maxZoom: 12
      });
    } else if (postsToShow.length === 1 && mapRef.current) {
      // Для одиночного поста анимируем к его координатам
      const post = postsToShow[0];
      mapRef.current.flyTo([post.latitude, post.longitude], 12, {
        duration: 1.2
      });
    }
    
    // Открываем панель
    const placeName = postsToShow.length === 1 
      ? postsToShow[0].place_name 
      : `Все посты (${postsToShow.length})`;
    
    const newSelectedPlace = {
      id: postsToShow.length === 1 ? postsToShow[0].place_id : 0,
      name: placeName,
      posts: postsToShow
    };
    
    console.log('🔄 Открываем панель:', newSelectedPlace);
    setSelectedPlace(newSelectedPlace);
    
    if (onPlaceSelect) {
      onPlaceSelect(newSelectedPlace.id, newSelectedPlace.name, postsToShow);
    }
  }, [onPlaceSelect]);

  // Обработчик клика по кластеру (только для кластеров с 2+ маркерами)
  const handleClusterClick = useCallback((event: any) => {
    console.log('🔵 Клик по кластеру!', event);
    
    // Получаем кластер
    const cluster = event.layer;
    
    if (!cluster) {
      console.error('Нет данных о кластере');
      return;
    }
    
    // Получаем все дочерние маркеры
    let childMarkers: L.Marker[] = [];
    
    // Пробуем разные методы получения дочерних маркеров
    if (typeof cluster.getAllChildMarkers === 'function') {
      childMarkers = cluster.getAllChildMarkers();
    } else if (typeof cluster.getChildMarkers === 'function') {
      childMarkers = cluster.getChildMarkers();
    } else if (cluster._childMarkers) {
      childMarkers = cluster._childMarkers;
    } else if (cluster._markers) {
      childMarkers = cluster._markers;
    }
    
    console.log('Маркеров в кластере:', childMarkers.length);
    
    if (childMarkers.length === 0) {
      console.warn('В кластере нет маркеров');
      return;
    }
    
    // Собираем посты из маркеров
    const postsInCluster: PostMarker[] = [];
    const processedIds = new Set<number>();
    
    childMarkers.forEach((marker: any) => {
      // Получаем ID поста из маркера
      let postId = null;
      let post = null;
      
      // Пробуем получить данные из разных мест
      if (marker.options && marker.options.postId) {
        postId = marker.options.postId;
      } else if (marker.postId) {
        postId = marker.postId;
      } else if (marker._postId) {
        postId = marker._postId;
      }
      
      // Если нашли ID, получаем пост из Map
      if (postId && postsMapRef.current.has(postId)) {
        post = postsMapRef.current.get(postId);
      }
      
      if (post && !processedIds.has(post.id)) {
        processedIds.add(post.id);
        postsInCluster.push(post);
        console.log('Найден пост:', post.id, post.title);
      }
    });
    
    console.log('📦 Уникальных постов в кластере:', postsInCluster.length);
    
    if (postsInCluster.length > 0) {
      // Получаем границы кластера
      const bounds = cluster.getBounds();
      openPostsPanel(postsInCluster, bounds);
    } else {
      console.warn('⚠️ В кластере нет постов для отображения!');
    }
  }, [openPostsPanel]);

  // Обработчик клика по одиночному маркеру
  const handleMarkerClick = useCallback((post: PostMarker) => {
    console.log('📍 Клик по одиночному маркеру:', post.id, post.title);
    openPostsPanel([post]);
  }, [openPostsPanel]);

  const handlePostClick = (postId: number) => {
    navigate(`/post/${postId}`);
  };

  const closePanel = () => {
    setSelectedPlace(null);
    if (onPlaceSelect) {
      onPlaceSelect(0, '', []);
    }
  };

  console.log('Состояние карты:', { loading, postsCount: posts.length, error });

  if (loading) {
    return (
      <div className="all-posts-map-container">
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <div>Загрузка карты...</div>
          <div className="loading-hint">Подождите, загружаются места</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="all-posts-map-container">
        <div className="map-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Повторить загрузку
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="all-posts-map-container">
        <div className="map-empty">
          <div className="empty-icon">📍</div>
          <div className="empty-message">Нет постов для отображения</div>
          <div className="empty-hint">Создайте первый пост, чтобы он появился на карте</div>
          <button 
            className="create-post-button"
            onClick={() => navigate('/post/new')}
          >
            Создать пост
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="all-posts-map-container">
      <div className="map-container">
        <MapContainer
          center={BELARUS_CENTER}
          zoom={7}
          className="leaflet-map"
          maxBounds={BelarusBounds}
          maxBoundsViscosity={1.0}
          minZoom={6}
          maxZoom={18}
          scrollWheelZoom={true}
          dragging={true}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef as any}
        >
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={80}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={true}
            zoomToBoundsOnClick={true}
            disableClusteringAtZoom={16}
            removeOutsideVisibleBounds={true}
            animate={true}
            animateAddingMarkers={true}
            iconCreateFunction={createClusterCustomIcon}
            eventHandlers={{
              clusterclick: handleClusterClick
            }}
          >
            {posts.map((post) => (
              <Marker 
                key={`post-${post.id}`} 
                position={[post.latitude, post.longitude]}
                icon={singleMarkerIcon}
                postId={post.id}
                options={{ postId: post.id }}
                eventHandlers={{
                  click: () => handleMarkerClick(post)
                }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {selectedPlace && selectedPlace.posts.length > 0 && (
        <div className="map-posts-panel-side">
          <div className="panel-header-side">
            <div className="panel-header-info">
              <h3>{selectedPlace.name}</h3>
              <p>{selectedPlace.posts.length} {selectedPlace.posts.length === 1 ? 'публикация' : 'публикаций'}</p>
            </div>
            <button className="close-panel-side" onClick={closePanel}>
              ✕
            </button>
          </div>
          <div className="panel-posts-side">
            {selectedPlace.posts.map((post) => (
              <div 
                key={post.id} 
                className="place-post-card-side"
                onClick={() => handlePostClick(post.id)}
              >
                <div className="post-card-image-side">
                  {post.photos && post.photos.length > 0 ? (
                    <>
                      <img src={post.photos[0]} alt={post.title} />
                      {post.photos.length > 1 && (
                        <span className="photo-count-side">+{post.photos.length}</span>
                      )}
                    </>
                  ) : (
                    <div className="no-photo-placeholder-side">📷</div>
                  )}
                </div>
                
                <div className="post-card-content-side">
                  <h4>{post.title}</h4>
                  <div className="post-card-meta-side">
                    <span className="author">{post.user_name || 'Аноним'}</span>
                    <span className="date">{new Date(post.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="post-card-likes-side">
                    <span className="likes">❤️ {post.likes_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllPostsMap;