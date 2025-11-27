// components/CommentsSection.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.tsx';
import { Comment, CommentsResponse, CreateCommentRequest } from '../types/comment';
import CommentItem from './CommentItem.tsx';
import './CommentsSection.css';

interface CommentsSectionProps {
  postId: number;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ postId }) => {
  const { user, isLoggedIn } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchComments = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get<CommentsResponse>(
        `http://localhost:8080/api/comments/post/${postId}?page=${pageNum}&limit=50`,
        { withCredentials: true }
      );
      
      if (pageNum === 1) {
        setComments(response.data.comments);
      } else {
        setComments(prev => [...prev, ...response.data.comments]);
      }
      
      setHasMore(response.data.has_more);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Ошибка загрузки комментариев:', err);
      setError('Не удалось загрузить комментарии');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const commentData: CreateCommentRequest = {
        content: newComment.trim(),
        parent_id: null
      };

      const response = await axios.post(
        `http://localhost:8080/api/comments/post/${postId}`,
        commentData,
        { withCredentials: true }
      );

      setComments(prev => [...prev, response.data.comment]);
      setNewComment('');
    } catch (err: any) {
      console.error('Ошибка при создании комментария:', err);
      if (err.response?.status === 401) {
        alert('Необходимо авторизоваться для комментирования');
      } else {
        alert('Ошибка при отправке комментария');
      }
    }
  };

  // ✅ ИСПРАВЛЕНО: Тип возвращаемого значения - Promise<boolean>
  const handleSubmitReply = async (parentComment: Comment, content: string): Promise<boolean> => {
    if (!content.trim()) return false;

    try {
      const commentData: CreateCommentRequest = {
        content: content.trim(),
        parent_id: parentComment.id
      };

      const response = await axios.post(
        `http://localhost:8080/api/comments/post/${postId}`,
        commentData,
        { withCredentials: true }
      );

      setComments(prev => [...prev, response.data.comment]);
      return true; // ✅ Всегда возвращаем boolean
    } catch (err: any) {
      console.error('Ошибка при создании ответа:', err);
      if (err.response?.status === 401) {
        alert('Необходимо авторизоваться для ответа');
      } else {
        alert('Ошибка при отправке ответа');
      }
      return false; // ✅ Всегда возвращаем boolean
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Удалить комментарий?')) return;

    try {
      await axios.delete(
        `http://localhost:8080/api/comments/${commentId}`,
        { withCredentials: true }
      );
      
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      alert('Ошибка при удалении комментария');
    }
  };

  const loadMoreComments = () => {
    fetchComments(page + 1);
  };

  // Функция для построения дерева комментариев
  const buildCommentTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<number, Comment>();
    const rootComments: Comment[] = [];

    // Сначала создаем map для быстрого доступа
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Затем строим дерево
    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        // Это ответ - добавляем к родителю
        const parent = commentMap.get(comment.parent_id)!;
        if (!parent.replies) parent.replies = [];
        parent.replies.push(commentWithReplies);
      } else {
        // Это корневой комментарий
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  // Получаем дерево комментариев
  const commentTree = buildCommentTree(comments);

  const getUserBadge = (commentUser: any, currentUser: typeof user): string => {
    if (currentUser && commentUser.id === currentUser.id) {
      return 'Вы';
    }
    return 'Путешественник';
  };

  if (loading && comments.length === 0) {
    return (
      <div className="comments-loading">
        <div>Загрузка комментариев...</div>
      </div>
    );
  }

  return (
    <div className="comments-section">
      <h3 className="comments-title">
        Обсуждение {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* Форма нового комментария */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmitComment} className="comment-form">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Поделитесь вашими впечатлениями об этом месте..."
            rows={4}
            className="comment-textarea"
            required
            maxLength={1000}
          />
          <div className="form-footer">
            <span className="char-count">
              {newComment.length}/1000
            </span>
            <button 
              type="submit" 
              disabled={!newComment.trim()}
              className="submit-comment-btn"
            >
              📝 Опубликовать комментарий
            </button>
          </div>
        </form>
      ) : (
        <div className="login-prompt">
          <div className="login-prompt-icon">🔐</div>
          <p>Войдите, чтобы поделиться вашими впечатлениями</p>
        </div>
      )}

      {/* Список комментариев */}
      <div className="comments-list">
        {commentTree.length === 0 && !loading ? (
          <div className="no-comments">
            <div className="no-comments-icon">💬</div>
            <h4>Пока нет комментариев</h4>
            <p>Будьте первым, кто поделится впечатлениями об этом месте!</p>
          </div>
        ) : (
          <>
            {commentTree.map(comment => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                postId={postId}
                onReply={handleSubmitReply}
                onDelete={handleDeleteComment}
                getUserBadge={() => getUserBadge(comment.user, user)}
                depth={0}
              />
            ))}
            
            {hasMore && (
              <div className="load-more-container">
                <button 
                  onClick={loadMoreComments} 
                  className="load-more-btn"
                  disabled={loading}
                >
                  {loading ? 'Загрузка...' : '📖 Загрузить еще'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="comments-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button 
            onClick={() => fetchComments(1)} 
            className="retry-btn"
          >
            Повторить попытку
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentsSection;