import React, { useState } from 'react';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout.tsx';
import SocialButtons from '../components/SocialButtons.tsx';
import FriendsFront from '../assets/FrontFriends.jpg';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; // Импортируем useAuth

// Базовый URL Go-бэкенда
const API_BASE_URL = 'http://localhost:8080/api/auth'; 

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  // 💡 1. Получаем функцию login из контекста
  const { login } = useAuth(); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // КЛЮЧЕВОЙ ЗАПРОС С withCredentials: true
      const response = await axios.post(
        `${API_BASE_URL}/login`,
        {
          email: email,
          password: password,
        },
        {
          // ОБЯЗАТЕЛЬНО для отправки куки на Go-бэкенд и получения куки в ответ
          withCredentials: true, 
        }
      );

      // В случае успеха:
      console.log('Login successful:', response.data);
      
      // 💡 2. Вызываем login, чтобы обновить состояние React-контекста
      login(response.data); 

      alert(`Вход успешен! Добро пожаловать, ${response.data.user.username}`);
      
      // 💡 3. Переходим на страницу профиля
      navigate('/profile');

    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        // Предполагаем, что Go-бэкенд возвращает ошибку в формате { "error": "..." }
        setError(err.response.data.error || 'Login failed');
      } else {
        setError('An unexpected error occurred. Check server connection.');
      }
    } finally {
      // Это выполнится в любом случае (успех или ошибка)
      setLoading(false);
    }
  };

  return (
    <AuthLayout image={FriendsFront}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#3f4254' }}>Вход</h1>

      <SocialButtons />

      <div className="divider" style={{ margin: '20px 0' }}>
        <span style={{ fontSize: '0.9rem', color: '#a0a0a0' }}>ИЛИ</span>
      </div>
      
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        {/* Поле Email/Username */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email" style={{ fontWeight: 600, fontSize: '0.875rem', color: '#3f4254', display: 'block', marginBottom: '4px' }}>
            Email или Имя пользователя
          </label>
          <input 
            type="text" 
            id="email" 
            className="form-input" 
            placeholder="john.doe@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Поле Password */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="password" style={{ fontWeight: 600, fontSize: '0.875rem', color: '#3f4254', display: 'block', marginBottom: '4px' }}>
              Пароль
            </label>
            <a href="/forgot-password" style={{ fontSize: '0.8125rem', color: '#696cff', textDecoration: 'none' }}>Забыли пароль?</a>
          </div>
          <input 
            type="password" 
            id="password" 
            className="form-input" 
            placeholder="············"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Checkbox "Remember me" */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <label style={{ fontSize: '0.875rem', color: '#3f4254', display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" style={{ marginRight: '8px' }} />
            Запомнить меня
          </label>
        </div>
        
        {/* Отображение ошибки */}
        {error && <p style={{ color: 'red', textAlign: 'center', fontSize: '0.875rem', marginBottom: '10px' }}>{error}</p>}


        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Logging In...' : 'Авторизоваться'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '20px' }}>
         Впервые на нашей платформе? <a href="/register" style={{ color: '#696cff', textDecoration: 'none', fontWeight: 500 }}>Создайте аккаунт</a>
      </p>
    </AuthLayout>
  );
};

export default LoginPage;