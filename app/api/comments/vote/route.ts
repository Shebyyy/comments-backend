import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db/connection';
import { verifyAniListToken } from '@/app/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { VoteRequest, ApiResponse } from '@/lib/types';

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
    await checkRateLimit(anilistUser.id, 'vote', db);

    const body: VoteRequest = await request.json();
    const { comment_id, vote_type } = body;

    // Validate input
    if (!comment_id || !vote_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'comment_id and vote_type are required'
      }, { status: 400 });
    }

    if (![1, -1].includes(vote_type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'vote_type must be 1 (upvote) or -1 (downvote)'
      }, { status: 400 });
    }

    // Check if comment exists and is not deleted
    const commentResult = await db.query(`
      SELECT comment_id, deleted, user_id as comment_author_id
      FROM comments 
      WHERE comment_id = $1
    `, [comment_id]);

    if (commentResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    const comment = commentResult.rows[0];
    if (comment.deleted) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot vote on deleted comment'
      }, { status: 400 });
    }

    // Prevent voting on own comments
    if (comment.comment_author_id === anilistUser.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot vote on your own comment'
      }, { status: 400 });
    }

    // Upsert vote (insert or update)
    const voteQuery = `
      INSERT INTO comment_votes (comment_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (comment_id, user_id) 
      DO UPDATE SET 
        vote_type = EXCLUDED.vote_type,
        created_at = NOW()
      RETURNING vote_type
    `;

    const voteResult = await db.query(voteQuery, [comment_id, anilistUser.id, vote_type]);
    const newVoteType = voteResult.rows[0].vote_type;

    // Get updated comment vote counts
    const updatedCommentResult = await db.query(`
      SELECT upvotes, downvotes, total_votes
      FROM comments 
      WHERE comment_id = $1
    `, [comment_id]);

    const updatedComment = updatedCommentResult.rows[0];

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        vote_type: newVoteType,
        upvotes: updatedComment.upvotes,
        downvotes: updatedComment.downvotes,
        total_votes: updatedComment.total_votes
      },
      message: 'Vote recorded successfully'
    });

  } catch (error) {
    console.error('POST vote error:', error);
    
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