import React from 'react';
import ContentLayout from '../components/ContentLayout.tsx';
import PostFeed from '../components/PostFeed.tsx';

const FavouritesPage: React.FC = () => {
    return (
        <ContentLayout>
            <div style={{ padding: '20px' }}>
                <h1 style={{ 
                    marginBottom: '20px', 
                    color: '#333',
                    fontSize: '24px',
                    fontWeight: '600'
                }}>
                    Закладки
                </h1>
                <PostFeed 
                    isFavourites={true}
                />
            </div>
        </ContentLayout>
    );
};

export default FavouritesPage;