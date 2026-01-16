import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canDeleteComment } from '@/lib/permissions';
import { ApiResponse } from '@/lib/types';
import { logUserAction } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;

    const comment = await db.comment.findUnique({
      where: { id: parseInt(commentId, 10) },
      include: {
        user: {
          select: {
            id: true,
            anilist_user_id: true,
            username: true,
            profile_picture_url: true,
            is_mod: true,
            is_admin: true,
            role: true,
            is_banned: true,
            shadow_banned: true
          }
        },
        votes: true,
        tags: true
      }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    const upvotes = comment.votes.filter(vote => vote.vote_type === 1).length;
    const downvotes = comment.votes.filter(vote => vote.vote_type === -1).length;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: comment.id,
        media_id: comment.media_id,
        media_type: comment.media_type,
        parent_comment_id: comment.parent_comment_id,
        root_comment_id: comment.root_comment_id,
        depth_level: comment.depth_level,
        content: comment.is_deleted ? '[deleted]' : comment.content,
        anilist_user_id: comment.anilist_user_id,
        upvotes,
        downvotes,
        total_votes: upvotes + downvotes,
        is_deleted: comment.is_deleted,
        deleted_by: comment.deleted_by,
        delete_reason: comment.delete_reason,
        is_edited: comment.is_edited,
        is_pinned: comment.is_pinned,
        pin_expires: comment.pin_expires,
        edit_history: comment.edit_history,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        username: comment.user?.username || 'Unknown',
        profile_picture_url: comment.user?.profile_picture_url || null,
        is_mod: comment.user?.is_mod || false,
        is_admin: comment.user?.is_admin || false,
        role: comment.user?.role,
        tags: comment.tags
      }
    });
  } catch (error) {
    console.error('Get comment error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

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
    const rateLimitResult = await checkRateLimit(anilistUser.id, 'delete_comment');
    if (!rateLimitResult.allowed) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 });
    }

    // Get comment with user data
    const comment = await db.comment.findUnique({
      where: { id: parseInt(commentId, 10) },
      include: {
        user: {
          select: {
            id: true,
            anilist_user_id: true,
            username: true,
            is_mod: true,
            is_admin: true,
            role: true
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

    // Check permissions using new role system
    if (!canDeleteComment(comment, user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Permission denied'
      }, { status: 403 });
    }

    // Soft delete the comment (preserve thread structure)
    await db.comment.update({
      where: { id: parseInt(commentId, 10) },
      data: {
        is_deleted: true,
        deleted_by: user.anilist_user_id,
        delete_reason: null,
        content: '[deleted]'
      }
    });

    // Create audit log
    await logUserAction(request, user.anilist_user_id, 'delete_comment', 'comment', String(comment.id), {
      comment_id: comment.id,
      original_content: comment.content
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
