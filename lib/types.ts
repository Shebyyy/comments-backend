import { Role, TagType } from '@/lib/permissions';

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
  id?: string;
  anilist_user_id: number;
  username: string;
  profile_picture_url: string | null | undefined;
  role: Role;
  is_mod: boolean; // Keep for backward compatibility
  is_admin: boolean; // Keep for backward compatibility
  is_banned: boolean;
  ban_reason: string | null | undefined;
  ban_expires: Date | null | undefined;
  shadow_banned: boolean;
  shadow_ban_reason: string | null | undefined;
  shadow_ban_expires: Date | null | undefined;
  warning_count: number;
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
  root_comment_id: string | null;
  depth_level: number;
  content: string;
  upvotes: number;
  downvotes: number;
  total_votes: number;
  user_vote_type: number | null; // Current user's vote type
  is_deleted: boolean;
  deleted_by: number | null;
  delete_reason: string | null;
  is_edited: boolean;
  is_pinned: boolean;
  pin_expires: Date | null;
  edit_history: any; // JSON field storing edit history
  created_at: Date;
  updated_at: Date;
  username: string;
  profile_picture_url: string | null;
  is_mod: boolean;
  is_admin: boolean;
  role?: Role;
  tags?: CommentTag[];
  user?: {
    id?: string;
    anilist_user_id: number;
    is_mod: boolean;
    is_admin: boolean;
    role?: Role;
    username: string;
    profile_picture_url: string | null;
  };
  replies?: Comment[];
  reply_count?: number; // Total number of direct replies
  total_reply_count?: number; // Total number of all nested replies
}

export interface CommentVote {
  id: string;
  comment_id: string;
  user_id: number;
  vote_type: -1 | 0 | 1; // Added 0 for neutral
  created_at: Date;
}

export interface VoterInfo {
  user_id: number;
  username: string;
  profile_picture_url: string | null;
  role: Role;
  vote_type: -1 | 0 | 1;
  created_at: Date;
}

export interface VoterListResponse {
  comment_id: string;
  upvoters: VoterInfo[];
  downvoters: VoterInfo[];
  total_upvotes: number;
  total_downvotes: number;
  total_votes: number;
}

export interface VoteRequest {
  comment_id: string;
  vote_type: -1 | 1;
}

export interface VoteToggleRequest {
  comment_id: string;
  vote_action: 'up' | 'down' | 'neutral';
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
    role?: Role;
    created_at: Date;
  }[];
  downvotes: {
    user_id: number;
    username: string;
    profile_picture_url?: string;
    role?: Role;
    created_at: Date;
  }[];
}

// Enhanced response types for better frontend integration
export interface NestedCommentsResponse {
  comments: Comment[];
  hasMore: boolean;
  total: number;
  page: number;
  limit: number;
  max_depth: number;
}

export interface ThreadResponse {
  comment: Comment;
  replies: Comment[];
  thread_stats: {
    total_comments: number;
    max_depth: number;
    total_upvotes: number;
    total_downvotes: number;
  };
}

export interface EditHistory {
  id: string;
  comment_id: string;
  old_content: string;
  new_content: string;
  edited_by: number;
  edit_reason?: string;
  created_at: Date;
}

// Enhanced vote statistics
export interface VoteStatistics {
  total_votes: number;
  total_upvotes: number;
  total_downvotes: number;
  active_voters: number;
  voting_trends: {
    date: string;
    upvotes: number;
    downvotes: number;
  }[];
  depth_distribution: {
    depth: number;
    vote_count: number;
  }[];
}

// WebSocket message types for real-time updates
export interface WebSocketMessage {
  type: 'new_comment' | 'vote_update' | 'comment_delete' | 'user_ban' | 'role_change';
  data: any;
  timestamp: Date;
}

// Notification types
export interface Notification {
  id: string;
  user_id: number;
  type: 'reply' | 'vote' | 'mention' | 'moderation';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: Date;
}

// Enhanced comment request with additional features
export interface CreateCommentRequest {
  media_id: number;
  media_type?: MediaType;
  content: string;
  parent_comment_id?: string;
  mentions?: number[]; // Array of user IDs mentioned
}

export interface UpdateCommentRequest {
  content: string;
  edit_reason?: string;
}

// New role management interfaces
export interface RoleChangeRequest {
  target_user_id: number;
  new_role: Role;
  reason?: string;
}

export interface RoleChange {
  id: string;
  target_user_id: number;
  changed_by_user_id: number;
  old_role: Role;
  new_role: Role;
  reason?: string;
  created_at: Date;
}

// Comment tagging interfaces
export interface CommentTag {
  id: string;
  comment_id: string;
  tag_type: TagType;
  tagged_by_user_id: number;
  created_at: Date;
  expires_at: Date | null;
}

export interface CreateCommentTagRequest {
  comment_id: string;
  tag_type: TagType;
  expires_at?: Date;
}

// Shadow ban interfaces
export interface ShadowBanRequest {
  user_id: number;
  reason?: string;
  duration_hours?: number; // null for permanent
}

// Audit log interfaces
export interface AuditLog {
  id: string;
  user_id: number;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CreateAuditLogRequest {
  user_id: number;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}
