import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
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
const BelarusBounds: L.LatLngBoundsLiteral = [[51.1, 23.0], [56.3, 32.5]];
const BELARUS_CENTER: L.LatLngTuple = [53.9, 27.5667];

// Кастомные иконки для постов (только синие)
const postIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// ==========================================================
// КОМПОНЕНТ ДЛЯ ПЛАВНОГО ПЕРЕЛЕТА К МАРКЕРУ
// ==========================================================
function FlyToMarker({ position }: { position: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, 10, {
        duration: 1.2,
      });
    }
  }, [position, map]);
  
  return null;
}

interface MapViewProps {
  targetUserId?: number;
}

interface MapData {
  posts: PostMarker[];
  user?: {
    id: number;
    username: string;
    avatar: string;
  };
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

// Компонент превью поста с фото
interface PostPreviewProps {
  post: PostMarker;
  onViewPost: (postId: number) => void;
}

const PostPreview: React.FC<PostPreviewProps> = ({ post, onViewPost }) => {
  const hasPhoto = post.photos && post.photos.length > 0;
  const previewText = post.title.length > 100 ? post.title.substring(0, 100) + '...' : post.title;

  return (
    <div 
      className="post-preview" 
      onClick={() => onViewPost(post.id)}
      style={{
        cursor: 'pointer',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        border: '1px solid #e5e5e5',
        background: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        width: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
        e.currentTarget.style.borderColor = '#696cff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
        e.currentTarget.style.borderColor = '#e5e5e5';
      }}
    >
      {hasPhoto && (
        <div 
          style={{
            height: '160px',
            overflow: 'hidden',
            position: 'relative',
            background: '#f5f5f5'
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
          {post.photos.length > 1 && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '20px',
              backdropFilter: 'blur(4px)'
            }}>
              +{post.photos.length - 1}
            </div>
          )}
        </div>
      )}
      <div style={{
        padding: '16px'
      }}>
        <div style={{
          fontWeight: 600,
          fontSize: '16px',
          marginBottom: '8px',
          color: '#262626',
          lineHeight: 1.4
        }}>
          {previewText}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: '#666'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ff4757' }}>❤️</span>
            <span>{post.likes_count || 0}</span>
          </span>
          <span style={{ 
            fontSize: '12px',
            background: '#f8f9fa',
            padding: '4px 10px',
            borderRadius: '20px',
            border: '1px solid #e9ecef'
          }}>
            {new Date(post.created_at).toLocaleDateString('ru-RU', { 
              day: 'numeric', 
              month: 'long',
              year: 'numeric'
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
    posts: []
  });
  
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPost, setSelectedPost] = useState<PostMarker | null>(null);
  const [flyToPosition, setFlyToPosition] = useState<[number, number] | null>(null);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);

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
        
        if (targetUserId) {
          endpoint = `/api/map/user/${targetUserId}/data`;
          config = { withCredentials: false };
        } else if (isLoggedIn && currentUser) {
          endpoint = `/api/map/user-data`;
          config = { withCredentials: true };
        } else {
          setLoading(false);
          return;
        }
        
        const mapResponse = await axios.get(endpoint, config);
        const mapDataResponse = mapResponse.data;
        
        setMapData({
          posts: mapDataResponse.posts || [],
          user: mapDataResponse.user
        });
        
      } catch (error: any) {
        console.error('Ошибка загрузки карты:', error);
        setMapData({ posts: [] });
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
    setSelectedPost(null);
    setFlyToPosition(null);
  };

  const handlePostClick = (post: PostMarker) => {
    setSelectedPost(post);
    setFlyToPosition([post.latitude, post.longitude]);
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

  return (
    <div className="map-view-container">
      {/* Карта */}
      <div className="map-container">
        <MapContainer
          center={BELARUS_CENTER}
          zoom={6}
          className="leaflet-map"
          maxBounds={BelarusBounds}
          maxBoundsViscosity={1.0}
          minZoom={6}
          maxZoom={18}
          scrollWheelZoom={true}
          dragging={true}
          attributionControl={false}
        >
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Компонент для плавного перелета к маркеру */}
          <FlyToMarker position={flyToPosition} />
          
          {/* Отображение постов */}
          {mapData.posts.map((post) => (
            <Marker 
              key={`post-${post.id}`} 
              position={[post.latitude, post.longitude]} 
              icon={postIcon}
              eventHandlers={{
                click: () => handlePostClick(post)
              }}
            >
              {/* Минимальный попап только с названием */}
              <Popup closeButton={false} autoPan={false} offset={[0, -20]}>
                <div style={{ 
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#1565c0',
                  whiteSpace: 'nowrap',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {post.place_name}
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
            {selectedPost ? 'Публикация' : 
             isOwnProfile ? 'Мои публикации' : `Публикации ${mapData.user?.username || ''}`}
          </h3>
        </div>

        {/* Детали выбранного поста */}
        {selectedPost ? (
          <div className="marker-details">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '1px solid #e9ecef'
            }}>
              <div style={{
                width: '45px',
                height: '45px',
                borderRadius: '50%',
                background: '#2196f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
              }}>
                📝
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '18px' }}>{selectedPost.place_name}</h4>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#666',
                  marginTop: '4px'
                }}>
                  {new Date(selectedPost.created_at).toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
            
            <PostPreview 
              post={selectedPost} 
              onViewPost={handleViewPost}
            />
            
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginTop: '20px'
            }}>
              <button 
                onClick={() => {
                  setSelectedPost(null);
                  setFlyToPosition(null);
                }}
                className="secondary-button"
                style={{ flex: 1 }}
              >
                Закрыть
              </button>
              <button 
                onClick={() => handleViewPost(selectedPost.id)}
                className="primary-button"
                style={{ flex: 1 }}
              >
                Читать полностью
              </button>
            </div>
          </div>
        ) : (
          /* Информация, когда ничего не выбрано */
          <div className="info-message">
            {isOwnProfile ? (
              <>
                <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '10px' }}>
                  Ваши публикации на карте
                </p>
                <p className="small" style={{ color: '#666', lineHeight: 1.6 }}>
                  Здесь отображаются все ваши посты, привязанные к населенным пунктам. 
                  Всего публикаций: <strong>{mapData.posts.length}</strong>
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '10px' }}>
                  Публикации пользователя {mapData.user?.username || ''}
                </p>
                <p className="small" style={{ color: '#666', lineHeight: 1.6 }}>
                  Всего публикаций: <strong>{mapData.posts.length}</strong>
                </p>
              </>
            )}
            
            {mapData.posts.length === 0 && (
              <p className="small" style={{ 
                marginTop: '20px', 
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#999'
              }}>
                {isOwnProfile 
                  ? 'У вас пока нет публикаций. Создайте пост, выбрав населенный пункт, и он появится на карте!' 
                  : 'У пользователя пока нет публикаций'}
              </p>
            )}

            {mapData.posts.length > 0 && (
              <div style={{ 
                marginTop: '20px',
                padding: '15px',
                background: '#e3f2fd',
                borderRadius: '8px',
                border: '1px solid #bbdefb'
              }}>
                <p className="small" style={{ color: '#1565c0', margin: 0 }}>
                  💡 Кликните на синий маркер на карте, чтобы увидеть детали публикации
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MapView;