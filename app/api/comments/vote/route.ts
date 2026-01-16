import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { VoteRequest, ApiResponse, VoterListResponse } from '@/lib/types';
import { logUserAction } from '@/lib/audit';

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
    
    // Upsert user to get current permissions
    const user = await upsertUser(anilistUser, db);
    
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

    // Check if comment exists (allow voting on replies in nested threads)
    const comment = await db.comment.findUnique({
      where: { id: comment_id },
      include: {
        user: {
          select: {
            anilist_user_id: true,
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

    // Allow voting on replies even if parent is deleted, but not on deleted comments themselves
    if (comment.is_deleted) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot vote on deleted comment'
      }, { status: 400 });
    }

    // ALL users can vote on all comments including their own
    // No restriction on voting on own comments

    // Get existing vote
    const existingVote = await db.vote.findUnique({
      where: {
        comment_id_user_id: {
          comment_id: comment_id,
          user_id: anilistUser.id
        }
      }
    });

    let newVoteType: number | null = vote_type;
    
    // Implement vote toggle logic: up → neutral → down → up
    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // Same vote: remove vote (go to neutral)
        await db.vote.delete({
          where: {
            comment_id_user_id: {
              comment_id: comment_id,
              user_id: anilistUser.id
            }
          }
        });
        newVoteType = null;
      } else {
        // Different vote: change vote type
        await db.vote.update({
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
      // No existing vote: create new vote
      await db.vote.create({
        data: {
          comment_id: comment_id,
          user_id: anilistUser.id,
          vote_type: vote_type
        }
      });
    }

    // Update comment vote counts with optimized query
    const voteCounts = await db.vote.groupBy({
      by: ['vote_type'],
      where: { comment_id: comment_id },
      _count: {
        vote_type: true
      }
    });

    const upvotes = voteCounts.find(v => v.vote_type === 1)?._count.vote_type || 0;
    const downvotes = voteCounts.find(v => v.vote_type === -1)?._count.vote_type || 0;
    const totalVotes = upvotes + downvotes;

    // Update comment with new vote counts
    await db.comment.update({
      where: { id: comment_id },
      data: {
        upvotes,
        downvotes,
        total_votes: totalVotes
      }
    });

    // Log vote action
    await logUserAction(request, anilistUser.id, 'VOTE', 'comment', String(comment_id), {
      vote_type: newVoteType,
      previous_vote_type: existingVote?.vote_type || null,
      comment_depth: comment.depth_level,
      total_votes_after: totalVotes
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        vote_type: newVoteType || 0,
        upvotes,
        downvotes,
        total_votes: totalVotes,
        user_vote_type: newVoteType
      },
      message: newVoteType 
        ? `Vote ${newVoteType === 1 ? 'up' : 'down'} recorded successfully` 
        : 'Vote removed successfully'
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('comment_id');

    if (!commentId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'comment_id is required'
      }, { status: 400 });
    }

    // Get auth token (optional for read access)
    const authHeader = request.headers.get('authorization');
    let currentUserId: number | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const anilistUser = await verifyAniListToken(token);
        currentUserId = anilistUser.id;
      } catch (error) {
        // Token verification failed, but allow read access
        console.warn('Optional auth failed:', error);
      }
    }

    // Check if comment exists
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            anilist_user_id: true,
            username: true,
            profile_picture_url: true,
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

    // Get current user's vote if authenticated
    let userVote: number | null = null;
    if (currentUserId) {
      const userVoteRecord = await db.vote.findUnique({
        where: {
          comment_id_user_id: {
            comment_id: commentId,
            user_id: currentUserId
          }
        }
      });
      userVote = userVoteRecord?.vote_type || null;
    }

    // Get vote counts
    const voteCounts = await db.vote.groupBy({
      by: ['vote_type'],
      where: { comment_id: commentId },
      _count: {
        vote_type: true
      }
    });

    const upvotes = voteCounts.find(v => v.vote_type === 1)?._count.vote_type || 0;
    const downvotes = voteCounts.find(v => v.vote_type === -1)?._count.vote_type || 0;
    const totalVotes = upvotes + downvotes;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comment_id: commentId,
        upvotes,
        downvotes,
        total_votes: totalVotes,
        user_vote_type: userVote,
        is_deleted: comment.is_deleted
      }
    });

  } catch (error) {
    console.error('GET vote error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}