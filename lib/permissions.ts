import { User, Comment, ActionType } from '@/lib/types';
import { Role as PrismaRole } from '@prisma/client';

// Re-export Prisma Role as our Role for consistency
export const Role = PrismaRole;

// Create a type alias for Role using different name to avoid conflict
export type RoleType = PrismaRole;

export enum Permission {
  // User Management
  PROMOTE_DEMOTE_SUPER_ADMIN = 'promote_demote_super_admin',
  PROMOTE_DEMOTE_ADMIN = 'promote_demote_admin',
  PROMOTE_DEMOTE_MODERATOR = 'promote_demote_moderator',
  BAN_USERS = 'ban_users',
  WARN_USERS = 'warn_users',
  SHADOW_BAN_USERS = 'shadow_ban_users',
  
  // Comment Management
  CREATE_COMMENT = 'create_comment',
  EDIT_OWN_COMMENT = 'edit_own_comment',
  DELETE_OWN_COMMENT = 'delete_own_comment',
  EDIT_ANY_COMMENT = 'edit_any_comment',
  DELETE_ANY_COMMENT = 'delete_any_comment',
  EDIT_OWN_REPLY = 'edit_own_reply',
  DELETE_OWN_REPLY = 'delete_own_reply',
  DELETE_ANY_REPLY = 'delete_any_reply',
  
  // Comment Features
  VOTE_COMMENT = 'vote_comment',
  VOTE_OWN_COMMENT = 'vote_own_comment',
  TAG_SPOILER = 'tag_spoiler',
  TAG_PINNED = 'tag_pinned',
  TAG_WARNING = 'tag_warning',
  
  // Moderation
  VIEW_REPORTS = 'view_reports',
  REVIEW_REPORTS = 'review_reports',
  VIEW_VOTE_HISTORY = 'view_vote_history',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  
  // System
  OVERRIDE_ALL = 'override_all'
}

export const ROLE_PERMISSIONS = {
  [Role.SUPER_ADMIN]: Object.values(Permission),
  [Role.ADMIN]: [
    Permission.PROMOTE_DEMOTE_MODERATOR,
    Permission.BAN_USERS,
    Permission.WARN_USERS,
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.EDIT_OWN_REPLY,
    Permission.DELETE_OWN_REPLY,
    Permission.VOTE_COMMENT,
    Permission.VOTE_OWN_COMMENT,
    Permission.VIEW_REPORTS,
    Permission.REVIEW_REPORTS
  ],
  [Role.MODERATOR]: [
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.DELETE_ANY_COMMENT,
    Permission.EDIT_OWN_REPLY,
    Permission.DELETE_OWN_REPLY,
    Permission.DELETE_ANY_REPLY,
    Permission.VOTE_COMMENT,
    Permission.VOTE_OWN_COMMENT,
    Permission.TAG_SPOILER,
    Permission.TAG_PINNED,
    Permission.TAG_WARNING,
    Permission.VIEW_REPORTS,
    Permission.REVIEW_REPORTS
  ],
  [Role.USER]: [
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.EDIT_OWN_REPLY,
    Permission.DELETE_OWN_REPLY,
    Permission.VOTE_COMMENT,
    Permission.VOTE_OWN_COMMENT
  ]
};

export function getUserRole(user: User): RoleType {
  // Check for shadow ban first
  if (user.shadow_banned && (!user.shadow_ban_expires || new Date() < user.shadow_ban_expires)) {
    return Role.USER; // Shadow banned users appear as regular users
  }
  
  // Use new role system (role is now guaranteed to exist)
  return user.role;
}

export function hasPermission(user: User, permission: Permission): boolean {
  const role = getUserRole(user);
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canPromoteDemote(actor: User, target: User, newRole: RoleType): boolean {
  const actorRole = getUserRole(actor);
  const targetRole = getUserRole(target);
  
  // Super Admin can do anything
  if (actorRole === Role.SUPER_ADMIN) return true;
  
  // Admin can only promote/demote to Moderator
  if (actorRole === Role.ADMIN) {
    return newRole === Role.MODERATOR && targetRole !== Role.SUPER_ADMIN;
  }
  
  return false;
}

export function canDeleteComment(comment: Comment, user: User): boolean {
  const userRole = getUserRole(user);
  
  // Super Admin can delete anything
  if (userRole === Role.SUPER_ADMIN) return true;
  
  // User can delete their own comment
  if (comment.anilist_user_id === user.anilist_user_id) return true;
  
  // Moderator can delete any comment except from Super Admin
  if (userRole === Role.MODERATOR) {
    if (!comment.user) return false; // Cannot check role if user is undefined
    const commentAuthorRole = comment.user.role || Role.USER; // Use partial user's role directly
    return commentAuthorRole !== Role.SUPER_ADMIN;
  }
  
  return false;
}

export function canEditComment(comment: Comment, user: User): boolean {
  const userRole = getUserRole(user);
  
  // Super Admin can edit any comment
  if (userRole === Role.SUPER_ADMIN) return true;
  
  // Only original author can edit their own comment
  return comment.anilist_user_id === user.anilist_user_id && !comment.is_deleted;
}

export function canDeleteReply(reply: Comment, user: User): boolean {
  const userRole = getUserRole(user);
  
  // Super Admin can delete anything
  if (userRole === Role.SUPER_ADMIN) return true;
  
  // User can delete their own reply
  if (reply.anilist_user_id === user.anilist_user_id) return true;
  
  // Moderator can delete any reply except from Super Admin
  if (userRole === Role.MODERATOR) {
    const replyAuthorRole = getUserRole(reply.user);
    return replyAuthorRole !== Role.SUPER_ADMIN;
  }
  
  return false;
}

export function canEditReply(reply: Comment, user: User): boolean {
  const userRole = getUserRole(user);
  
  // Super Admin can edit any reply
  if (userRole === Role.SUPER_ADMIN) return true;
  
  // Only original author can edit their own reply
  return reply.anilist_user_id === user.anilist_user_id && !reply.is_deleted;
}

export function canReplyToComment(comment: Comment, user: User): boolean {
  // Users can reply to any non-deleted comment
  // This includes replying to deleted comments to preserve thread structure
  if (comment.is_deleted) {
    // Allow replies to deleted comments for thread continuity
    return true;
  }
  
  // Check depth limit to prevent infinite nesting
  if (comment.depth_level >= 20) {
    return false;
  }
  
  return true;
}

export function canTagComment(user: User, tagType: string): boolean {
  const userRole = getUserRole(user);
  
  switch (tagType) {
    case 'SPOILER':
    case 'WARNING':
      return userRole === Role.SUPER_ADMIN || userRole === Role.MODERATOR;
    case 'PINNED':
      return userRole === Role.SUPER_ADMIN || userRole === Role.MODERATOR;
    default:
      return false;
  }
}

export function canBanUser(user: User): boolean {
  return hasPermission(user, Permission.BAN_USERS);
}

export function canWarnUser(user: User): boolean {
  return hasPermission(user, Permission.WARN_USERS);
}

export function canShadowBanUser(user: User): boolean {
  return hasPermission(user, Permission.SHADOW_BAN_USERS);
}

export function canViewReports(user: User): boolean {
  return hasPermission(user, Permission.VIEW_REPORTS);
}

export function canReviewReports(user: User): boolean {
  return hasPermission(user, Permission.REVIEW_REPORTS);
}

export function canViewVoteHistory(user: User): boolean {
  return hasPermission(user, Permission.VIEW_VOTE_HISTORY);
}

export function canViewAuditLogs(user: User): boolean {
  return hasPermission(user, Permission.VIEW_AUDIT_LOGS);
}

export function canVoteOnOwnComment(user: User): boolean {
  return hasPermission(user, Permission.VOTE_OWN_COMMENT);
}

export function canReportComment(user: User): boolean {
  return getUserRole(user) !== Role.USER; // Only mods and above can report
}

export function hasOverridePermission(user: User): boolean {
  return hasPermission(user, Permission.OVERRIDE_ALL);
}

export function isBanned(user: User): boolean {
  if (!user.is_banned || !user.ban_expires) {
    return user.is_banned || false;
  }
  
  // Check if ban has expired
  return new Date() < user.ban_expires;
}

export function isShadowBanned(user: User): boolean {
  if (!user.shadow_banned) return false;
  
  // Check if shadow ban has expired
  if (user.shadow_ban_expires) {
    return new Date() < user.shadow_ban_expires;
  }
  
  return true; // Permanent shadow ban
}

export function canViewVotes(user: User): boolean {
  const userRole = getUserRole(user);
  return userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN || userRole === Role.MODERATOR;
}

export function isSuperAdmin(user: User): boolean {
  return getUserRole(user) === Role.SUPER_ADMIN;
}

// Legacy functions for backward compatibility
// Note: canPromoteDemote legacy function removed to avoid duplicate definition
// Use the main canPromoteDemote(actor, target, newRole) function instead
