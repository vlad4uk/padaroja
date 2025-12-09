// src/components/CommentActionsMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FaTrash, FaEllipsisV } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx';
import CommentReportButton from './CommentReportButton.tsx';

interface CommentActionsMenuProps {
    commentID: number;
    commentAuthorID: number;
    onDelete: (id: number) => void;
    onReport: (commentID: number, reason: string) => Promise<void>;
}

const CommentActionsMenu: React.FC<CommentActionsMenuProps> = ({
    commentID,
    commentAuthorID,
    onDelete,
    onReport
}) => {
    const { user, isLoggedIn } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isAuthor = isLoggedIn && user?.id === commentAuthorID;

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

    if (!isLoggedIn) {
        return null;
    }

    return (
        <div className="comment-actions-container" ref={menuRef}>
            <button
                className="comment-menu-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Действия"
            >
                <FaEllipsisV />
            </button>
            
            {isOpen && (
                <div className="comment-menu-dropdown">
                    {/* Действия для автора */}
                    {isAuthor && (
                        <button
                            onClick={() => onDelete(commentID)}
                            className="comment-action-item comment-action-delete"
                        >
                            <FaTrash style={{ marginRight: '8px' }} /> Удалить
                        </button>
                    )}
                    
                    {/* Действия для всех (кроме автора) */}
                    {!isAuthor && (
                        <CommentReportButton
                            commentID={commentID}
                            onReport={onReport}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default CommentActionsMenu;