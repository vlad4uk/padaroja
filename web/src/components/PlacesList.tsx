// src/components/PlacesList.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Place {
  id: number;
  name: string;
  desc: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

const PlacesList: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/places');
      setPlaces(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке мест:', error);
      setError('Не удалось загрузить список мест');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Загрузка мест...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#ed4956' }}>
        {error}
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Пока нет созданных мест. Добавьте первое место на карте!
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Мои места</h2>
      <div style={{ display: 'grid', gap: '15px' }}>
        {places.map((place) => (
          <div 
            key={place.id}
            style={{
              padding: '20px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              background: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#262626' }}>
              {place.name}
            </h3>
            
            {place.desc && (
              <p style={{ 
                margin: '0 0 10px 0', 
                color: '#666',
                lineHeight: '1.4'
              }}>
                {place.desc}
              </p>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '14px',
              color: '#8e8e8e'
            }}>
              <span>
                Координаты: {place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}
              </span>
              <span>
                {new Date(place.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlacesList;