import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AuthLayout from '../components/AuthLayout.tsx';
import AuthIllustration from '../components/AuthIllustration.tsx';
import loginImage from '../assets/stork.png';

const API_BASE_URL = '/api/auth'; 

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!username.trim()) {
      toast.error('Пожалуйста, введите имя пользователя');
      setLoading(false);
      return;
    }

    if (username.length < 3) {
      toast.error('Имя пользователя должно содержать минимум 3 символа');
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      toast.error('Пожалуйста, введите email');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Пожалуйста, введите корректный email адрес');
      setLoading(false);
      return;
    }

    if (!password) {
      toast.error('Пожалуйста, введите пароль');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/register`,
        {
          username,
          email,
          password,
        }
      );

      console.log('Registration successful:', response.data);
      
      toast.success('Регистрация успешна! Теперь вы можете войти в систему');
      
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);

    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const errorMessage = err.response.data.error;
        
        if (errorMessage.includes('already exists')) {
          toast.error('Пользователь с таким email или именем уже существует');
        } else {
          toast.error(errorMessage || 'Ошибка регистрации. Попробуйте еще раз');
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
          altText="Register Illustration" 
        />
      }>
      <h1 className="auth-title">Начни приключения здесь!</h1>

      <form onSubmit={handleSubmit}>
        <div className="form-field-group">
          <label htmlFor="username" className="form-label">
            Имя <span style={{ color: '#f44336' }}>*</span>
          </label>
          <input 
            type="text" 
            id="username" 
            className="form-input" 
            placeholder="Введите свое имя" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <small style={{ fontSize: '0.75rem', color: '#666' }}>Минимум 3 символа</small>
        </div>

        <div className="form-field-group">
          <label htmlFor="email" className="form-label">
            Почта <span style={{ color: '#f44336' }}>*</span>
          </label>
          <input 
            type="email" 
            id="email" 
            className="form-input" 
            placeholder="Введите свою почту" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-field-group">
          <label htmlFor="password" className="form-label">
            Пароль <span style={{ color: '#f44336' }}>*</span>
          </label>
          <input 
            type="password" 
            id="password" 
            className="form-input" 
            placeholder="············"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small style={{ fontSize: '0.75rem', color: '#666' }}>Минимум 6 символов</small>
        </div>

        <div className="form-field-group">
          <label htmlFor="confirmPassword" className="form-label">
            Подтверждение пароля <span style={{ color: '#f44336' }}>*</span>
          </label>
          <input 
            type="password" 
            id="confirmPassword" 
            className="form-input" 
            placeholder="············"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '20px' }}>
          У вас уже есть учетная запись? <a href="/login" style={{ color: '#696cff', textDecoration: 'none', fontWeight: 500 }}>Войдите</a>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;