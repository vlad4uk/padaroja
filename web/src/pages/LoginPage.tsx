import React, { useState } from 'react';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout.tsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; 
import AuthIllustration from '../components/AuthIllustration.tsx';
import loginImage from '../assets/bird04.png';


const API_BASE_URL = '/api/auth'; 

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
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

      alert(`Вход успешен! Добро пожаловать, ${response.data.user.username}`);
      
      navigate('/profile');

    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Login failed');
      } else {
        setError('An unexpected error occurred. Check server connection.');
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
        {/* Поле Email/Username */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email" style={{ fontWeight: 600, fontSize: '0.875rem', color: '#3f4254', display: 'block', marginBottom: '4px' }}>
            Email или Имя пользователя
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <label style={{ fontSize: '0.875rem', color: '#3f4254', display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" style={{ marginRight: '8px' }} />
            Запомнить меня
          </label>
        </div>
        
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