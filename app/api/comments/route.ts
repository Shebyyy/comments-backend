import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreateCommentRequest, ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const tag = searchParams.get('tag') || 'general';
    const sortBy = searchParams.get('sort') || 'newest';

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
        console.warn('Optional auth failed:', error);
      }
    }

    const offset = (page - 1) * limit;

    // Fetch comments based on sort order
    let commentsResult;
    if (sortBy === 'top') {
      commentsResult = await db`
        SELECT 
          c.comment_id, c.user_id, c.media_id, c.parent_comment_id,
          c.content, c.tag, c.created_at, c.updated_at, c.deleted,
          c.upvotes, c.downvotes, c.total_votes, c.reply_count,
          c.username, c.profile_picture_url, c.is_mod, c.is_admin,
          cv.vote_type as user_vote_type
        FROM comments c
        LEFT JOIN comment_votes cv ON c.comment_id = cv.comment_id 
          AND cv.user_id = ${userId}
        WHERE c.media_id = ${mediaIdNum}
          AND c.parent_comment_id IS NULL 
          AND c.tag = ${tag}
          AND c.deleted = FALSE
        ORDER BY c.total_votes DESC, c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (sortBy === 'oldest') {
      commentsResult = await db`
        SELECT 
          c.comment_id, c.user_id, c.media_id, c.parent_comment_id,
          c.content, c.tag, c.created_at, c.updated_at, c.deleted,
          c.upvotes, c.downvotes, c.total_votes, c.reply_count,
          c.username, c.profile_picture_url, c.is_mod, c.is_admin,
          cv.vote_type as user_vote_type
        FROM comments c
        LEFT JOIN comment_votes cv ON c.comment_id = cv.comment_id 
          AND cv.user_id = ${userId}
        WHERE c.media_id = ${mediaIdNum}
          AND c.parent_comment_id IS NULL 
          AND c.tag = ${tag}
          AND c.deleted = FALSE
        ORDER BY c.created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      commentsResult = await db`
        SELECT 
          c.comment_id, c.user_id, c.media_id, c.parent_comment_id,
          c.content, c.tag, c.created_at, c.updated_at, c.deleted,
          c.upvotes, c.downvotes, c.total_votes, c.reply_count,
          c.username, c.profile_picture_url, c.is_mod, c.is_admin,
          cv.vote_type as user_vote_type
        FROM comments c
        LEFT JOIN comment_votes cv ON c.comment_id = cv.comment_id 
          AND cv.user_id = ${userId}
        WHERE c.media_id = ${mediaIdNum}
          AND c.parent_comment_id IS NULL 
          AND c.tag = ${tag}
          AND c.deleted = FALSE
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Get total count
    const countResult = await db`
      SELECT COUNT(*) as total
      FROM comments c
      WHERE c.media_id = ${mediaIdNum}
        AND c.parent_comment_id IS NULL 
        AND c.tag = ${tag}
        AND c.deleted = FALSE
    `;

    const total = parseInt(countResult.rows[0].total);

    // Fetch replies for each comment
    const commentsWithReplies = await Promise.all(
      commentsResult.rows.map(async (comment: any) => {
        const repliesResult = await db`
          SELECT 
            c.comment_id, c.user_id, c.media_id, c.parent_comment_id,
            c.content, c.tag, c.created_at, c.updated_at, c.deleted,
            c.upvotes, c.downvotes, c.total_votes, c.reply_count,
            c.username, c.profile_picture_url, c.is_mod, c.is_admin,
            cv.vote_type as user_vote_type
          FROM comments c
          LEFT JOIN comment_votes cv ON c.comment_id = cv.comment_id 
            AND cv.user_id = ${userId}
          WHERE c.parent_comment_id = ${comment.comment_id} 
            AND c.deleted = FALSE
          ORDER BY c.created_at ASC
          LIMIT 10
        `;

        return {
          ...comment,
          replies: repliesResult.rows
        };
      })
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comments: commentsWithReplies,
        hasMore: offset + commentsResult.rows.length < total,
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
    await checkRateLimit(anilistUser.id, 'comment');

    // Upsert user
    const user = await upsertUser(anilistUser);

    const body: CreateCommentRequest = await request.json();
    const { media_id, content, parent_comment_id, tag = 'general' } = body;

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

    // Check if parent comment exists
    if (parent_comment_id) {
      const parentResult = await db`
        SELECT comment_id, media_id, deleted 
        FROM comments 
        WHERE comment_id = ${parent_comment_id}
      `;

      if (parentResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Parent comment not found'
        }, { status: 404 });
      }

      const parentComment = parentResult.rows[0];
      if (parentComment.deleted) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Cannot reply to deleted comment'
        }, { status: 400 });
      }

      if (parentComment.media_id !== media_id) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Parent comment media_id mismatch'
        }, { status: 400 });
      }
    }

    // Insert comment
    const result = await db`
      INSERT INTO comments (
        user_id, media_id, parent_comment_id, content, tag,
        username, profile_picture_url, is_mod, is_admin
      ) VALUES (
        ${user.anilist_user_id},
        ${media_id},
        ${parent_comment_id || null},
        ${content.trim()},
        ${tag},
        ${user.username},
        ${user.profile_picture_url || null},
        ${user.is_mod},
        ${user.is_admin}
      )
      RETURNING *
    `;

    const newComment = {
      ...result.rows[0],
      user_vote_type: null,
      replies: []
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: newComment,
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
