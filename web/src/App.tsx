// src/App.tsx (Исправленная версия)

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

// ==========================================================
// КОМПОНЕНТ ЗАЩИТЫ МАРШРУТОВ (ProtectedRoute)
// ==========================================================
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuth(); 

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
// ==========================================================
// --- ModeratorRoute (ТОЛЬКО ДЛЯ АДМИНА) 🆕 ---
const ModeratorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user } = useAuth();
    
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }
    
    // Если роль не 2 (не модератор), кидаем на главную (или страницу 403)
    if (user?.role_id !== 2) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider> 
       <Router>
         <Routes>
           <Route path="/login" element={<LoginPage />} />
           <Route path="/register" element={<RegisterPage />} />         
           
           {/* МАРШРУТ 1: Общая лента/Поиск */}
           <Route path="/search" element={<FeedPage />} /> 
           <Route path="/post/:id" element={<SinglePostPage />} />

           {/* ✅ ОБНОВЛЕННЫЕ МАРШРУТЫ ПРОФИЛЯ */}
           <Route path="/user/:userId" element={<MainLayout />} />
           <Route 
             path="/profile" 
             element={
               <ProtectedRoute>
                 <MainLayout />
               </ProtectedRoute>
             } 
           /> 

           {/* Остальные маршруты остаются без изменений */}
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

           {/* МАРШРУТ 2: Главная страница */}
           <Route path="/" element={<FeedPage />} />
         </Routes>
       </Router>
    </AuthProvider>
  );
};

export default App;