import React, { useState, useRef, useEffect } from 'react';
import { 
  FaEdit, 
  FaTrash, 
  FaFlag, 
  FaEllipsisV, 
  FaComment, 
  FaCommentSlash
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx';
import ReportModal from './ReportModal.tsx';

interface PostActionsMenuProps {
    postID: number;
    postAuthorID: number;
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
    onReport: (id: number, reason: string) => Promise<void>;
    onToggleComments?: () => void;
    commentsDisabled?: boolean;
    userRole?: number;
}

const PostActionsMenu: React.FC<PostActionsMenuProps> = ({ 
    postID, 
    postAuthorID, 
    onEdit, 
    onDelete, 
    onReport,
    onToggleComments,
    commentsDisabled = false,
    userRole
}) => {
    const { user, isLoggedIn } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const isAuthor = isLoggedIn && user?.id === postAuthorID;
    const isModerator = userRole === 2;

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

    const handleReportSubmit = async (reason: string) => {
        setIsReporting(true);
        try {
            await onReport(postID, reason);
        } catch (error) {
            console.error('Report failed:', error);
        } finally {
            setIsReporting(false);
            setIsReportModalOpen(false);
        }
    };

    const handleReportClick = () => {
        setIsReportModalOpen(true);
        setIsOpen(false);
    };

    if (!isLoggedIn) {
        return null;
    }

    return (
        <>
            <div className="post-actions-container" ref={menuRef}>
                <button 
                    className="post-menu-button" 
                    onClick={() => setIsOpen(!isOpen)}
                    title="Действия"
                >
                    <FaEllipsisV />
                </button>
                
                {isOpen && (
                    <div className="menu-dropdown">
                        {/* Для автора */}
                        {isAuthor ? (
                            <>
                                <button 
                                    onClick={() => {
                                        onEdit(postID);
                                        setIsOpen(false);
                                    }} 
                                    className="action-item"
                                >
                                    <FaEdit style={{ marginRight: '8px' }} /> Изменить
                                </button>
                                
                                {onToggleComments && (
                                    <button 
                                        onClick={() => {
                                            onToggleComments();
                                            setIsOpen(false);
                                        }}
                                        className="action-item action-comments"
                                    >
                                        {commentsDisabled ? (
                                            <>
                                                <FaComment style={{ marginRight: '8px' }} /> Включить комментарии
                                            </>
                                        ) : (
                                            <>
                                                <FaCommentSlash style={{ marginRight: '8px' }} /> Отключить комментарии
                                            </>
                                        )}
                                    </button>
                                )}
                                
                                <button 
                                    onClick={() => {
                                        onDelete(postID);
                                        setIsOpen(false);
                                    }} 
                                    className="action-item action-delete"
                                >
                                    <FaTrash style={{ marginRight: '8px' }} /> Удалить
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={handleReportClick}
                                className="action-item"
                            >
                                <FaFlag style={{ marginRight: '8px' }} /> Пожаловаться
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Модальное окно для жалоб на посты */}
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => {
                    setIsReportModalOpen(false);
                    setIsReporting(false);
                }}
                onSubmit={handleReportSubmit}
                title="Пожаловаться на пост"
                description="Опишите причину жалобы на пост. Модераторы проверят этот контент."
                placeholder="Причина жалобы..."
                loading={isReporting}
            />
        </>
    );
};

export default PostActionsMenu;