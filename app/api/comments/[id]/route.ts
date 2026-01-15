import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canDeleteComment, hasOverridePermission } from '@/lib/permissions';
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
            anilist_user_id: true,
            is_mod: true,
            is_admin: true,
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
      edit_history: comment.edit_history as any[] || [] // Properly cast edit_history
    };

    const requestingUser = {
      anilist_user_id: anilistUser.id,
      username: anilistUser.name,
      profile_picture_url: anilistUser.avatar?.large || anilistUser.avatar?.medium,
      is_mod: user.is_mod,
      is_admin: user.is_admin,
      created_at: new Date(),
      updated_at: new Date(),
      last_active: new Date()
    };

    // Check permissions with admin override
    if (!hasOverridePermission(requestingUser) && !canDeleteComment(transformedComment, requestingUser)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to delete this comment'
      }, { status: 403 });
    }

    // Soft delete the comment
    const deleteReason = transformedComment.anilist_user_id === anilistUser.id 
      ? '[deleted by user]' 
      : (requestingUser.is_admin ? '[deleted by admin]' : '[deleted by moderator]');

    await db.comment.update({
      where: {
        id: commentId
      },
      data: {
        is_deleted: true,
        updated_at: new Date(),
        content: deleteReason
      }
    });

    // If moderator/admin is deleting, also delete all replies recursively
    if (requestingUser.is_mod || requestingUser.is_admin) {
      await deleteRepliesRecursively(commentId, db, requestingUser.is_admin ? '[deleted by admin]' : '[deleted by moderator]');
    }

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

async function deleteRepliesRecursively(parentCommentId: string, db: any, deleteReason: string) {
  // Get all direct replies
  const replies = await db.comment.findMany({
    where: {
      parent_comment_id: parentCommentId,
      is_deleted: false
    },
    select: {
      id: true
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

    // Recursively delete nested replies
    await deleteRepliesRecursively(reply.id, db, deleteReason);
  }
}
