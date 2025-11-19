import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaCalendarAlt } from 'react-icons/fa';

interface PostDTO {
    id: string;
    title: string;
    created_at: string; // ISO string
    main_photo_url: string;
}

const API_USER_POSTS = 'http://localhost:8080/api/user/posts';

const UserPostsList: React.FC = () => {
    const [posts, setPosts] = useState<PostDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUserPosts = async () => {
            try {
                // Защищенный маршрут требует withCredentials: true
                const response = await axios.get<PostDTO[]>(API_USER_POSTS, {
                    withCredentials: true, 
                });
                setPosts(response.data);
            } catch (err) {
                console.error("Ошибка при получении постов:", err);
                setError('Не удалось загрузить публикации. Попробуйте снова.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserPosts();
    }, []);

    if (isLoading) {
        return <div style={{ textAlign: 'center', padding: '20px' }}>Загрузка публикаций...</div>;
    }

    if (error) {
        return <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</div>;
    }

    if (posts.length === 0) {
        return <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>У вас пока нет ни одной публикации.</div>;
    }
    
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="posts-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '20px', 
            padding: '20px 0' 
        }}>
            {posts.map(post => (
                <div key={post.id} className="post-card" style={{ 
                    border: '1px solid #eee', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    boxShadow: '0 4px 8px rgba(0,0,0,0.05)', 
                    cursor: 'pointer',
                    transition: 'box-shadow 0.3s'
                }}>
                    <img 
                        src={post.main_photo_url || 'https://via.placeholder.com/300x200?text=Нет+Фото'} 
                        alt={post.title} 
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
                    />
                    <div style={{ padding: '15px' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#333' }}>{post.title}</h3>
                        <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
                            <FaCalendarAlt style={{ marginRight: '5px', verticalAlign: 'middle' }} /> 
                            Опубликовано: {formatDate(post.created_at)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserPostsList;