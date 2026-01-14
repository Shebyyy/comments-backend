import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canDeleteComment } from '@/lib/permissions';
import { ApiResponse } from '@/lib/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Authorization header required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const anilistUser = await verifyAniListToken(token);
    
    // Check rate limit
    await checkRateLimit(anilistUser.id, 'delete', db);

    const commentId = params.id;
    if (!commentId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment ID is required'
      }, { status: 400 });
    }

    // Get comment with user data
    const commentResult = await db.query(`
      SELECT c.*, u.anilist_user_id, u.is_mod as user_is_mod, u.is_admin as user_is_admin
      FROM comments c
      JOIN users u ON c.user_id = u.anilist_user_id
      WHERE c.comment_id = $1 AND c.deleted = FALSE
    `, [commentId]);

    if (commentResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    const comment = commentResult.rows[0];
    const requestingUser = {
      anilist_user_id: anilistUser.id,
      is_mod: anilistUser.moderatorStatus === 'MODERATOR' || anilistUser.moderatorStatus === 'ADMIN',
      is_admin: anilistUser.moderatorStatus === 'ADMIN'
    };

    // Check permissions
    if (!canDeleteComment(comment, requestingUser)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to delete this comment'
      }, { status: 403 });
    }

    // Soft delete the comment
    const deleteReason = comment.user_id === anilistUser.id 
      ? '[deleted by user]' 
      : '[deleted by moderator]';

    await db.query(`
      UPDATE comments 
      SET 
        deleted = TRUE,
        deleted_at = NOW(),
        content = $1
      WHERE comment_id = $2
    `, [deleteReason, commentId]);

    // If moderator/admin is deleting, also delete all replies recursively
    if (requestingUser.is_mod || requestingUser.is_admin) {
      await deleteRepliesRecursively(commentId, db);
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

async function deleteRepliesRecursively(parentCommentId: string, db: any) {
  // Get all direct replies
  const repliesResult = await db.query(`
    SELECT comment_id
    FROM comments 
    WHERE parent_comment_id = $1 AND deleted = FALSE
  `, [parentCommentId]);

  // Delete each reply and its children
  for (const reply of repliesResult.rows) {
    await db.query(`
      UPDATE comments 
      SET 
        deleted = TRUE,
        deleted_at = NOW(),
        content = '[deleted by moderator]'
      WHERE comment_id = $1
    `, [reply.comment_id]);

    // Recursively delete nested replies
    await deleteRepliesRecursively(reply.comment_id, db);
  }
}
