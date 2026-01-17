import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { VoteRequest, ApiResponse } from '@/lib/types';
import { logUserAction } from '@/lib/audit';
import { calculateWilsonScore } from '@/lib/ranking';

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

    // Check if comment exists
    const comment = await db.comment.findUnique({
      where: { id: comment_id },
      include: {
        user: {
          select: {
            anilist_user_id: true
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

    if (comment.is_deleted) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot vote on deleted comment'
      }, { status: 400 });
    }

    // Get existing vote to determine stat changes for the author
    const existingVote = await db.vote.findUnique({
      where: {
        comment_id_user_id: {
          comment_id: comment_id,
          user_id: anilistUser.id
        }
      }
    });

    let upvoteChange = 0;
    let downvoteChange = 0;
    let newVoteType: number | null = vote_type;

    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // REMOVE VOTE
        await db.vote.delete({
          where: {
            comment_id_user_id: {
              comment_id: comment_id,
              user_id: anilistUser.id
            }
          }
        });
        upvoteChange = vote_type === 1 ? -1 : 0;
        downvoteChange = vote_type === -1 ? -1 : 0;
        newVoteType = null;
      } else {
        // SWAP VOTE (e.g., Up to Down)
        await db.vote.update({
          where: {
            comment_id_user_id: {
              comment_id: comment_id,
              user_id: anilistUser.id
            }
          },
          data: { vote_type: vote_type }
        });
        upvoteChange = vote_type === 1 ? 1 : -1;
        downvoteChange = vote_type === -1 ? 1 : -1;
      }
    } else {
      // NEW VOTE
      await db.vote.create({
        data: {
          comment_id: comment_id,
          user_id: anilistUser.id,
          vote_type: vote_type
        }
      });
      upvoteChange = vote_type === 1 ? 1 : 0;
      downvoteChange = vote_type === -1 ? 1 : 0;
    }

    // 1. Update comment vote cache
    const voteCounts = await db.vote.groupBy({
      by: ['vote_type'],
      where: { comment_id: comment_id },
      _count: { vote_type: true }
    });

    const upvotes = voteCounts.find(v => v.vote_type === 1)?._count.vote_type || 0;
    const downvotes = voteCounts.find(v => v.vote_type === -1)?._count.vote_type || 0;
    const totalVotes = upvotes + downvotes;

    await db.comment.update({
      where: { id: comment_id },
      data: {
        upvotes,
        downvotes,
        total_votes: totalVotes
      }
    });

    // 2. LIVE RANKING UPDATE: Update Author's lifetime stats and Wilson Score
    const updatedAuthor = await db.user.update({
      where: { anilist_user_id: comment.anilist_user_id },
      data: {
        total_upvotes: { increment: upvoteChange },
        total_downvotes: { increment: downvoteChange }
      }
    });

    // Calculate new rank using Wilson Score logic
    const newRankScore = calculateWilsonScore(
      Math.max(0, updatedAuthor.total_upvotes),
      Math.max(0, updatedAuthor.total_downvotes)
    );

    // Save the new rank score to the author
    await db.user.update({
      where: { anilist_user_id: updatedAuthor.anilist_user_id },
      data: { rank_score: newRankScore }
    });

    // Log the action
    await logUserAction(request, anilistUser.id, 'VOTE', 'comment', String(comment_id), {
      vote_type: newVoteType,
      previous_vote_type: existingVote?.vote_type || null,
      author_rank_after: newRankScore
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        vote_type: newVoteType || 0,
        upvotes,
        downvotes,
        total_votes: totalVotes,
        user_vote_type: newVoteType,
        author_rank_score: newRankScore
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

    const authHeader = request.headers.get('authorization');
    let currentUserId: number | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const anilistUser = await verifyAniListToken(token);
        currentUserId = anilistUser.id;
      } catch (error) {
        console.warn('Optional auth failed:', error);
      }
    }

    const comment = await db.comment.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    let userVote: number | null = null;
    if (currentUserId) {
      const userVoteRecord = await db.vote.findUnique({
        where: {
          comment_id_user_id: {
            comment_id: parseInt(commentId),
            user_id: currentUserId
          }
        }
      });
      userVote = userVoteRecord?.vote_type || null;
    }

    const voteCounts = await db.vote.groupBy({
      by: ['vote_type'],
      where: { comment_id: parseInt(commentId) },
      _count: { vote_type: true }
    });

    const upvotes = voteCounts.find(v => v.vote_type === 1)?._count.vote_type || 0;
    const downvotes = voteCounts.find(v => v.vote_type === -1)?._count.vote_type || 0;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comment_id: parseInt(commentId),
        upvotes,
        downvotes,
        total_votes: upvotes + downvotes,
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
