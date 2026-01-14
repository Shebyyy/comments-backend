import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreateCommentRequest, Comment, ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per request
    const tag = searchParams.get('tag') || 'general';
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

    // Build query
    let orderBy = 'ORDER BY c.created_at DESC';
    if (sortBy === 'top') {
      orderBy = 'ORDER BY c.total_votes DESC, c.created_at DESC';
    } else if (sortBy === 'oldest') {
      orderBy = 'ORDER BY c.created_at ASC';
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        c.comment_id, c.user_id, c.media_id, c.parent_comment_id,
        c.content, c.tag, c.created_at, c.updated_at, c.deleted,
        c.upvotes, c.downvotes, c.total_votes, c.reply_count,
        c.username, c.profile_picture_url, c.is_mod, c.is_admin,
        cv.vote_type as user_vote_type
      FROM comments c
      LEFT JOIN comment_votes cv ON c.comment_id = cv.comment_id 
        AND cv.user_id = $1
      WHERE c.media_id = $2 
        AND c.parent_comment_id IS NULL 
        AND c.tag = $3 
        AND c.deleted = FALSE
      ${orderBy}
      LIMIT $4 OFFSET $5
    `;

    const commentsResult = await db.query(query, [
      userId, mediaIdNum, tag, limit, offset
    ]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM comments c
      WHERE c.media_id = $1 
        AND c.parent_comment_id IS NULL 
        AND c.tag = $2 
        AND c.deleted = FALSE
    `, [mediaIdNum, tag]);

    const total = parseInt(countResult.rows[0].total);

    // Fetch replies for each comment
    const commentsWithReplies = await Promise.all(
      commentsResult.rows.map(async (comment) => {
        const repliesQuery = `
          SELECT 
            c.comment_id, c.user_id, c.media_id, c.parent_comment_id,
            c.content, c.tag, c.created_at, c.updated_at, c.deleted,
            c.upvotes, c.downvotes, c.total_votes, c.reply_count,
            c.username, c.profile_picture_url, c.is_mod, c.is_admin,
            cv.vote_type as user_vote_type
          FROM comments c
          LEFT JOIN comment_votes cv ON c.comment_id = cv.comment_id 
            AND cv.user_id = $1
          WHERE c.parent_comment_id = $2 AND c.deleted = FALSE
          ORDER BY c.created_at ASC
          LIMIT 10
        `;

        const repliesResult = await db.query(repliesQuery, [userId, comment.comment_id]);

        return {
          ...comment,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          replies: repliesResult.rows.map(reply => ({
            ...reply,
            created_at: reply.created_at,
            updated_at: reply.updated_at
          }))
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
    await checkRateLimit(anilistUser.id, 'comment', db);

    // Upsert user
    const user = await upsertUser(anilistUser, db);

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

    // Check if parent comment exists (if provided)
    if (parent_comment_id) {
      const parentResult = await db.query(`
        SELECT comment_id, media_id, deleted FROM comments 
        WHERE comment_id = $1
      `, [parent_comment_id]);

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
    const insertQuery = `
      INSERT INTO comments (
        user_id, media_id, parent_comment_id, content, tag,
        username, profile_picture_url, is_mod, is_admin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      user.anilist_user_id,
      media_id,
      parent_comment_id || null,
      content.trim(),
      tag,
      user.username,
      user.profile_picture_url,
      user.is_mod,
      user.is_admin
    ]);

    const newComment = {
      ...result.rows[0],
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
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