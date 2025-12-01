// src/components/MapView.tsx
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useState, useEffect } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext.tsx';

// ==========================================================
// ФИКС ИКОНОК LEAFLET
// ==========================================================
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
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

// Кастомные иконки для разных типов точек
const reviewIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const postIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

interface MapData {
  reviews: ReviewMarker[];
  posts: PostMarker[];
}

interface ReviewMarker {
  id: string;
  place_id: number;
  rating: number;
  content: string;
  created_at: string;
  place_name: string;
  latitude: number;
  longitude: number;
  user_name: string;
  user_avatar: string;
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
}

interface NewPlaceData {
  name: string;
  desc: string;
  latitude: number;
  longitude: number;
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

const MapView: React.FC = () => {
  const { user } = useAuth();
  const [mapData, setMapData] = useState<MapData>({ reviews: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<L.LatLng | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<{type: 'review' | 'post', data: any} | null>(null);
  
  // Данные формы
  const [placeData, setPlaceData] = useState({
    name: '',
    desc: ''
  });
  
  const [reviewData, setReviewData] = useState({
    rating: 5,
    content: ''
  });

  // Загрузка данных для карты
  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/map/user-data', {
        withCredentials: true
      });
      setMapData(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке данных карты:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSelect = (latlng: L.LatLng) => {
    setSelectedLocation(latlng);
    setSelectedMarker(null);
    // Сбрасываем форму при выборе нового места
    setPlaceData({ name: '', desc: '' });
    setReviewData({ rating: 5, content: '' });
  };

  const handleAddReview = async () => {
    if (!selectedLocation || !placeData.name.trim()) {
      alert('Пожалуйста, выберите место на карте и введите название места');
      return;
    }

    try {
      // Создаем место
      const placeResponse = await axios.post('http://localhost:8080/api/places', {
        name: placeData.name,
        desc: placeData.desc,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      }, {
        withCredentials: true
      });
      
      const newPlace = placeResponse.data.place;
      
      // Добавляем отзыв
      await axios.post('http://localhost:8080/api/reviews', {
        place_id: newPlace.id,
        rating: reviewData.rating,
        content: reviewData.content,
        is_public: true
      }, {
        withCredentials: true
      });

      // Сбрасываем форму
      setPlaceData({ name: '', desc: '' });
      setReviewData({ rating: 5, content: '' });
      setSelectedLocation(null);
      
      // Обновляем данные карты
      fetchMapData();
      alert('Отзыв успешно добавлен!');
    } catch (error: any) {
      console.error('Ошибка при добавлении отзыва:', error);
      if (error.response?.data?.error) {
        alert(`Ошибка: ${error.response.data.error}`);
      } else {
        alert('Ошибка при добавлении отзыва');
      }
    }
  };

  const handleAddPost = async () => {
    if (!selectedLocation || !placeData.name.trim()) {
      alert('Пожалуйста, выберите место на карте и введите название места');
      return;
    }

    try {
      // Создаем место
      const placeResponse = await axios.post('http://localhost:8080/api/places', {
        name: placeData.name,
        desc: placeData.desc,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
      }, {
        withCredentials: true
      });
      
      const newPlace = placeResponse.data.place;
      
      // Заглушка для создания поста
      alert(`Функция создания поста в разработке. Место "${placeData.name}" создано с ID: ${newPlace.id}`);
      
      // Сбрасываем форму
      setPlaceData({ name: '', desc: '' });
      setSelectedLocation(null);
      
      // Обновляем данные карты
      fetchMapData();
    } catch (error: any) {
      console.error('Ошибка при создании места:', error);
      if (error.response?.data?.error) {
        alert(`Ошибка: ${error.response.data.error}`);
      } else {
        alert('Ошибка при создании места');
      }
    }
  };

  const handleMarkerClick = (type: 'review' | 'post', data: any) => {
    setSelectedMarker({ type, data });
    setSelectedLocation(null);
  };

  if (loading) {
    return (
      <div style={{ 
        height: '70vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div>Загрузка карты...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: '70vh', 
      width: '100%', 
      minHeight: '400px',
      gap: '20px'
    }}>
      {/* Карта */}
      <div style={{ 
        flex: 1, 
        height: '100%', 
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <MapContainer
          center={BELARUS_CENTER}
          zoom={7}
          style={{ height: '100%', borderRadius: '8px' }}
          maxBounds={StrictBelarusBounds}
          minZoom={6}
          maxZoom={20}
          scrollWheelZoom={true}
          dragging={true}
          attributionControl={false}
        >
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Компонент для выбора мест */}
          <PlaceSelector onPlaceSelect={handlePlaceSelect} />
          
          {/* Маркер выбранного места */}
          {selectedLocation && (
            <Marker 
              position={selectedLocation}
            />
          )}
          
          {/* Отображение отзывов */}
          {mapData.reviews.map((review) => (
            <Marker 
              key={`review-${review.id}`} 
              position={[review.latitude, review.longitude]} 
              icon={reviewIcon}
              eventHandlers={{
                click: () => handleMarkerClick('review', review)
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>{review.place_name}</h4>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Оценка:</strong> {'⭐'.repeat(review.rating)}
                  </div>
                  {review.content && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Отзыв:</strong> {review.content}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Отображение постов */}
          {mapData.posts.map((post) => (
            <Marker 
              key={`post-${post.id}`} 
              position={[post.latitude, post.longitude]} 
              icon={postIcon}
              eventHandlers={{
                click: () => handleMarkerClick('post', post)
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>{post.title}</h4>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Место:</strong> {post.place_name}
                  </div>
                  {post.photos.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <img 
                        src={post.photos[0]} 
                        alt="Preview" 
                        style={{ 
                          width: '100%', 
                          height: '100px', 
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    ❤️ {post.likes_count} лайков
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {new Date(post.created_at).toLocaleDateString()}
                  </div>
                  <button 
                    onClick={() => window.open(`/post/${post.id}`, '_blank')}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      background: '#696cff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Читать пост
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Форма справа */}
      <div style={{
        width: '350px',
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#262626' }}>
          {selectedLocation ? 'Добавить место' : 
           selectedMarker ? 'Просмотр' : 'Выберите место на карте'}
        </h3>

        {/* Форма для нового места */}
        {selectedLocation && (
          <div>
            <div style={{ 
              padding: '15px', 
              background: '#f8f9fa', 
              borderRadius: '6px',
              marginBottom: '15px'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <strong>Координаты:</strong> {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Кликните в другое место на карте чтобы изменить позицию
              </div>
            </div>

            {/* Форма места */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Название места: *
                </label>
                <input 
                  type="text"
                  value={placeData.name}
                  onChange={(e) => setPlaceData(prev => ({...prev, name: e.target.value}))}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #dbdbdb',
                    borderRadius: '4px'
                  }}
                  placeholder="Введите название места"
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Описание (необязательно):
                </label>
                <textarea 
                  value={placeData.desc}
                  onChange={(e) => setPlaceData(prev => ({...prev, desc: e.target.value}))}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #dbdbdb',
                    borderRadius: '4px',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                  placeholder="Краткое описание места"
                />
              </div>
            </div>

            {/* Форма отзыва */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Добавить отзыв</h4>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Оценка:
                </label>
                <select 
                  value={reviewData.rating}
                  onChange={(e) => setReviewData(prev => ({...prev, rating: parseInt(e.target.value)}))}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #dbdbdb',
                    borderRadius: '4px'
                  }}
                >
                  <option value="5">5 - Отлично</option>
                  <option value="4">4 - Хорошо</option>
                  <option value="3">3 - Нормально</option>
                  <option value="2">2 - Плохо</option>
                  <option value="1">1 - Ужасно</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Комментарий:
                </label>
                <textarea 
                  value={reviewData.content}
                  onChange={(e) => setReviewData(prev => ({...prev, content: e.target.value}))}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #dbdbdb',
                    borderRadius: '4px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Расскажите о вашем опыте..."
                />
              </div>

              <button 
                onClick={handleAddReview}
                disabled={!placeData.name.trim()}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: !placeData.name.trim() ? '#ccc' : '#696cff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !placeData.name.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  marginBottom: '10px'
                }}
              >
                Добавить отзыв
              </button>
            </div>

            {/* Кнопка для поста */}
            <div>
              <button 
                onClick={handleAddPost}
                disabled={!placeData.name.trim()}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: !placeData.name.trim() ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !placeData.name.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                Создать пост
              </button>
            </div>
          </div>
        )}

        {/* Просмотр выбранного маркера */}
        {selectedMarker && (
          <div>
            {selectedMarker.type === 'review' ? (
              <div>
                <h4 style={{ margin: '0 0 10px 0' }}>Отзыв</h4>
                <div style={{ 
                  padding: '15px', 
                  background: '#f8f9fa', 
                  borderRadius: '6px',
                  marginBottom: '15px'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Место:</strong> {selectedMarker.data.place_name}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Оценка:</strong> {'⭐'.repeat(selectedMarker.data.rating)}
                  </div>
                  {selectedMarker.data.content && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Отзыв:</strong> {selectedMarker.data.content}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(selectedMarker.data.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h4 style={{ margin: '0 0 10px 0' }}>Публикация</h4>
                <div style={{ 
                  padding: '15px', 
                  background: '#f8f9fa', 
                  borderRadius: '6px',
                  marginBottom: '15px'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Название:</strong> {selectedMarker.data.title}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Место:</strong> {selectedMarker.data.place_name}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Лайков:</strong> ❤️ {selectedMarker.data.likes_count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                    {new Date(selectedMarker.data.created_at).toLocaleDateString()}
                  </div>
                  <button 
                    onClick={() => window.open(`/post/${selectedMarker.data.id}`, '_blank')}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#696cff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Открыть публикацию
                  </button>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setSelectedMarker(null)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Закрыть
            </button>
          </div>
        )}

        {/* Инструкция когда ничего не выбрано */}
        {!selectedLocation && !selectedMarker && (
          <div style={{ 
            padding: '20px', 
            background: '#eef1ff', 
            borderRadius: '6px',
            textAlign: 'center',
            color: '#696cff'
          }}>
            <p style={{ margin: '0 0 10px 0' }}>
              <strong>Как добавить место:</strong>
            </p>
            <p style={{ margin: '0', fontSize: '14px' }}>
              Кликните на карте в нужном месте, затем заполните форму справа.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MapView;