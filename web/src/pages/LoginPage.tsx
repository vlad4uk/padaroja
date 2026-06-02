// pages/LoginPage.tsx
import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast'; // Импортируем toast
import AuthLayout from '../components/AuthLayout.tsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; 
import AuthIllustration from '../components/AuthIllustration.tsx';
import loginImage from '../assets/stork.png';

const API_BASE_URL = '/api/auth'; 

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Клиентская валидация с всплывающими сообщениями
    if (!email.trim()) {
      toast.error('Пожалуйста, введите email или имя пользователя');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      toast.error('Пожалуйста, введите пароль');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/login`,
        {
          email: email,
          password: password,
        },
        {
          withCredentials: true, 
        }
      );

      console.log('Login successful:', response.data);
      
      login(response.data); 
      
      // Успешный вход
      toast.success(`Добро пожаловать, ${response.data.user.username}!`);
      
      navigate('/profile');

    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const errorMessage = err.response.data.error;
        
        // Понятные сообщения об ошибках
        if (errorMessage.includes('не найден')) {
          toast.error('Пользователь с таким email или именем не найден');
        } else if (errorMessage.includes('заблокирован')) {
          toast.error('Ваш аккаунт был заблокирован. Обратитесь к администратору');
        } else if (errorMessage.includes('Password incorrect')) {
          toast.error('Неверный пароль. Попробуйте еще раз');
        } else {
          toast.error(errorMessage || 'Ошибка входа. Проверьте введенные данные');
        }
      } else {
        toast.error('Ошибка соединения с сервером. Проверьте подключение к интернету');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout illustration={
        <AuthIllustration 
          imageSrc={loginImage} 
          altText="Login Illustration" 
        />
      }>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#3f4254' }}>Вход</h1>
      
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email" style={{ fontWeight: 600, fontSize: '0.875rem', color: '#3f4254', display: 'block', marginBottom: '4px' }}>
            Email или Имя пользователя <span style={{ color: '#f44336' }}>*</span>
          </label>
          <input 
            type="text" 
            id="email" 
            className="form-input" 
            placeholder="poschta@mail.by"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="password" style={{ fontWeight: 600, fontSize: '0.875rem', color: '#3f4254', display: 'block', marginBottom: '4px' }}>
              Пароль <span style={{ color: '#f44336' }}>*</span>
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

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Вход...' : 'Авторизоваться'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '20px' }}>
         Впервые на нашей платформе? <a href="/register" style={{ color: '#696cff', textDecoration: 'none', fontWeight: 500 }}>Создайте аккаунт</a>
      </p>
    </AuthLayout>
  );
};

export default LoginPage;