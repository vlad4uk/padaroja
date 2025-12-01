// src/pages/PlaceDetailsPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface PlaceDetails {
  place: {
    id: number;
    name: string;
    desc: string;
    latitude: number;
    longitude: number;
  };
  reviews: any[];
  posts: any[];
}

const PlaceDetailsPage: React.FC = () => {
  const { placeId } = useParams<{ placeId: string }>();
  const [placeData, setPlaceData] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaceDetails();
  }, [placeId]);

  const fetchPlaceDetails = async () => {
    try {
      const response = await axios.get(`http://localhost:8080/api/map/place/${placeId}`);
      setPlaceData(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке деталей места:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка...</div>;
  }

  if (!placeData) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Место не найдено</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>{placeData.place.name}</h1>
      {placeData.place.desc && (
        <p style={{ color: '#666', marginBottom: '20px' }}>{placeData.place.desc}</p>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Отзывы */}
        <div>
          <h3>Отзывы ({placeData.reviews.length})</h3>
          {placeData.reviews.length === 0 ? (
            <p style={{ color: '#666' }}>Пока нет отзывов</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {placeData.reviews.map((review) => (
                <div key={review.id} style={{ padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{review.user_name}</strong>
                    <span>{'⭐'.repeat(review.rating)}</span>
                  </div>
                  {review.content && <p style={{ margin: '8px 0 0 0' }}>{review.content}</p>}
                  <small style={{ color: '#666' }}>
                    {new Date(review.created_at).toLocaleDateString('ru-RU')}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Публикации */}
        <div>
          <h3>Публикации ({placeData.posts.length})</h3>
          {placeData.posts.length === 0 ? (
            <p style={{ color: '#666' }}>Пока нет публикаций</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {placeData.posts.map((post) => (
                <div key={post.id} style={{ padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>{post.title}</h4>
                  {post.photos.length > 0 && (
                    <img 
                      src={post.photos[0]} 
                      alt="Preview" 
                      style={{ 
                        width: '100%', 
                        height: '100px', 
                        objectFit: 'cover',
                        borderRadius: '4px',
                        marginBottom: '8px'
                      }}
                    />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small style={{ color: '#666' }}>
                      ❤️ {post.likes_count}
                    </small>
                    <button 
                      onClick={() => window.open(`/post/${post.id}`, '_blank')}
                      style={{
                        padding: '4px 8px',
                        background: '#696cff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Читать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaceDetailsPage;