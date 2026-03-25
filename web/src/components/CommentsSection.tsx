// components/CommentsSection.tsx (частичное обновление)
import React, { useState, useEffect, useCallback, ReactElement } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.tsx';
import { Comment, CommentsResponse, CreateCommentRequest } from '../types/comment';
import { FaCommentSlash, FaReply, FaChevronDown, FaSpinner, FaTrash } from 'react-icons/fa';
import CommentReportButton from '../components/CommentReportButton.tsx'; // Импортируем новый компонент
import './CommentsSection.css';

interface CommentsSectionProps {
  postId: number;
  commentsDisabled?: boolean; // Добавляем пропс для статуса комментариев
}

// Вспомогательный тип для управления ответами
interface ReplyState {
  replies: Comment[];
  loading: boolean;
  expanded: boolean;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ 
  postId,
  commentsDisabled = false 
}) => {
  const { user, isLoggedIn } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyStates, setReplyStates] = useState<Record<number, ReplyState>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Загрузка ВСЕХ комментариев (и корневых, и ответов)
  const fetchComments = useCallback(async () => {
    if (commentsDisabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.get<CommentsResponse>(
        `/api/comments/post/${postId}?limit=100`, // Увеличиваем лимит
        { withCredentials: true }
      );
      
      // 1. Фильтруем корневые комментарии (без parent_id)
      const rootComments = response.data.comments.filter(comment => !comment.parent_id);
      setComments(rootComments);
      
      // 2. Создаем map для группировки ответов по parent_id
      const repliesByParentId: Record<number, Comment[]> = {};
      
      // Проходим по всем комментариям
      response.data.comments.forEach(comment => {
        if (comment.parent_id) {
          // Это ответ - добавляем в соответствующую группу
          if (!repliesByParentId[comment.parent_id]) {
            repliesByParentId[comment.parent_id] = [];
          }
          repliesByParentId[comment.parent_id].push(comment);
        }
      });
      
      // 3. Инициализируем состояния для всех корневых комментариев
      const initialReplyStates: Record<number, ReplyState> = {};
      
      rootComments.forEach(comment => {
        initialReplyStates[comment.id] = {
          replies: repliesByParentId[comment.id] || [],
          loading: false,
          expanded: false
        };
      });
      
      // 4. Также инициализируем для ответов, которые сами имеют ответы
      Object.keys(repliesByParentId).forEach(parentIdStr => {
        const parentId = parseInt(parentIdStr);
        const replies = repliesByParentId[parentId];
        
        // Проверяем, есть ли у ответов свои ответы
        replies.forEach(reply => {
          if (repliesByParentId[reply.id]) {
            // Этот ответ сам имеет ответы
            initialReplyStates[reply.id] = {
              replies: repliesByParentId[reply.id] || [],
              loading: false,
              expanded: false
            };
          }
        });
      });
      
      setReplyStates(initialReplyStates);
      
    } catch (err: any) {
      console.error('Ошибка загрузки комментариев:', err);
      setError('Не удалось загрузить комментарии');
    } finally {
      setLoading(false);
    }
  }, [postId, commentsDisabled]);

  // Загрузка дополнительных ответов (если нужны)
  const fetchReplies = async (commentId: number) => {
    try {
      setReplyStates(prev => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          loading: true
        }
      }));
      
      const response = await axios.get(
        `/api/comments/${commentId}/replies`,
        { withCredentials: true }
      );
      
      // Объединяем уже загруженные ответы с новыми
      setReplyStates(prev => {
        const existingReplies = prev[commentId]?.replies || [];
        const newReplies = response.data.replies || [];
        
        // Объединяем, убирая дубликаты
        const allReplies = [...existingReplies];
        newReplies.forEach((newReply: Comment) => {
          if (!allReplies.find(r => r.id === newReply.id)) {
            allReplies.push(newReply);
          }
        });
        
        return {
          ...prev,
          [commentId]: {
            replies: allReplies,
            loading: false,
            expanded: prev[commentId]?.expanded || false
          }
        };
      });
      
    } catch (err) {
      console.error('Ошибка загрузки ответов:', err);
      setReplyStates(prev => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          loading: false
        }
      }));
    }
  };

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Отправка нового комментария
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment || commentsDisabled) return;

    try {
      setSubmittingComment(true);
      const commentData: CreateCommentRequest = {
        content: newComment.trim(),
      };

      const response = await axios.post(
        `/api/comments/post/${postId}`,
        commentData,
        { withCredentials: true }
      );

      // Добавляем новый комментарий в начало списка
      setComments(prev => [response.data.comment, ...prev]);
      
      // Инициализируем состояние для ответов на этот комментарий
      setReplyStates(prev => ({
        ...prev,
        [response.data.comment.id]: {
          replies: [],
          loading: false,
          expanded: false
        }
      }));
      
      setNewComment('');
    } catch (err: any) {
      console.error('Ошибка при создании комментария:', err);
      if (err.response?.status === 401) {
        alert('Необходимо авторизоваться для комментирования');
      } else {
        alert('Ошибка при отправке комментария');
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // Отправка ответа на комментарий
  const handleSubmitReply = async (parentId: number, isReplyToReply = false) => {
    if (!replyContent.trim() || submittingReply || commentsDisabled) return;

    try {
      setSubmittingReply(true);
      const commentData: CreateCommentRequest = {
        content: replyContent.trim(),
        parent_id: parentId
      };

      const response = await axios.post(
        `/api/comments/post/${postId}`,
        commentData,
        { withCredentials: true }
      );

      // Определяем, кому отвечаем
      const targetId = isReplyToReply ? findRootComment(parentId)?.id || parentId : parentId;
      
      if (targetId) {
        setReplyStates(prev => {
          const currentReplies = prev[targetId]?.replies || [];
          return {
            ...prev,
            [targetId]: {
              ...prev[targetId],
              replies: [...currentReplies, response.data.comment],
              expanded: true // Автоматически раскрываем ответы
            }
          };
        });
      }

      setReplyContent('');
      setReplyingTo(null);
      
    } catch (err: any) {
      console.error('Ошибка при создании ответа:', err);
      if (err.response?.status === 401) {
        alert('Необходимо авторизоваться для ответа');
      } else {
        alert('Ошибка при отправке ответа');
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  // Поиск корневого комментария для ответа
  const findRootComment = (commentId: number): Comment | null => {
    // Сначала проверяем корневые комментарии
    const rootComment = comments.find(comment => comment.id === commentId);
    if (rootComment) return rootComment;

    // Затем проверяем все ответы
    for (const rootId in replyStates) {
      const replyState = replyStates[parseInt(rootId)];
      const reply = replyState.replies.find(reply => reply.id === commentId);
      if (reply) {
        return comments.find(comment => comment.id === parseInt(rootId)) || null;
      }
    }

    return null;
  };

  // Удаление комментария или ответа
  const handleDelete = async (commentId: number, isReply = false, rootCommentId?: number) => {
    if (!window.confirm('Удалить комментарий?')) return;

    try {
      await axios.delete(
        `/api/comments/${commentId}`,
        { withCredentials: true }
      );
      
      if (isReply && rootCommentId) {
        // Удаляем ответ из списка
        setReplyStates(prev => ({
          ...prev,
          [rootCommentId]: {
            ...prev[rootCommentId],
            replies: prev[rootCommentId]?.replies?.filter(reply => reply.id !== commentId) || []
          }
        }));
      } else {
        // Удаляем корневой комментарий
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        // Также удаляем его ответы из состояния
        const newReplyStates = { ...replyStates };
        delete newReplyStates[commentId];
        setReplyStates(newReplyStates);
      }
    } catch (err) {
      alert('Ошибка при удалении комментария');
    }
  };

  // Переключение отображения ответов
  const toggleReplies = (commentId: number) => {
    if (commentsDisabled) return;
    
    setReplyStates(prev => {
      const currentState = prev[commentId];
      const shouldFetch = !currentState || !currentState.expanded;
      
      const newState = {
        ...prev,
        [commentId]: {
          ...currentState,
          expanded: !currentState?.expanded,
          loading: shouldFetch && (currentState?.replies?.length === 0)
        }
      };
      
      // Если нужно загрузить ответы и их еще нет
      if (shouldFetch && (!currentState?.replies || currentState.replies.length === 0)) {
        setTimeout(() => fetchReplies(commentId), 0);
      }
      
      return newState;
    });
  };

  // Форматирование даты
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes < 1 ? 'только что' : `${diffMinutes} мин назад`;
      }
      return `${diffHours} ч назад`;
    } else if (diffDays === 1) {
      return 'вчера';
    } else if (diffDays < 7) {
      return `${diffDays} д назад`;
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
      });
    }
  };

  // components/CommentsSection.tsx (обновлённый renderComment)
const renderComment = (comment: Comment, isReply = false, rootCommentId?: number): ReactElement => {
    const replyState = replyStates[comment.id];
    const replies = replyState?.replies || [];
    const hasReplies = replies.length > 0;
    const isExpanded = replyState?.expanded || false;
    const isLoading = replyState?.loading || false;
    
    const actualRootCommentId = rootCommentId || (isReply ? findRootComment(comment.id)?.id : comment.id);
    const isAuthor = comment.user_id === user?.id;
    const canDelete = isAuthor || user?.role_id === 2; // Автор или модератор

    return (
        <div key={comment.id} className={`comment-item ${isReply ? 'comment-reply' : ''}`}>
            <div className="comment-avatar-container">
                <img 
                    src={comment.user.image_url || '/default-avatar.png'} 
                    alt={comment.user.username}
                    className="comment-avatar"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-avatar.png';
                    }}
                />
            </div>
            
            <div className="comment-content-wrapper">
                <div className="comment-header">
                    <span className="comment-username">
                        {comment.user.username}
                        {user?.id === comment.user_id && (
                            <span className="author-badge">Вы</span>
                        )}
                    </span>
                    <span className="comment-date">{formatDate(comment.created_at)}</span>
                    
                    {!comment.is_approved && (
                        <span className="comment-hidden-badge">[Скрыт модератором]</span>
                    )}
                </div>
                
                <div className="comment-text">
                    {comment.is_approved ? comment.content : (
                        <em style={{ color: '#999', fontStyle: 'italic' }}>
                            Комментарий скрыт по решению модерации
                        </em>
                    )}
                </div>
                
                {/* Кнопки действий */}
                <div className="comment-actions">
                    {/* Кнопка ответа (только если комментарий видим) */}
                    {isLoggedIn && comment.is_approved && !commentsDisabled && (
                        <button 
                            className="reply-btn"
                            onClick={() => {
                                setReplyingTo(comment.id);
                                setReplyContent(`@${comment.user.username} `);
                            }}
                        >
                            <FaReply style={{ marginRight: '4px' }} />
                            Ответить
                        </button>
                    )}
                    
                    {/* Кнопка удаления - только для своих комментариев или модераторов */}
                    {canDelete && !commentsDisabled && (
                        <button 
                            className="delete-btn"
                            onClick={() => handleDelete(comment.id, isReply, actualRootCommentId)}
                        >
                            <FaTrash style={{ marginRight: '4px' }} />
                            Удалить
                        </button>
                    )}
                    
                    {/* Кнопка жалобы - для всех, кроме автора */}
                    {isLoggedIn && !isAuthor && comment.is_approved && (
                        <CommentReportButton
                            commentID={comment.id}
                            onReport={handleReportComment}
                            disabled={submittingReply}
                        />
                    )}
                    
                    {/* Кнопка показа ответов - только если есть ответы */}
                    {hasReplies && !commentsDisabled && (
                        <button 
                            className={`show-replies-btn ${isExpanded ? 'replies-expanded' : ''}`}
                            onClick={() => toggleReplies(comment.id)}
                            disabled={isLoading}
                        >
                            <FaChevronDown 
                                style={{ 
                                    marginRight: '4px',
                                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s'
                                }} 
                            />
                            {isLoading ? 'Загрузка...' : 
                                isExpanded ? 'Скрыть ответы' : 'Показать ответы'
                            }
                            {` (${replies.length})`}
                        </button>
                    )}
                </div>
                
                {/* Форма ответа */}
                {replyingTo === comment.id && comment.is_approved && !commentsDisabled && (
                    <div className="reply-form">
                        <div className="reply-to-indicator">
                            Ответ для <span className="reply-to-username">{comment.user.username}</span>
                        </div>
                        <div className="reply-input-wrapper">
                            <input
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Ваш ответ..."
                                className="reply-input-underlined"
                                autoFocus
                                disabled={submittingReply}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmitReply(comment.id, isReply);
                                    }
                                }}
                            />
                            <div className="input-underline"></div>
                        </div>
                        <div className="reply-actions">
                            <button 
                                onClick={() => handleSubmitReply(comment.id, isReply)}
                                disabled={!replyContent.trim() || submittingReply}
                                className="submit-reply-btn"
                            >
                                {submittingReply ? (
                                    <>
                                        <FaSpinner className="spinner-icon" /> Отправка...
                                    </>
                                ) : 'Ответить'}
                            </button>
                            <button 
                                onClick={() => {
                                    setReplyingTo(null);
                                    setReplyContent('');
                                }}
                                className="cancel-reply-btn"
                                disabled={submittingReply}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Отображение ответов */}
                {isExpanded && !commentsDisabled && (
                    <div className="replies-container">
                        {isLoading ? (
                            <div className="replies-loading">
                                <div className="small-spinner"></div>
                                <span>Загрузка ответов...</span>
                            </div>
                        ) : hasReplies ? (
                            replies.map(reply => renderComment(reply, true, actualRootCommentId))
                        ) : (
                            <div className="no-replies">
                                <FaCommentSlash style={{ marginRight: '8px' }} />
                                <span>Пока нет ответов</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Функция для отправки жалобы на комментарий (в родительском компоненте)
const handleReportComment = async (commentId: number, reason: string) => {
    try {
        await axios.post(
            `/api/mod/comments/${commentId}/complaint`,
            { reason },
            { withCredentials: true }
        );
    } catch (err: any) {
        console.error('Ошибка при отправке жалобы на комментарий:', err);
        throw err;
    }
};


  // Обработка нажатия Enter в основном поле комментария
  const handleCommentInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newComment.trim() && !submittingComment && !commentsDisabled) {
        handleSubmitComment(e);
      }
    }
  };

  if (loading && comments.length === 0 && !commentsDisabled) {
    return (
      <div className="comments-loading">
        <div className="spinner"></div>
        <p>Загрузка комментариев...</p>
      </div>
    );
  }

  return (
    <div className="comments-section">
      {commentsDisabled ? (
        <div className="comments-disabled-message">
          <FaCommentSlash size={32} color="#8c57ff" />
          <h3>Комментарии отключены автором</h3>
          <p>Автор публикации решил отключить возможность комментирования</p>
        </div>
      ) : (
        <>
          <div className="comments-header">
            <h3 className="comments-title">
              Комментарии {comments.length > 0 && `(${comments.length})`}
            </h3>
          </div>

          {/* Форма нового комментария */}
          {isLoggedIn ? (
            <div className="new-comment-form">
              <div className="comment-form-header">
                <img 
                  src={user?.image_url || '/default-avatar.png'} 
                  alt={user?.username}
                  className="current-user-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-avatar.png';
                  }}
                />
                <div className="comment-input-wrapper">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleCommentInputKeyDown}
                    placeholder="Добавьте комментарий..."
                    className="comment-input-underlined"
                    disabled={submittingComment}
                    maxLength={1000}
                  />
                  <div className="input-underline"></div>
                </div>
              </div>
              <div className="comment-form-footer">
                <span className="char-count">
                  {newComment.length}/1000
                </span>
                <button 
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="submit-comment-btn"
                >
                  {submittingComment ? 'Публикация...' : 'Опубликовать'}
                </button>
              </div>
            </div>
          ) : (
            <div className="login-prompt">
              <p>Войдите, чтобы оставлять комментарии</p>
            </div>
          )}

          {/* Список комментариев */}
          <div className="comments-list">
            {comments.length === 0 && !loading ? (
              <div className="no-comments">
                <div className="no-comments-icon">💬</div>
                <p>Пока нет комментариев. Будьте первым!</p>
              </div>
            ) : (
              comments.map(comment => renderComment(comment))
            )}
          </div>

          {/* Ошибка загрузки */}
          {error && (
            <div className="comments-error">
              <p>{error}</p>
              <button 
                onClick={() => fetchComments()} 
                className="retry-btn"
              >
                Попробовать снова
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommentsSection;