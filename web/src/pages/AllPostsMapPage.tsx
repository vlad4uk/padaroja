// AllPostsMapPage.tsx
import React, { useState } from 'react';
import ContentLayout from '../components/ContentLayout.tsx';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import AllPostsMap from '../components/AllPostsMap.tsx';
import './AllPostsMapPage.css';

interface PostData {
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

const AllPostsMapPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPlace, setSelectedPlace] = useState<{
    id: number;
    name: string;
    posts: PostData[];
  } | null>(null);

  const handlePlaceSelect = (placeId: number, placeName: string, posts: PostData[]) => {
    setSelectedPlace({ id: placeId, name: placeName, posts });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <ContentLayout>
      <div className="map-page-container-full">
        {/* Шапка страницы */}
        <div className="map-page-header-full">
          <button onClick={handleGoBack} className="back-button-full">
            <FaArrowLeft />
            Назад
          </button>
          <div className="header-text-full">
            <h1>Карта публикаций</h1>
          </div>
        </div>

        {/* Карта на всю оставшуюся высоту */}
        <div className="map-wrapper-full">
          <AllPostsMap onPlaceSelect={handlePlaceSelect} />
        </div>
      </div>
    </ContentLayout>
  );
};

export default AllPostsMapPage;