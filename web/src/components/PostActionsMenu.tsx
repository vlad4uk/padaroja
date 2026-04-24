import React, { useState, useRef, useEffect } from 'react';
import { FaEdit, FaTrash, FaFlag, FaEllipsisV, FaComment, FaCommentSlash } from 'react-icons/fa';
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
    const [showReportModal, setShowReportModal] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const isAuthor = isLoggedIn && user?.id === postAuthorID;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleReport = async (reason: string) => {
        try {
            await onReport(postID, reason);
            // Успешно - закрываем всё
            setShowReportModal(false);
            setIsOpen(false);
        } catch (error) {
            console.error('Report failed:', error);
            // Не закрываем модалку при ошибке
            throw error;
        }
    };

    const handleReportClick = () => {
        setShowReportModal(true);
        setIsOpen(false);
    };

    if (!isLoggedIn) return null;

    return (
        <>
            <div className="post-actions-container" ref={menuRef}>
                <button 
                    className="post-menu-button" 
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <FaEllipsisV />
                </button>
                
                {isOpen && (
                    <div className="menu-dropdown">
                        {isAuthor ? (
                            <>
                                <button onClick={() => { onEdit(postID); setIsOpen(false); }} className="action-item">
                                    <FaEdit style={{ marginRight: '8px' }} /> Изменить
                                </button>
                                {onToggleComments && (
                                    <button onClick={() => { onToggleComments(); setIsOpen(false); }} className="action-item action-comments">
                                        {commentsDisabled ? <><FaComment style={{ marginRight: '8px' }} /> Включить комментарии</> : <><FaCommentSlash style={{ marginRight: '8px' }} /> Отключить комментарии</>}
                                    </button>
                                )}
                                <button onClick={() => { onDelete(postID); setIsOpen(false); }} className="action-item action-delete">
                                    <FaTrash style={{ marginRight: '8px' }} /> Удалить
                                </button>
                            </>
                        ) : (
                            <button onClick={handleReportClick} className="action-item">
                                <FaFlag style={{ marginRight: '8px' }} /> Пожаловаться
                            </button>
                        )}
                    </div>
                )}
            </div>

            <ReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                onSubmit={handleReport}
            />
        </>
    );
};

export default PostActionsMenu;