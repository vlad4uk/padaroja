// types/comment.ts
export interface CommentUser {
  id: number;
  username: string;
  image_url: string;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  is_approved: boolean;
  created_at: string;
  user: CommentUser;
  parent?: Comment; // ✅ ДОБАВЛЕНО: информация о родительском комментарии
  replies?: Comment[]; // ✅ ДОБАВЛЕНО: вложенные ответы
}

export interface CreateCommentRequest {
  content: string;
  parent_id?: number | null;
}

export interface CommentsResponse {
  comments: Comment[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

