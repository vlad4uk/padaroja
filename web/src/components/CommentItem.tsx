import React, { useState } from 'react';
import { Comment } from '../types/comment';
import { useAuth } from '../context/AuthContext.tsx';

interface CommentItemProps {
  comment: Comment;
  depth: number;
  postId: number;
  onReply: (parentComment: Comment, content: string) => Promise<boolean>;
  onDelete: (commentId: number) => void;
  getUserBadge: () => string;
}

const CommentItem: React.FC<CommentItemProps> = ({ 
  comment, 
  depth,
  postId,
  onReply,
  onDelete,
  getUserBadge
}) => {
  const { user, isLoggedIn } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const commentLevel = Math.min(depth, 4);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    setReplying(true);
    try {
      const success = await onReply(comment, replyContent);
      if (success) {
        setReplyContent('');
        setShowReplyForm(false);
        setShowReplies(true);
      }
    } finally {
      setReplying(false);
    }
  };

  const handleDelete = () => {
    onDelete(comment.id);
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={`comment-item comment-level-${commentLevel}`}>
      {comment.parent && comment.parent.user && (
        <div className="reply-indicator">
          <span className="reply-arrow">↳</span>
          Ответ для {comment.parent.user.username}
        </div>
      )}

      <div className="comment-header">
        <div className="comment-author">
          <img 
            src={comment.user.image_url || '/default-avatar.png'} 
            alt={comment.user.username}
            className="comment-avatar"
          />
          <div className="comment-user-info">
            <span className="comment-username">{comment.user.username}</span>
            <span className="comment-user-badge">
              {getUserBadge()}
            </span>
          </div>
        </div>
        <span className="comment-date">
          {new Date(comment.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>

      <div className="comment-content">
        {comment.content}
      </div>

      <div className="comment-actions">
        {isLoggedIn && (
          <button 
            className="comment-action-btn"
            onClick={() => setShowReplyForm(!showReplyForm)}
            disabled={replying}
          >
            <span>💬</span>
            {replying ? '...' : 'Ответить'}
          </button>
        )}
        
        {comment.user_id === user?.id && (
          <button 
            className="comment-action-btn comment-delete"
            onClick={handleDelete}
          >
            <span>🗑️</span>
            Удалить
          </button>
        )}

        {/* Кнопка показа/скрытия ответов */}
        {hasReplies && (
          <button 
            className="comment-action-btn"
            onClick={() => setShowReplies(!showReplies)}
          >
            <span>{showReplies ? '▼' : '▶'}</span>
            {showReplies ? 'Скрыть ответы' : 'Показать ответы'}
            {` (${comment.replies!.length})`}
          </button>
        )}
      </div>

      {/* Форма ответа */}
      {showReplyForm && isLoggedIn && (
        <div className="reply-form">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={`Ваш ответ для ${comment.user.username}...`}
            rows={3}
            className="reply-textarea"
            disabled={replying}
          />
          <div className="reply-actions">
            <button 
              onClick={handleSubmitReply}
              disabled={!replyContent.trim() || replying}
              className="submit-reply-btn"
            >
              {replying ? 'Отправка...' : 'Отправить ответ'}
            </button>
            <button 
              onClick={() => {
                setShowReplyForm(false);
                setReplyContent('');
              }}
              className="cancel-reply-btn"
              disabled={replying}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Вложенные ответы */}
      {hasReplies && showReplies && (
        <div className="comment-replies">
          {comment.replies!.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              depth={depth + 1}
              postId={postId}
              onReply={onReply}
              onDelete={onDelete}
              getUserBadge={getUserBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;