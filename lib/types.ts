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
  created_at: Date;
  updated_at: Date;
  last_active: Date;
}

export enum MediaType {
  ANIME = 'ANIME',
  MANGA = 'MANGA'
}

export interface Comment {
  id: string;
  anilist_user_id: number;
  media_id: number;
  media_type: MediaType;
  parent_comment_id?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  username: string;
  profile_picture_url?: string;
  is_mod: boolean;
  is_admin: boolean;
  user?: {
    anilist_user_id: number;
    is_mod: boolean;
    is_admin: boolean;
  };
  replies?: Comment[];
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
  content: string;
  parent_comment_id?: string;
  tag?: string;
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

export type ActionType = 'comment' | 'vote' | 'delete';

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