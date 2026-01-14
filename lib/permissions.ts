import { User, Comment, ActionType } from '@/lib/types';

export enum Permission {
  READ_COMMENTS = 'read_comments',
  CREATE_COMMENT = 'create_comment',
  EDIT_OWN_COMMENT = 'edit_own_comment',
  DELETE_OWN_COMMENT = 'delete_own_comment',
  DELETE_ANY_COMMENT = 'delete_any_comment',
  BAN_USER = 'ban_user'
}

export const ROLE_PERMISSIONS = {
  user: [
    Permission.READ_COMMENTS,
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT
  ],
  mod: [
    Permission.READ_COMMENTS,
    Permission.CREATE_COMMENT,
    Permission.EDIT_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.DELETE_ANY_COMMENT
  ],
  admin: Object.values(Permission)
};

export function getUserRole(user: User): 'user' | 'mod' | 'admin' {
  if (user.is_admin) return 'admin';
  if (user.is_mod) return 'mod';
  return 'user';
}

export function hasPermission(user: User, permission: Permission): boolean {
  const role = getUserRole(user);
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canDeleteComment(comment: Comment, user: User): boolean {
  // User can delete their own comment
  if (comment.anilist_user_id === user.anilist_user_id) {
    return true;
  }
  
  // Mods can delete any comment except admin comments
  if (user.is_mod && !comment.is_admin) {
    return true;
  }
  
  // Admins can delete any comment
  if (user.is_admin) {
    return true;
  }
  
  return false;
}

export function canEditComment(comment: Comment, user: User): boolean {
  // Only original author can edit, and only if not deleted
  return comment.anilist_user_id === user.anilist_user_id && !comment.is_deleted;
}