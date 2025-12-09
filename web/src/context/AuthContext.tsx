// src/context/AuthContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = '/api/auth';
const API_USER_PROFILE = '/api/user/profile';

interface User {
    id: number;
    username: string; 
    bio: string;
    image_url: string; 
    role_id: number;
    followers_count?: number;
    following_count?: number;
}

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
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
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const login = (responseData: { user: User; message: string } | User) => {
        const userData = 'user' in responseData ? responseData.user : responseData;
        
        setUser({ 
            id: userData.id, 
            username: userData.username,
            bio: userData.bio || '',           
            image_url: userData.image_url || '',
            role_id: userData.role_id || 1,
        });
        setIsLoading(false);
    };

    const checkAuth = useCallback(async () => {
        try {
            const response = await axios.get(API_USER_PROFILE, { withCredentials: true });
            const userData = response.data;

            setUser({ 
                id: userData.id, 
                username: userData.username,
                bio: userData.bio || '',
                image_url: userData.image_url || '',
                role_id: userData.role_id || 1,
            });
        } catch (error) {
            // Пользователь - гость
            setUser(null);
        } finally {
            setIsLoading(false);
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
        isLoading,
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