export interface AniListUser {
  id: number;
  name: string;
  avatar?: {
    large?: string;
    medium?: string;
  };
  moderatorStatus?: string;
}

export interface User {
  anilist_user_id: number;
  username: string;
  profile_picture_url?: string;
  is_mod: boolean;
  is_admin: boolean;
  is_banned?: boolean;
  ban_reason?: string;
  ban_expires?: Date;
  warning_count?: number;
  created_at: Date;
  updated_at: Date;
  last_active: Date;
}

export type MediaType = 'ANIME' | 'MANGA';

export interface Comment {
  id: string;
  anilist_user_id: number;
  media_id: number;
  media_type: MediaType;
  parent_comment_id: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  is_deleted: boolean;
  is_edited?: boolean;
  edit_history?: EditHistory[];
  created_at: Date;
  updated_at: Date;
  username: string;
  profile_picture_url: string | null;
  is_mod: boolean;
  is_admin: boolean;
  user?: {
    anilist_user_id: number;
    is_mod: boolean;
    is_admin: boolean;
    username: string;
    profile_picture_url: string | null;
  };
  replies?: Comment[];
}

export interface EditHistory {
  content: string;
  edited_at: Date;
  reason?: string;
}

export interface CommentVote {
  id: string;
  comment_id: string;
  user_id: number;
  vote_type: -1 | 1;
  created_at: Date;
}

export interface CreateCommentRequest {
  media_id: number;
  media_type?: MediaType;
  content: string;
  parent_comment_id?: string;
}

export interface VoteRequest {
  comment_id: string;
  vote_type: -1 | 1;
}

export interface CommentsResponse {
  comments: Comment[];
  hasMore: boolean;
  total: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type ActionType = 'comment' | 'vote' | 'delete' | 'edit' | 'report' | 'ban' | 'warn';

export interface RateLimitConfig {
  max: number;
  window: number; // in minutes
}

export interface RateLimit {
  id: string;
  user_id: number;
  action_type: ActionType;
  action_count: number;
  window_start: Date;
  window_end: Date;
}

// Report interfaces
export interface Report {
  id: string;
  comment_id: string;
  reporter_user_id: number;
  reason: string;
  description?: string;
  status: ReportStatus;
  reviewed_by?: number;
  review_note?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReportRequest {
  comment_id: string;
  reason: string;
  description?: string;
}

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

// Ban interfaces
export interface Ban {
  id: string;
  user_id: number;
  banned_by: number;
  reason: string;
  duration_hours?: number;
  is_permanent: boolean;
  is_active: boolean;
  created_at: Date;
  expires_at?: Date;
}

export interface CreateBanRequest {
  user_id: number;
  reason: string;
  duration_hours?: number;
  is_permanent?: boolean;
}

// Warning interfaces
export interface Warning {
  id: string;
  user_id: number;
  warned_by: number;
  reason: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
}

export interface CreateWarningRequest {
  user_id: number;
  reason: string;
  description?: string;
}

// Admin action interfaces
export interface AdminActionRequest {
  user_id: number;
  action: 'promote' | 'demote';
  role: 'mod' | 'admin';
}

export interface EditCommentRequest {
  content: string;
  reason?: string;
}

// Vote viewing interface
export interface VoteListResponse {
  comment_id: string;
  upvotes: {
    user_id: number;
    username: string;
    profile_picture_url?: string;
    created_at: Date;
  }[];
  downvotes: {
    user_id: number;
    username: string;
    profile_picture_url?: string;
    created_at: Date;
  }[];
}
