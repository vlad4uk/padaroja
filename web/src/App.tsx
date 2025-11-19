// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import MainLayout from './components/MainLayout.tsx';
import PostCreatePage from './pages/PostCreatePage.tsx';
import FeedPage from './components/FeedPage.tsx'; // ✅ ИМПОРТ НОВОЙ СТРАНИЦЫ
import { AuthProvider, useAuth } from './context/AuthContext.tsx'; 

// ==========================================================
// 1. КОМПОНЕНТ ЗАЩИТЫ МАРШРУТОВ (ProtectedRoute)
// ==========================================================
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuth(); 

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
// ==========================================================


const App: React.FC = () => {
  return (
    <AuthProvider> 
       <Router>
         <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />         
          
          {/* ✅ МАРШРУТ 1: Общая лента/Поиск (открыт для всех) */}
          <Route path="/search" element={<FeedPage />} /> 

          <Route 
            path="/post/new" 
            element={
              <ProtectedRoute>
                <PostCreatePage />
              </ProtectedRoute>
            } 
          />
        
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            } 
          /> 
        
          {/* ✅ МАРШРУТ 2: Главная страница (показывает общую ленту) */}
          <Route path="/" element={<FeedPage />} />
  </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;