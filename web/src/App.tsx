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
import RulesPage from './components/RulesPage.tsx';
import AllPostsMapPage from './pages/AllPostsMapPage.tsx';
import CollaborationInvites from './components/CollaborationInvites.tsx';
import PostCollaboratorsPage from './components/PostCollaboratorsPage.tsx';
import RecommendationsPage from './pages/RecommendationsPage.tsx';
import AdminPanel from './pages/AdminPage.tsx';

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

// Роут для модераторов (role_id = 2) и админов (role_id = 3)
const ModeratorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user, isLoading } = useAuth();
    
    if (isLoading) return <div>Загрузка...</div>;
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (user?.role_id !== 2 && user?.role_id !== 3) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

// Роут только для администраторов (role_id = 3)
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn, user, isLoading } = useAuth();
    
    if (isLoading) return <div>Загрузка...</div>;
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (user?.role_id !== 3) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div>Загрузка...</div>
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider> 
      <Suspense fallback={<LoadingSpinner />}>
        <Router>
          <Routes>
            {/* Публичные маршруты */}
            <Route path="/" element={<FeedPage />} />
            <Route path="/search" element={<FeedPage />} />
            <Route path="/post/:id" element={<SinglePostPage />} />
            <Route path="/user/:userId" element={<MainLayout />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/settings" element={<RulesPage />} />
            
            {/* Карта всех постов */}
            <Route path="/map/all" element={<AllPostsMapPage />} />
            
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

            <Route 
                path="/recommendations" 
                element={
                    <ProtectedRoute>
                        <RecommendationsPage />
                    </ProtectedRoute>
                } 
            />
            
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
              path="/invites" 
              element={
                <ProtectedRoute>
                  <CollaborationInvites />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/posts/:postId/collaborators" 
              element={
                <ProtectedRoute>
                  <PostCollaboratorsPage />
                </ProtectedRoute>
              } 
            />

            {/* Маршрут для модераторов (role_id = 2) */}
            <Route 
                path="/admin" 
                element={
                    <ModeratorRoute>
                        <ModeratorPage />
                    </ModeratorRoute>
                } 
            />

            {/* Маршрут для администраторов (role_id = 3) */}
            <Route 
                path="/adminpanel" 
                element={
                    <AdminRoute>
                        <AdminPanel />
                    </AdminRoute>
                } 
            />
          </Routes>
        </Router>
      </Suspense>
    </AuthProvider>
  );
};

export default App;