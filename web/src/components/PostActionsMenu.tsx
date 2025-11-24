// src/components/PostActionsMenu.tsx (ФИНАЛЬНАЯ ВЕРСИЯ С КЛАССАМИ)

import React, { useState, useRef, useEffect } from 'react';
import { FaEdit, FaTrash, FaFlag, FaEllipsisV } from 'react-icons/fa'; // Используем FaEllipsisV для "трех точек"
import { useAuth } from '../context/AuthContext.tsx'; 

interface PostActionsMenuProps {
    postID: number; 
    postAuthorID: number; 
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
    onReport: (id: number) => void;
}

const PostActionsMenu: React.FC<PostActionsMenuProps> = ({ 
    postID, 
    postAuthorID, 
    onEdit, 
    onDelete, 
    onReport 
}) => {
    const { user, isLoggedIn } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // Проверка: является ли текущий пользователь автором поста
    const isAuthor = isLoggedIn && user?.id === postAuthorID;

    // Закрытие меню при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Ничего не показываем гостям (только авторизованным пользователям доступны действия)
    if (!isLoggedIn) {
        return null; 
    }

    return (
        <div className="post-actions-container" ref={menuRef}>
            
            {/* Кнопка "три точки" */}
            <button 
                className="post-menu-button" 
                onClick={() => setIsOpen(!isOpen)}
                title="Действия"
            >
                <FaEllipsisV />
            </button>
            
            {isOpen && (
                <div className="menu-dropdown">
                    {isAuthor ? (
                        // Действия для АВТОРА
                        <>
                            <button onClick={() => onEdit(postID)} className="action-item">
                                <FaEdit style={{ marginRight: '8px' }} /> Изменить
                            </button>
                            <button onClick={() => onDelete(postID)} className="action-item action-delete">
                                <FaTrash style={{ marginRight: '8px' }} /> Удалить
                            </button>
                        </>
                    ) : (
                        // Действия для ДРУГИХ АВТОРИЗОВАННЫХ
                        <button onClick={() => onReport(postID)} className="action-item">
                            <FaFlag style={{ marginRight: '8px' }} /> Пожаловаться
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostActionsMenu;