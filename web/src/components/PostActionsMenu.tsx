// src/components/PostActionsMenu.tsx

import React, { useState } from 'react';
import { FaEdit, FaTrash, FaFlag } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx'; //

interface PostActionsMenuProps {
    postID: number; // ID поста
    postAuthorID: number; // ID автора поста
    // Callbacks для действий
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
    
    // Проверка: является ли текущий пользователь автором поста
    const isAuthor = isLoggedIn && user?.id === postAuthorID;

    // Ничего не показываем гостям
    if (!isLoggedIn && !isAuthor) {
        return null; 
    }

    return (
        <div className="post-actions-container" style={{ position: 'relative' }}>
            {/* Кнопка "три точки" */}
            <button 
                className="post-menu-button" 
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
            >
                ...
            </button>

            {/* Выпадающее меню */}
            {isOpen && (
                <div 
                    className="post-actions-dropdown"
                    // ⚠️ Требуется стилизация в MainLayout.css или в отдельном файле
                    style={{ position: 'absolute', right: '0', top: '100%', zIndex: 10, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', minWidth: '150px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                >
                    {isAuthor ? (
                        // Действия для АВТОРА
                        <>
                            <button onClick={() => onEdit(postID)} className="action-item" style={{ padding: '8px', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <FaEdit style={{ marginRight: '8px' }} /> Изменить
                            </button>
                            <button onClick={() => onDelete(postID)} className="action-item" style={{ padding: '8px', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: 'red' }}>
                                <FaTrash style={{ marginRight: '8px' }} /> Удалить
                            </button>
                        </>
                    ) : (
                        // Действия для ДРУГИХ АВТОРИЗОВАННЫХ
                        <button onClick={() => onReport(postID)} className="action-item" style={{ padding: '8px', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
                            <FaFlag style={{ marginRight: '8px' }} /> Пожаловаться
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostActionsMenu;