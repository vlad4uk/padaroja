// components/CommentsSection.tsx (исправленный)
import React, { useState, useEffect, useCallback, ReactElement } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.tsx';
import { Comment, CommentsResponse, CreateCommentRequest } from '../types/comment';
import { FaCommentSlash, FaReply, FaChevronDown, FaSpinner, FaTrash, FaHeart } from 'react-icons/fa';
import './CommentsSection.css';

interface CommentsSectionProps {
  postId: number;
  commentsDisabled?: boolean;
}

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

  // Загрузка ВСЕХ комментариев
  const fetchComments = useCallback(async () => {
    if (commentsDisabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Проверяем, существует ли эндпоинт, пробуем разные варианты
      let response;
      try {
        response = await axios.get<CommentsResponse>(
          `/api/comments/post/${postId}`,
          { withCredentials: true }
        );
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Пробуем альтернативный эндпоинт
          response = await axios.get<CommentsResponse>(
            `/api/posts/${postId}/comments`,
            { withCredentials: true }
          );
        } else {
          throw err;
        }
      }
      
      const allComments = response.data.comments || response.data || [];
      
      // Фильтруем корневые комментарии
      const rootComments = allComments.filter((comment: Comment) => !comment.parent_id);
      setComments(rootComments);
      
      // Группируем ответы
      const repliesByParentId: Record<number, Comment[]> = {};
      
      allComments.forEach((comment: Comment) => {
        if (comment.parent_id) {
          if (!repliesByParentId[comment.parent_id]) {
            repliesByParentId[comment.parent_id] = [];
          }
          repliesByParentId[comment.parent_id].push(comment);
        }
      });
      
      // Инициализируем состояния
      const initialReplyStates: Record<number, ReplyState> = {};
      
      rootComments.forEach((comment: Comment) => {
        initialReplyStates[comment.id] = {
          replies: repliesByParentId[comment.id] || [],
          loading: false,
          expanded: false
        };
      });
      
      // Для вложенных ответов
      Object.keys(repliesByParentId).forEach(parentIdStr => {
        const parentId = parseInt(parentIdStr);
        const replies = repliesByParentId[parentId];
        
        replies.forEach(reply => {
          if (repliesByParentId[reply.id]) {
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
      if (err.response?.status === 404) {
        // Если эндпоинт не найден, просто показываем пустой список
        setComments([]);
        setError('');
      } else {
        setError('Не удалось загрузить комментарии');
      }
    } finally {
      setLoading(false);
    }
  }, [postId, commentsDisabled]);

  // Загрузка ответов
  const fetchReplies = async (commentId: number) => {
    try {
      setReplyStates(prev => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          loading: true
        }
      }));
      
      let response;
      try {
        response = await axios.get(
          `/api/comments/${commentId}/replies`,
          { withCredentials: true }
        );
      } catch (err: any) {
        if (err.response?.status === 404) {
          response = await axios.get(
            `/api/comments/${commentId}/children`,
            { withCredentials: true }
          );
        } else {
          throw err;
        }
      }
      
      setReplyStates(prev => {
        const existingReplies = prev[commentId]?.replies || [];
        const newReplies = response.data.replies || response.data || [];
        
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

      const newCommentObj = response.data.comment || response.data;
      
      setComments(prev => [newCommentObj, ...prev]);
      
      setReplyStates(prev => ({
        ...prev,
        [newCommentObj.id]: {
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
      } else if (err.response?.status === 404) {
        alert('Сервис комментариев временно недоступен');
      } else {
        alert('Ошибка при отправке комментария');
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // Отправка ответа
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

      const targetId = isReplyToReply ? findRootComment(parentId)?.id || parentId : parentId;
      
      if (targetId) {
        setReplyStates(prev => {
          const currentReplies = prev[targetId]?.replies || [];
          return {
            ...prev,
            [targetId]: {
              ...prev[targetId],
              replies: [...currentReplies, response.data.comment || response.data],
              expanded: true
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

  const findRootComment = (commentId: number): Comment | null => {
    const rootComment = comments.find(comment => comment.id === commentId);
    if (rootComment) return rootComment;

    for (const rootId in replyStates) {
      const replyState = replyStates[parseInt(rootId)];
      const reply = replyState.replies.find(reply => reply.id === commentId);
      if (reply) {
        return comments.find(comment => comment.id === parseInt(rootId)) || null;
      }
    }

    return null;
  };

  const handleDelete = async (commentId: number, isReply = false, rootCommentId?: number) => {
    if (!window.confirm('Удалить комментарий?')) return;

    try {
      await axios.delete(
        `/api/comments/${commentId}`,
        { withCredentials: true }
      );
      
      if (isReply && rootCommentId) {
        setReplyStates(prev => ({
          ...prev,
          [rootCommentId]: {
            ...prev[rootCommentId],
            replies: prev[rootCommentId]?.replies?.filter(reply => reply.id !== commentId) || []
          }
        }));
      } else {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        const newReplyStates = { ...replyStates };
        delete newReplyStates[commentId];
        setReplyStates(newReplyStates);
      }
    } catch (err) {
      alert('Ошибка при удалении комментария');
    }
  };

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
      
      if (shouldFetch && (!currentState?.replies || currentState.replies.length === 0)) {
        setTimeout(() => fetchReplies(commentId), 0);
      }
      
      return newState;
    });
  };

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

  const handleReportComment = async (commentId: number, reason: string) => {
    try {
      await axios.post(
        `/api/mod/comments/${commentId}/complaint`,
        { reason },
        { withCredentials: true }
      );
      alert('Жалоба отправлена');
    } catch (err: any) {
      console.error('Ошибка при отправке жалобы:', err);
      throw err;
    }
  };

  const renderComment = (comment: Comment, isReply = false, rootCommentId?: number): ReactElement => {
    const replyState = replyStates[comment.id];
    const replies = replyState?.replies || [];
    const hasReplies = replies.length > 0;
    const isExpanded = replyState?.expanded || false;
    const isLoading = replyState?.loading || false;
    
    const actualRootCommentId = rootCommentId || (isReply ? findRootComment(comment.id)?.id : comment.id);
    const isAuthor = comment.user_id === user?.id;
    const canDelete = isAuthor || user?.role_id === 2;

    return (
      <div key={comment.id} className={`comment-item ${isReply ? 'comment-reply' : ''}`}>
        <div className="comment-avatar-container">
          <img 
            src={comment.user?.image_url || '/default-avatar.png'} 
            alt={comment.user?.username || 'User'}
            className="comment-avatar"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.png';
            }}
          />
        </div>
        
        <div className="comment-content-wrapper">
          <div className="comment-header">
            <span className="comment-username">
              {comment.user?.username || 'Пользователь'}
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
          
          <div className="comment-actions">
            {isLoggedIn && comment.is_approved && !commentsDisabled && (
              <button 
                className="reply-btn"
                onClick={() => {
                  setReplyingTo(comment.id);
                  setReplyContent(`@${comment.user?.username || ''} `);
                }}
              >
                <FaReply style={{ marginRight: '4px' }} />
                Ответить
              </button>
            )}
            
            {canDelete && !commentsDisabled && (
              <button 
                className="delete-btn"
                onClick={() => handleDelete(comment.id, isReply, actualRootCommentId)}
              >
                <FaTrash style={{ marginRight: '4px' }} />
                Удалить
              </button>
            )}
            
            {isLoggedIn && !isAuthor && comment.is_approved && (
              <button 
                className="report-btn"
                onClick={() => {
                  const reason = prompt('Укажите причину жалобы:');
                  if (reason) {
                    handleReportComment(comment.id, reason);
                  }
                }}
              >
                <FaHeart style={{ marginRight: '4px' }} />
                Пожаловаться
              </button>
            )}
            
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
          
          {replyingTo === comment.id && comment.is_approved && !commentsDisabled && (
            <div className="reply-form">
              <div className="reply-to-indicator">
                Ответ для <span className="reply-to-username">{comment.user?.username || 'пользователя'}</span>
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

          {isLoggedIn ? (
            <div className="new-comment-form">
              <div className="comment-form-header">
                <img 
                  src={user?.image_url || '/default-avatar.png'} 
                  alt={user?.username || 'User'}
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