// src/App.tsx

import React, { Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate
} from 'react-router-dom';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import MainLayout from './components/MainLayout.tsx';
import PostCreatePage from './pages/PostCreatePage.tsx';
import FeedPage from './components/FeedPage.tsx'; 
import { AuthProvider, useAuth } from './context/AuthContext.tsx'; 
import SinglePostPage from './pages/SinglePostPage.tsx'; 
import PostEditPage from './pages/PostEditPage.tsx';
import ModeratorPage from './pages/ModeratorPage.tsx'; 
import FavouritesPage from '../src/components/FavouritesPage.tsx';
import LikesPage from '../src/components/LikesPage.tsx';
import PlaceDetailsPage from '../src/components/PlaceDetailsPage.tsx';

// ==========================================================
// КОМПОНЕНТ ЗАЩИТЫ МАРШРУТОВ (ProtectedRoute)
// ==========================================================
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>Загрузка...</div>
    </div>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// ==========================================================
// ModeratorRoute (ТОЛЬКО ДЛЯ АДМИНА)
// ==========================================================
const ModeratorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user, isLoading } = useAuth();
    
    if (isLoading) {
      return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Загрузка...</div>
      </div>;
    }
    
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }
    
    if (user?.role_id !== 2) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

// ==========================================================
// КОМПОНЕНТ ЗАГРУЗКИ
// ==========================================================
const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div>Загрузка...</div>
  </div>
);

// ==========================================================
// ОСНОВНОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ
// ==========================================================
const App: React.FC = () => {
  return (
    <AuthProvider> 
      <Suspense fallback={<LoadingSpinner />}>
        <Router>
          <Routes>
            {/* Гостевые маршруты */}
            <Route path="/" element={<FeedPage />} />
            <Route path="/search" element={<FeedPage />} />
            <Route path="/post/:id" element={<SinglePostPage />} />
            <Route path="/user/:userId" element={<MainLayout />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Защищенные маршруты */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/post/edit/:id" 
              element={
                <ProtectedRoute>
                  <PostEditPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/post/new" 
              element={
                <ProtectedRoute>
                  <PostCreatePage />
                </ProtectedRoute>
              } 
            />

            <Route path="/admin" element={
              <ModeratorRoute>
                <ModeratorPage />
              </ModeratorRoute>
            } />  
          
            <Route 
              path="/bookmarks" 
              element={
                <ProtectedRoute>
                  <FavouritesPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/subscriptions" 
              element={
                <ProtectedRoute>
                  <LikesPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/place/:placeId" 
              element={
                <ProtectedRoute>
                  <PlaceDetailsPage />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </Suspense>
    </AuthProvider>
  );
};

export default App;