import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreateCommentRequest, Comment, ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');
    const mediaType = searchParams.get('media_type') || 'ANIME';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const sortBy = searchParams.get('sort') || 'newest';
    const parentId = searchParams.get('parent_id');

    if (!mediaId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'media_id is required'
      }, { status: 400 });
    }

    const mediaIdNum = parseInt(mediaId);
    if (isNaN(mediaIdNum)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid media_id'
      }, { status: 400 });
    }

    // Get auth token (optional for read access)
    const authHeader = request.headers.get('authorization');
    let userId: number | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const anilistUser = await verifyAniListToken(token);
        userId = anilistUser.id;
      } catch (error) {
        // Token verification failed, but allow read access
        console.warn('Optional auth failed:', error);
      }
    }

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      media_id: mediaIdNum,
      media_type: mediaType,
      parent_comment_id: parentId || null,
      is_deleted: false
    };

    // Build order by
    let orderBy: any = { created_at: 'desc' };
    if (sortBy === 'top') {
      orderBy = [
        { upvotes: 'desc' },
        { created_at: 'desc' }
      ];
    } else if (sortBy === 'oldest') {
      orderBy = { created_at: 'asc' };
    }

    // Fetch comments
    const comments = await db.comment.findMany({
      where: whereClause,
      orderBy,
      include: {
        user: true,
        votes: userId ? {
          where: { user_id: userId }
        } : false,
        replies: {
          where: { is_deleted: false },
          orderBy: { created_at: 'asc' },
          take: 10,
          include: {
            user: true,
            votes: userId ? {
              where: { user_id: userId }
            } : false
          }
        }
      },
      skip: offset,
      take: limit
    });

    // Get total count
    const total = await db.comment.count({
      where: whereClause
    });

    // Format response
    const formattedComments = comments.map(comment => ({
      id: comment.id,
      media_id: comment.media_id,
      media_type: comment.media_type,
      content: comment.content,
      anilist_user_id: comment.anilist_user_id,
      parent_comment_id: comment.parent_comment_id,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      user_vote: comment.votes.length > 0 ? comment.votes[0].vote_type : 0,
      is_mod: comment.user.is_mod,
      is_admin: comment.user.is_admin,
      is_deleted: comment.is_deleted,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      username: comment.user.username,
      profile_picture_url: comment.user.profile_picture_url,
      replies: comment.replies.map(reply => ({
        id: reply.id,
        media_id: reply.media_id,
        media_type: reply.media_type,
        content: reply.content,
        anilist_user_id: reply.anilist_user_id,
        parent_comment_id: reply.parent_comment_id,
        upvotes: reply.upvotes,
        downvotes: reply.downvotes,
        user_vote: reply.votes.length > 0 ? reply.votes[0].vote_type : 0,
        is_mod: reply.user.is_mod,
        is_admin: reply.user.is_admin,
        is_deleted: reply.is_deleted,
        created_at: reply.created_at,
        updated_at: reply.updated_at,
        username: reply.user.username,
        profile_picture_url: reply.user.profile_picture_url
      }))
    }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comments: formattedComments,
        hasMore: offset + comments.length < total,
        total,
        page,
        limit
      }
    });

  } catch (error) {
    console.error('GET comments error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    await checkRateLimit(anilistUser.id, 'comment', db);

    // Upsert user
    const user = await upsertUser(anilistUser, db);

    const body: CreateCommentRequest = await request.json();
    const { media_id, media_type, content, parent_comment_id } = body;

    // Validate input
    if (!media_id || !content || content.trim().length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'media_id and content are required'
      }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment content too long (max 2000 characters)'
      }, { status: 400 });
    }

    // Check if parent comment exists (if provided)
    if (parent_comment_id) {
      const parentComment = await db.comment.findUnique({
        where: { id: parent_comment_id }
      });

      if (!parentComment) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Parent comment not found'
        }, { status: 404 });
      }

      if (parentComment.is_deleted) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Cannot reply to deleted comment'
        }, { status: 400 });
      }

      if (parentComment.media_id !== parseInt(media_id)) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Parent comment media_id mismatch'
        }, { status: 400 });
      }
    }

    // Create comment
    const newComment = await db.comment.create({
      data: {
        media_id: parseInt(media_id),
        media_type: media_type || 'ANIME',
        content: content.trim(),
        anilist_user_id: user.anilist_user_id,
        parent_comment_id: parent_comment_id || null,
        user: {
          connect: { anilist_user_id: user.anilist_user_id }
        }
      },
      include: {
        user: true
      }
    });

    // Format response
    const formattedComment = {
      id: newComment.id,
      media_id: newComment.media_id,
      media_type: newComment.media_type,
      content: newComment.content,
      anilist_user_id: newComment.anilist_user_id,
      parent_comment_id: newComment.parent_comment_id,
      upvotes: newComment.upvotes,
      downvotes: newComment.downvotes,
      user_vote: 0,
      is_mod: newComment.user.is_mod,
      is_admin: newComment.user.is_admin,
      is_deleted: newComment.is_deleted,
      created_at: newComment.created_at,
      updated_at: newComment.updated_at,
      username: newComment.user.username,
      profile_picture_url: newComment.user.profile_picture_url,
      replies: []
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: formattedComment,
      message: 'Comment created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('POST comments error:', error);
    
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