import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx'; // ✅ Используем наш хук

interface ProtectedRouteProps {
  element: React.ReactElement; // Компонент, который нужно отобразить (например, <MainLayout />)
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ element }) => {
  const { isLoggedIn, user } = useAuth();

  // Пока проверяется статус аутентификации (например, идет запрос checkAuth в AuthContext)
  // Мы можем отобразить заглушку, чтобы избежать мигания.
  // В вашем AuthContext, если `user` === null и `isLoggedIn` === false - это гость.
  // Учитывая, что в AuthContext.tsx у вас нет состояния `loading`, мы будем полагаться только на `isLoggedIn`.
  
  if (!isLoggedIn) {
    // 💡 Если пользователь НЕ авторизован, перенаправляем его на /login
    // replace={true} заменяет текущую запись в истории, чтобы нельзя было вернуться назад кнопкой "назад"
    return <Navigate to="/login" replace={true} />;
  }

  // 💡 Если пользователь авторизован, отображаем запрошенный компонент
  return element;
};

export default ProtectedRoute;