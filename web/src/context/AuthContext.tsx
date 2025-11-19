// src/context/AuthContext.tsx (Полностью переписано и исправлено)

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/auth';
const API_USER_PROFILE = 'http://localhost:8080/api/user/profile';

interface User {
    id: number;
    username: string; 
    // ✅ ДОБАВЛЕНЫ ПОЛЯ
    bio: string;
    image_url: string; 
}

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    login: (responseData: { user: User; message: string } | User) => void;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    const login = (responseData: { user: User; message: string } | User) => {
        const userData = 'user' in responseData ? responseData.user : responseData;
        
        // ✅ ФИКС: Убеждаемся, что все поля правильно деструктурируются
        setUser({ 
            id: userData.id, 
            username: userData.username,
            bio: userData.bio || '',           // Установка дефолта, если нет
            image_url: userData.image_url || '', // Установка дефолта, если нет
        });
    };

    const checkAuth = useCallback(async () => {
        try {
            const response = await axios.get(API_USER_PROFILE, { withCredentials: true });
            
            // ✅ ФИКС: Проверяем, что ответ Go API содержит нужные поля
            // Go-ответ содержит: { id:..., username:..., bio:..., image_url:... }
            const userData = response.data;

            setUser({ 
                id: userData.id, 
                username: userData.username,
                bio: userData.bio || '',
                image_url: userData.image_url || '',
            });

        } catch (error) {
            setUser(null); // Если 401 Unauthorized, пользователь - гость
        }
    }, []);


    const logout = async () => {
        try {
            await axios.post(`${API_BASE_URL}/logout`, {}, { withCredentials: true });
            setUser(null); 
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
    };
    
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const contextValue = {
        user,
        isLoggedIn: !!user,
        login,
        logout,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};