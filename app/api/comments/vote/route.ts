import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken } from '@/app/api/auth/verify';
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
    const comment = await db.comment.findUnique({
      where: { id: comment_id }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    if (comment.is_deleted) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot vote on deleted comment'
      }, { status: 400 });
    }

    // Prevent voting on own comments
    if (comment.anilist_user_id === anilistUser.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot vote on your own comment'
      }, { status: 400 });
    }

    // Upsert vote (insert or update)
    const existingVote = await db.vote.findUnique({
      where: {
        comment_id_user_id: {
          comment_id: comment_id,
          user_id: anilistUser.id
        }
      }
    });

    let vote;
    if (existingVote) {
      // Update existing vote
      if (existingVote.vote_type === vote_type) {
        // Remove vote if same vote type
        await db.vote.delete({
          where: {
            comment_id_user_id: {
              comment_id: comment_id,
              user_id: anilistUser.id
            }
          }
        });
        vote = null;
      } else {
        // Update vote type
        vote = await db.vote.update({
          where: {
            comment_id_user_id: {
              comment_id: comment_id,
              user_id: anilistUser.id
            }
          },
          data: {
            vote_type: vote_type
          }
        });
      }
    } else {
      // Create new vote
      vote = await db.vote.create({
        data: {
          comment_id: comment_id,
          user_id: anilistUser.id,
          vote_type: vote_type
        }
      });
    }

    // Update comment vote counts
    const votes = await db.vote.findMany({
      where: { comment_id: comment_id }
    });

    const upvotes = votes.filter(v => v.vote_type === 1).length;
    const downvotes = votes.filter(v => v.vote_type === -1).length;

    // Update comment with new vote counts
    await db.comment.update({
      where: { id: comment_id },
      data: {
        upvotes,
        downvotes
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        vote_type: vote ? vote.vote_type : 0,
        upvotes,
        downvotes,
        total_votes: upvotes + downvotes
      },
      message: vote ? 'Vote recorded successfully' : 'Vote removed successfully'
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