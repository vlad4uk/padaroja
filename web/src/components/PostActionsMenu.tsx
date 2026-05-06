import React, { useState, useRef, useEffect } from 'react';
import { FaEdit, FaTrash, FaFlag, FaEllipsisV, FaComment, FaCommentSlash, FaSignOutAlt, FaUsers } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.tsx';
import ReportModal from './ReportModal.tsx';
import axios from 'axios';

interface PostActionsMenuProps {
    postID: number;
    postAuthorID: number;
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
    onReport: (id: number, reason: string) => Promise<void>;
    onToggleComments?: () => void;
    commentsDisabled?: boolean;
    userRole?: number;
    isCollaborator?: boolean;
    collaboratorRole?: 'editor' | 'viewer' | null;
    onLeaveCollaboration?: (postId: number) => void;
    onManageCollaborators?: (postId: number) => void;
}

const PostActionsMenu: React.FC<PostActionsMenuProps> = ({ 
    postID, 
    postAuthorID, 
    onEdit, 
    onDelete, 
    onReport,
    onToggleComments,
    commentsDisabled = false,
    userRole,
    isCollaborator = false,
    collaboratorRole = null,
    onLeaveCollaboration,
    onManageCollaborators
}) => {
    const { user, isLoggedIn } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const isAuthor = isLoggedIn && user?.id === postAuthorID;
    const isModerator = userRole === 2;
    const canEdit = isAuthor || (isCollaborator && collaboratorRole === 'editor');

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
            setShowReportModal(false);
            setIsOpen(false);
        } catch (error) {
            console.error('Report failed:', error);
            throw error;
        }
    };

    const handleReportClick = () => {
        setShowReportModal(true);
        setIsOpen(false);
    };

    const handleLeaveCollaboration = async () => {
        if (!window.confirm('Вы уверены, что хотите выйти из соавторов этого поста? Вы больше не сможете его редактировать.')) {
            return;
        }
        
        setIsLeaving(true);
        try {
            await axios.post(`/api/posts/${postID}/leave`, {}, {
                withCredentials: true
            });
            alert('Вы вышли из соавторов поста');
            if (onLeaveCollaboration) {
                onLeaveCollaboration(postID);
            }
            // Перезагружаем страницу или обновляем состояние
            window.location.reload();
        } catch (error: any) {
            console.error('Ошибка при выходе из соавторов:', error);
            alert(error.response?.data?.error || 'Не удалось выйти из соавторов');
        } finally {
            setIsLeaving(false);
            setIsOpen(false);
        }
    };

    const handleManageCollaborators = () => {
        if (onManageCollaborators) {
            onManageCollaborators(postID);
        }
        setIsOpen(false);
    };

    if (!isLoggedIn) return null;

    // Определяем, какие пункты меню показывать
    const showEdit = canEdit;
    const showDelete = isAuthor;
    const showToggleComments = isAuthor;
    const showManageCollaborators = isAuthor;
    const showLeaveCollaboration = isCollaborator && !isAuthor;
    const showReport = !isAuthor && !isModerator;

    // Если нет ни одного пункта меню, не показываем кнопку
    if (!showEdit && !showDelete && !showToggleComments && !showManageCollaborators && !showLeaveCollaboration && !showReport) {
        return null;
    }

    return (
        <>
            <div className="post-actions-container" ref={menuRef}>
                <button 
                    className="post-menu-button" 
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Действия с постом"
                >
                    <FaEllipsisV />
                </button>
                
                {isOpen && (
                    <div className="menu-dropdown">
                        {/* Редактирование - для владельца и редакторов */}
                        {showEdit && (
                            <button onClick={() => { onEdit(postID); setIsOpen(false); }} className="action-item">
                                <FaEdit style={{ marginRight: '8px' }} /> 
                                {isAuthor ? 'Изменить пост' : 'Редактировать как соавтор'}
                            </button>
                        )}

                        {/* Управление соавторами - только для владельца */}
                        {showManageCollaborators && (
                            <button onClick={handleManageCollaborators} className="action-item action-collaborators">
                                <FaUsers style={{ marginRight: '8px' }} /> Управление соавторами
                            </button>
                        )}

                        {/* Переключение комментариев - только для владельца */}
                        {showToggleComments && onToggleComments && (
                            <button onClick={() => { onToggleComments(); setIsOpen(false); }} className="action-item action-comments">
                                {commentsDisabled ? 
                                    <><FaComment style={{ marginRight: '8px' }} /> Включить комментарии</> : 
                                    <><FaCommentSlash style={{ marginRight: '8px' }} /> Отключить комментарии</>
                                }
                            </button>
                        )}

                        {/* Выход из соавторов - для соавторов (не владельца) */}
                        {showLeaveCollaboration && (
                            <button 
                                onClick={handleLeaveCollaboration} 
                                className="action-item action-leave"
                                disabled={isLeaving}
                            >
                                <FaSignOutAlt style={{ marginRight: '8px' }} /> 
                                {isLeaving ? 'Выход...' : 'Выйти из соавторов'}
                            </button>
                        )}

                        {/* Удаление - только для владельца */}
                        {showDelete && (
                            <button onClick={() => { onDelete(postID); setIsOpen(false); }} className="action-item action-delete">
                                <FaTrash style={{ marginRight: '8px' }} /> Удалить пост
                            </button>
                        )}

                        {/* Жалоба - для всех остальных */}
                        {showReport && (
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