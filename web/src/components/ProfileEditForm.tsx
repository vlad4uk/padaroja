import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.tsx';
import avatar from '../assets/bird04.png';

import { uploadImage } from '../firebase/uploadImage.js'; 

const DEFAULT_AVATAR = avatar;

const ProfileEditForm: React.FC = () => {
    const { user, checkAuth } = useAuth();

    const [username, setUsername] = useState(user?.username || '');
    const [bio, setBio] = useState(user?.bio || '');
    
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState(
        user?.image_url 
            ? (user.image_url.startsWith('http') ? user.image_url : `${user.image_url}`)
            : DEFAULT_AVATAR
    );
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
            setSuccess(''); 
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            let firebaseUrl = ''; 

            if (avatarFile) {
                setSuccess('Загрузка фото...'); 
                
                const newUrl = await uploadImage(avatarFile);
                firebaseUrl = newUrl;
            }

            const formData = new FormData();
            formData.append('username', username);
            formData.append('bio', bio);

            if (firebaseUrl) {
                formData.append('image_url', firebaseUrl);
            }
            
            await axios.put(
                '/api/user/profile',
                formData,
                { withCredentials: true }
            );
            
            setSuccess('Профиль успешно обновлен!');
            await checkAuth(); 

        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                if (err.response.status === 409) {
                     setError(err.response.data.error || 'Этот логин уже занят');
                } else {
                     setError(err.response.data.error || 'Ошибка обновления');
                }
            } else {
                setError('Не удалось подключиться к серверу');
            }
        } finally {
            setLoading(false);
        }
    };

return (
    <div className="profile-edit-form-container">
        <form onSubmit={handleSubmit}>
            
            {/* Секция Аватара */}
            <div className="edit-avatar-section">
                <div className="edit-user-avatar">
                    <img 
                        src={avatarPreview} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>
                <span className="edit-username-placeholder">
                    {user?.username || 'Ваш логин'}
                </span>
                <input 
                    type="file" 
                    id="avatar-upload" 
                    accept="image/png, image/jpeg"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <label htmlFor="avatar-upload" className="change-photo-button">
                    Изменить Фото
                </label>
            </div>

            {/* Поле Username */}
            <div className="edit-field-group">
                <label htmlFor="username" className="edit-label">Username</label>
                <input
                    type="text"
                    id="username"
                    className="edit-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Введите имя пользователя"
                />
            </div>

            {/* Поле Bio */}
            <div className="edit-field-group">
                <label htmlFor="bio" className="edit-label">Описание</label>
                <div style={{ flex: 1 }}>
                    <input
                        type="text"
                        id="bio"
                        className="edit-input"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={150}
                        placeholder="Расскажите о себе..."
                    />
                    <p className="bio-counter">{bio.length} / 150</p>
                </div>
            </div>
            
            {/* Сообщения об ошибках и успехе */}
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <div className="edit-actions">
                <button type="submit" className="save-button" disabled={loading}>
                    {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
            </div>
        </form>
    </div>
);
};

export default ProfileEditForm;