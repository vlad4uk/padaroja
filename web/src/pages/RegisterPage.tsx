import React, { useState } from 'react';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout.tsx';
import SocialButtons from '../components/SocialButtons.tsx';
import FriendsFront from '../assets/FrontFriends.jpg';


// Базовый URL Go-бэкенда
const API_BASE_URL = 'http://localhost:8080/api/auth'; 

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!agreed) {
        setError('You must agree to the terms and privacy policy.');
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
        // withCredentials: true не требуется, так как куки еще не устанавливаются
      );

      // В случае успеха:
      console.log('Registration successful:', response.data);
      setMessage(response.data.message || 'Registration successful! Now you can log in.');
      
      // Очистка формы
      setUsername('');
      setEmail('');
      setPassword('');
      setAgreed(false);

    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        // Отображение ошибки с бэкенда (например, "User already exists")
        setError(err.response.data.error || 'Registration failed');
      } else {
        setError('An unexpected error occurred. Check server connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const RegisterIllustration = () => (
    <div style={{ textAlign: 'center' }}>
       <img src={FriendsFront} alt="Register friends" style={{ maxWidth: '80%', height: 'auto' }} />
    </div>
  );

  return (
    <AuthLayout illustration={<RegisterIllustration />}>
      <h1 className="auth-title">Начни приключения здесь!</h1>

      <form onSubmit={handleSubmit}>
        {/* Поле Username */}
        <div className="form-field-group">
          <label htmlFor="username" className="form-label">Имя</label>
          <input 
            type="text" 
            id="username" 
            className="form-input" 
            placeholder="Введите свое имя" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        {/* Поле Email */}
        <div className="form-field-group">
          <label htmlFor="email" className="form-label">Почта</label>
          <input 
            type="email" 
            id="email" 
            className="form-input" 
            placeholder="Введите свою почту" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Поле Password */}
        <div className="form-field-group">
          <label htmlFor="password" className="form-label">Пароль</label>
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

        {/* Checkbox "I agree" */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.875rem', color: '#3f4254', display: 'flex', alignItems: 'center' }}>
            <input 
                type="checkbox" 
                style={{ marginRight: '8px' }} 
                checked={agreed} 
                onChange={(e) => setAgreed(e.target.checked)} 
                required 
            />
            Я согласен с <a href="/terms" style={{ color: '#696cff', textDecoration: 'none', marginLeft: '4px', fontWeight: 500 }}>политикой конфиденциальности и условиями</a>
          </label>
        </div>

        {/* Отображение ошибки/успеха */}
        {error && <p style={{ color: 'red', textAlign: 'center', fontSize: '0.875rem', marginBottom: '10px' }}>{error}</p>}
        {message && <p style={{ color: 'green', textAlign: 'center', fontSize: '0.875rem', marginBottom: '10px' }}>{message}</p>}

        <button type="submit" className="primary-button" disabled={loading || !agreed}>
          {loading ? 'Signing Up...' : 'Зарегистрироваться'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '20px' }}>
          У вас уже есть учетная запись? <a href="/login" style={{ color: '#696cff', textDecoration: 'none', fontWeight: 500 }}>Войдите в</a>
      </p>

      <div className="separator">or</div>
      <SocialButtons />
    </AuthLayout>
  );
};

export default RegisterPage;