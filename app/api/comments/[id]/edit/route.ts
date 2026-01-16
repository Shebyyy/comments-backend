import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canEditComment, getUserRole, Role } from '@/lib/permissions';
import { EditCommentRequest, ApiResponse } from '@/lib/types';
import { logUserAction } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;

    // Convert commentId from string to number (Comment.id is now Int in schema)
    const commentIdNumber = parseInt(commentId, 10);

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
    await checkRateLimit(anilistUser.id, 'edit', db);

    const body: EditCommentRequest = await request.json();
    const { content, reason } = body;

    // Validate input
    if (!content || content.trim().length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Content is required'
      }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment content too long (max 2000 characters)'
      }, { status: 400 });
    }

    // Get comment with user data
    const comment = await db.comment.findUnique({
      where: { id: commentIdNumber },
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
    if (!canEditComment(transformedComment, user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to edit this comment'
      }, { status: 403 });
    }

    // Store edit history
    const currentEditHistory = comment.edit_history as any[] || [];
    const newEditEntry = {
      content: comment.content,
      edited_at: new Date().toISOString(),
      reason: reason || null
    };

    // Update comment with edit history
    const updatedComment = await db.comment.update({
      where: { id: commentIdNumber },
      data: {
        content: content.trim(),
        is_edited: true,
        updated_at: new Date(),
        edit_history: [...currentEditHistory, newEditEntry]
      },
      include: {
        user: {
          select: {
            id: true,
            anilist_user_id: true,
            username: true,
            profile_picture_url: true,
            is_mod: true,
            is_admin: true,
            role: true
          }
        },
        tags: true
      }
    });

    // Create audit log
    await logUserAction(request, user.anilist_user_id, 'EDIT_COMMENT', 'comment', commentIdNumber, {
      original_content: comment.content,
      new_content: content.trim(),
      reason: reason || null,
      depth_level: comment.depth_level
    });

    // Format response
    const formattedComment = {
      id: updatedComment.id,
      media_id: updatedComment.media_id,
      media_type: updatedComment.media_type,
      parent_comment_id: updatedComment.parent_comment_id,
      root_comment_id: updatedComment.root_comment_id,
      depth_level: updatedComment.depth_level,
      content: updatedComment.content,
      anilist_user_id: updatedComment.anilist_user_id,
      upvotes: updatedComment.upvotes,
      downvotes: updatedComment.downvotes,
      is_deleted: updatedComment.is_deleted,
      is_edited: updatedComment.is_edited,
      is_pinned: updatedComment.is_pinned,
      pin_expires: updatedComment.pin_expires,
      edit_history: updatedComment.edit_history,
      created_at: updatedComment.created_at,
      updated_at: updatedComment.updated_at,
      username: updatedComment.user.username,
      profile_picture_url: updatedComment.user.profile_picture_url,
      is_mod: updatedComment.user.is_mod,
      is_admin: updatedComment.user.is_admin,
      role: updatedComment.user.role,
      tags: updatedComment.tags
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: formattedComment,
      message: 'Comment updated successfully'
    });

  } catch (error) {
    console.error('PATCH comment error:', error);
    
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