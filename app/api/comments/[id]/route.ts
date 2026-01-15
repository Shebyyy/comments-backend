import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canDeleteComment, getUserRole, Role } from '@/lib/permissions';
import { ApiResponse } from '@/lib/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Authorization header required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const anilistUser = await verifyAniListToken(token);
    
    // Upsert user to get current permissions
    const user = await upsertUser(anilistUser, db);
    
    // Check rate limit
    await checkRateLimit(anilistUser.id, 'delete', db);
    if (!commentId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment ID is required'
      }, { status: 400 });
    }

    // Get comment with user data
    const comment = await db.comment.findUnique({
      where: {
        id: commentId,
        is_deleted: false
      },
      include: {
        user: {
          select: {
            id: true,
            anilist_user_id: true,
            is_mod: true,
            is_admin: true,
            role: true,
            username: true,
            profile_picture_url: true
          }
        }
      }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    // Transform to match Comment interface
    const transformedComment = {
      ...comment,
      username: comment.user.username,
      profile_picture_url: comment.user.profile_picture_url,
      is_mod: comment.user.is_mod,
      is_admin: comment.user.is_admin,
      role: comment.user.role,
      user: comment.user,
      edit_history: comment.edit_history as any[] || []
    };

    // Check permissions using new role system
    if (!canDeleteComment(transformedComment, user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to delete this comment'
      }, { status: 403 });
    }

    const userRole = getUserRole(user);
    const deleteReason = transformedComment.anilist_user_id === anilistUser.id 
      ? '[deleted by user]' 
      : (userRole === Role.ADMIN ? '[deleted by admin]' : '[deleted by moderator]');

    // Soft delete the comment (preserve thread structure)
    await db.comment.update({
      where: {
        id: commentId
      },
      data: {
        is_deleted: true,
        deleted_by: user.anilist_user_id,
        delete_reason: deleteReason,
        updated_at: new Date(),
        content: '[deleted]' // Keep placeholder for thread structure
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        user_id: user.anilist_user_id,
        action: 'DELETE_COMMENT',
        target_type: 'comment',
        target_id: commentId,
        details: {
          original_content: comment.content,
          reason: deleteReason,
          is_self_delete: transformedComment.anilist_user_id === anilistUser.id,
          depth_level: comment.depth_level,
          parent_comment_id: comment.parent_comment_id
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent')
      }
    });

    // Note: For Reddit-like behavior, we DON'T delete replies when a comment is deleted
    // Replies remain visible and maintain thread structure even if parent is deleted
    // This preserves conversation context and thread integrity

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('DELETE comment error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: error.message
        }, { status: 429 });
      }
      
      if (error.message.includes('Invalid') || error.message.includes('required')) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: error.message
        }, { status: 400 });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function deleteRepliesRecursively(parentCommentId: string, db: any, deleteReason: string, deleterUserId: number, request: NextRequest) {
  // Get all direct replies
  const replies = await db.comment.findMany({
    where: {
      parent_comment_id: parentCommentId,
      is_deleted: false
    },
    select: {
      id: true,
      content: true
    }
  });

  // Delete each reply and its children
  for (const reply of replies) {
    await db.comment.update({
      where: {
        id: reply.id
      },
      data: {
        is_deleted: true,
        updated_at: new Date(),
        content: deleteReason
      }
    });

    // Create audit log for reply deletion
    await db.auditLog.create({
      data: {
        user_id: deleterUserId,
        action: 'DELETE_REPLY',
        target_type: 'comment',
        target_id: reply.id,
        details: {
          original_content: reply.content,
          reason: deleteReason,
          parent_comment_id: parentCommentId
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent')
      }
    });

    // Recursively delete nested replies
    await deleteRepliesRecursively(reply.id, db, deleteReason, deleterUserId, request);
  }
}
