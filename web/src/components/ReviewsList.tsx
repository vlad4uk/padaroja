// src/components/ReviewsList.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Review {
  id: string;
  user_id: number;
  place_id: number;
  rating: number;
  content: string;
  is_public: boolean;
  created_at: string;
  user_name: string;
  user_avatar: string;
  place_name: string;
}

interface ReviewsListProps {
  userId?: number;
}

const ReviewsList: React.FC<ReviewsListProps> = ({ userId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  const fetchReviews = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/reviews/user', {
        withCredentials: true
      });
      setReviews(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке отзывов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Удалить этот отзыв?')) return;

    try {
      await axios.delete(`http://localhost:8080/api/reviews/${reviewId}`, {
        withCredentials: true
      });
      setReviews(reviews.filter(review => review.id !== reviewId));
      alert('Отзыв удален');
    } catch (error) {
      console.error('Ошибка при удалении отзыва:', error);
      alert('Ошибка при удалении отзыва');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка отзывов...</div>;
  }

  if (reviews.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        У вас пока нет отзывов. Добавьте первый отзыв на карте!
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '20px' }}>Мои отзывы</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {reviews.map((review) => (
          <div 
            key={review.id}
            style={{
              padding: '15px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              background: 'white'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
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
                  {new Date(review.created_at).toLocaleDateString('ru-RU')}
                  {!review.is_public && ' • 🔒 Приватный'}
                </div>
              </div>
              <button 
                onClick={() => handleDeleteReview(review.id)}
                style={{
                  padding: '5px 10px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewsList;