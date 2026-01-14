import { User, Comment, ActionType } from '@/lib/types';

export enum Permission {
  READ_COMMENTS = 'read_comments',
  CREATE_COMMENT = 'create_comment',
  EDIT_OWN_COMMENT = 'edit_own_comment',
  DELETE_OWN_COMMENT = 'delete_own_comment',
  DELETE_ANY_COMMENT = 'delete_any_comment',
  BAN_USER = 'ban_user',
  WARN_USER = 'warn_user',
  PROMOTE_DEMOTE = 'promote_demote',
  VIEW_REPORTS = 'view_reports',
  REVIEW_REPORTS = 'review_reports',
  VOTE_OWN_COMMENT = 'vote_own_comment',
  VIEW_VOTES = 'view_votes',
  REPORT_COMMENT = 'report_comment',
  OVERRIDE_ALL = 'override_all'
}

export const ROLE_PERMISSIONS = {
  user: [
    Permission.READ_COMMENTS,
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.VOTE_OWN_COMMENT,
    Permission.REPORT_COMMENT
  ],
  mod: [
    Permission.READ_COMMENTS,
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.DELETE_ANY_COMMENT,
    Permission.WARN_USER,
    Permission.VIEW_REPORTS,
    Permission.REVIEW_REPORTS,
    Permission.VOTE_OWN_COMMENT,
    Permission.VIEW_VOTES,
    Permission.REPORT_COMMENT
  ],
  admin: Object.values(Permission),
  super_admin: Object.values(Permission)
};

export function getUserRole(user: User): 'user' | 'mod' | 'admin' | 'super_admin' {
  // Super admin (ASheby - 5724017) has highest priority
  if (user.anilist_user_id === 5724017) return 'super_admin';
  if (user.is_admin) return 'admin';
  if (user.is_mod) return 'mod';
  return 'user';
}

export function hasPermission(user: User, permission: Permission): boolean {
  const role = getUserRole(user);
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isSuperAdmin(user: User): boolean {
  return user.anilist_user_id === 5724017;
}

export function canDeleteComment(comment: Comment, user: User): boolean {
  // Admin override - can delete anything
  if (user.is_admin) {
    return true;
  }
  
  // User can delete their own comment
  if (comment.anilist_user_id === user.anilist_user_id) {
    return true;
  }
  
  // Mods can delete any comment except admin comments
  if (user.is_mod && !comment.is_admin) {
    return true;
  }
  
  return false;
}

export function canEditComment(comment: Comment, user: User): boolean {
  // Only original author can edit, and only if not deleted
  return comment.anilist_user_id === user.anilist_user_id && !comment.is_deleted;
}

export function canVoteOnOwnComment(user: User): boolean {
  return hasPermission(user, Permission.VOTE_OWN_COMMENT);
}

export function canBanUser(user: User): boolean {
  return hasPermission(user, Permission.BAN_USER);
}

export function canWarnUser(user: User): boolean {
  return hasPermission(user, Permission.WARN_USER);
}

export function canPromoteDemote(user: User): boolean {
  return hasPermission(user, Permission.PROMOTE_DEMOTE);
}

export function canViewReports(user: User): boolean {
  return hasPermission(user, Permission.VIEW_REPORTS);
}

export function canReviewReports(user: User): boolean {
  return hasPermission(user, Permission.REVIEW_REPORTS);
}

export function canViewVotes(user: User): boolean {
  return hasPermission(user, Permission.VIEW_VOTES);
}

export function canReportComment(user: User): boolean {
  return hasPermission(user, Permission.REPORT_COMMENT);
}

export function hasOverridePermission(user: User): boolean {
  return isSuperAdmin(user) || hasPermission(user, Permission.OVERRIDE_ALL);
}

export function isBanned(user: User): boolean {
  if (!user.is_banned || !user.ban_expires) {
    return user.is_banned || false;
  }
  
  // Check if ban has expired
  return new Date() < user.ban_expires;
}