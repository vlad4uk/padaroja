import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
  photos: Array<{ url: string }> | string[];
  likes_count: number;
  user_id: number;
  user_name?: string;
}

// Компонент превью поста с фото
interface PostPreviewProps {
  post: PostMarker;
  onViewPost: (postId: number) => void;
}

const PostPreview: React.FC<PostPreviewProps> = ({ post, onViewPost }) => {
  const getPhotoUrls = (photos: any): string[] => {
    if (!photos || !Array.isArray(photos)) return [];
    
    return photos.map(photo => {
      if (photo && typeof photo === 'object' && 'url' in photo) {
        return photo.url;
      }
      if (typeof photo === 'string') {
        return photo;
      }
      return '';
    }).filter(url => url && url.trim() !== '');
  };

  const photoUrls = getPhotoUrls(post.photos);
  const hasPhoto = photoUrls.length > 0;
  const previewText = post.title.length > 100 ? post.title.substring(0, 100) + '...' : post.title;

  return (
    <div 
      className="post-preview" 
      onClick={() => onViewPost(post.id)}
    >
      {hasPhoto ? (
        <div className="post-preview-image">
          <img 
            src={photoUrls[0]} 
            alt={post.title}
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = '<div class="post-preview-placeholder">📷</div>';
              }
            }}
          />
          {photoUrls.length > 1 && (
            <div className="post-preview-counter">
              +{photoUrls.length - 1}
            </div>
          )}
        </div>
      ) : (
        <div className="post-preview-placeholder">
          📷
        </div>
      )}
      <div className="post-preview-content">
        <div className="post-preview-title">
          {previewText}
        </div>
        <div className="post-preview-stats">
          <span className="post-preview-likes">
            <span>❤️</span>
            <span>{post.likes_count || 0}</span>
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

  const isOwnProfile = useMemo(() => {
    if (!targetUserId && currentUser && isLoggedIn) return true;
    if (targetUserId && currentUser) return targetUserId === currentUser.id;
    return false;
  }, [targetUserId, currentUser, isLoggedIn]);

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

  const handlePostClick = (post: PostMarker) => {
    setSelectedPost(post);
    setFlyToPosition([post.latitude, post.longitude]);
  };

  const handleViewPost = (postId: number) => {
    navigate(`/post/${postId}`);
  };

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
          
          <FlyToMarker position={flyToPosition} />
          
          {mapData.posts.map((post) => (
            <Marker 
              key={`post-${post.id}`} 
              position={[post.latitude, post.longitude]} 
              icon={postIcon}
              eventHandlers={{
                click: () => handlePostClick(post)
              }}
            >
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

      <div 
        className="map-controls" 
        ref={controlsRef}
        style={{
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#696cff #f1f1f1',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="controls-header">
          <h3>
            {selectedPost ? 'Публикация' : 
             isOwnProfile ? 'Мои публикации' : `Публикации ${mapData.user?.username || ''}`}
          </h3>
        </div>

        {selectedPost ? (
          <div className="marker-details">
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#262626' }}>
                {selectedPost.place_name}
              </h4>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {new Date(selectedPost.created_at).toLocaleDateString('ru-RU', { 
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
            
            <PostPreview 
              post={selectedPost} 
              onViewPost={handleViewPost}
            />
          </div>
        ) : (
          <div className="info-message">
            {isOwnProfile ? (
              <>
                <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '10px' }}>
                  Ваши публикации на карте
                </p>
                <p className="small">
                  Здесь отображаются все ваши посты, привязанные к населенным пунктам. 
                  Всего публикаций: <strong>{mapData.posts.length}</strong>
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '10px' }}>
                  Публикации пользователя {mapData.user?.username || ''}
                </p>
                <p className="small">
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
                  Кликните на синий маркер на карте, чтобы увидеть публикацию
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