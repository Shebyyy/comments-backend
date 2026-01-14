import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canEditComment } from '@/lib/permissions';
import { EditCommentRequest, ApiResponse } from '@/lib/types';

export async function PUT(
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
      is_admin: comment.user.is_admin
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

    // Check permissions
    if (!canEditComment(transformedComment, requestingUser)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to edit this comment'
      }, { status: 403 });
    }

    // Get current edit history
    const currentHistory = comment.edit_history as any[] || [];
    
    // Add current content to edit history
    const newEditEntry = {
      content: comment.content,
      edited_at: new Date(),
      reason: reason || null
    };

    const updatedHistory = [...currentHistory, newEditEntry];

    // Update comment
    const updatedComment = await db.comment.update({
      where: {
        id: commentId
      },
      data: {
        content: content.trim(),
        is_edited: true,
        edit_history: updatedHistory,
        updated_at: new Date()
      },
      include: {
        user: true
      }
    });

    // Format response
    const formattedComment = {
      id: updatedComment.id,
      media_id: updatedComment.media_id,
      media_type: updatedComment.media_type,
      content: updatedComment.content,
      anilist_user_id: updatedComment.anilist_user_id,
      parent_comment_id: updatedComment.parent_comment_id,
      upvotes: updatedComment.upvotes,
      downvotes: updatedComment.downvotes,
      is_edited: updatedComment.is_edited,
      edit_history: updatedComment.edit_history,
      is_deleted: updatedComment.is_deleted,
      created_at: updatedComment.created_at,
      updated_at: updatedComment.updated_at,
      username: updatedComment.user.username,
      profile_picture_url: updatedComment.user.profile_picture_url,
      is_mod: updatedComment.user.is_mod,
      is_admin: updatedComment.user.is_admin,
      replies: []
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: formattedComment,
      message: 'Comment updated successfully'
    });

  } catch (error) {
    console.error('PUT comment error:', error);
    
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