import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { VoteRequest, ApiResponse } from '@/lib/types';
import { logUserAction } from '@/lib/audit';
import { calculateUserLevel } from '@/lib/ranking';

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

    // Check if comment exists and get author details
    const comment = await db.comment.findUnique({
      where: { id: comment_id },
      include: {
        user: {
          select: {
            anilist_user_id: true,
            _count: {
              select: { comments: { where: { is_deleted: false } } }
            }
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

    // Get existing vote to determine delta
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
        await db.vote.delete({
          where: { comment_id_user_id: { comment_id, user_id: anilistUser.id } }
        });
        upvoteChange = vote_type === 1 ? -1 : 0;
        downvoteChange = vote_type === -1 ? -1 : 0;
        newVoteType = null;
      } else {
        await db.vote.update({
          where: { comment_id_user_id: { comment_id, user_id: anilistUser.id } },
          data: { vote_type }
        });
        upvoteChange = vote_type === 1 ? 1 : -1;
        downvoteChange = vote_type === -1 ? 1 : -1;
      }
    } else {
      await db.vote.create({
        data: { comment_id, user_id: anilistUser.id, vote_type }
      });
      upvoteChange = vote_type === 1 ? 1 : 0;
      downvoteChange = vote_type === -1 ? 1 : 0;
    }

    // 1. Update comment local cache
    const voteCounts = await db.vote.groupBy({
      by: ['vote_type'],
      where: { comment_id: comment_id },
      _count: { vote_type: true }
    });

    const upvotesCount = voteCounts.find(v => v.vote_type === 1)?._count.vote_type || 0;
    const downvotesCount = voteCounts.find(v => v.vote_type === -1)?._count.vote_type || 0;

    await db.comment.update({
      where: { id: comment_id },
      data: {
        upvotes: upvotesCount,
        downvotes: downvotesCount,
        total_votes: upvotesCount + downvotesCount
      }
    });

    // 2. LIVE RANKING UPDATE
    // Fetch total comments authored by the user for the multiplier
    const totalCommentsMade = comment.user._count.comments;

    const updatedAuthor = await db.user.update({
      where: { anilist_user_id: comment.anilist_user_id },
      data: {
        total_upvotes: { increment: upvoteChange },
        total_downvotes: { increment: downvoteChange }
      }
    });

    // Calculate new Level based on quality (up/down) and quantity (comments)
    const newUserLevel = calculateUserLevel(
      Math.max(0, updatedAuthor.total_upvotes),
      Math.max(0, updatedAuthor.total_downvotes),
      totalCommentsMade
    );

    // Save level to DB
    await db.user.update({
      where: { anilist_user_id: updatedAuthor.anilist_user_id },
      data: { rank_score: newUserLevel }
    });

    await logUserAction(request, anilistUser.id, 'VOTE', 'comment', String(comment_id), {
      vote_type: newVoteType,
      author_level_after: newUserLevel
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        vote_type: newVoteType || 0,
        upvotes: upvotesCount,
        downvotes: downvotesCount,
        total_votes: upvotesCount + downvotesCount,
        user_vote_type: newVoteType,
        author_level: newUserLevel
      },
      message: newVoteType ? `Vote recorded` : 'Vote removed'
    });

  } catch (error) {
    console.error('POST vote error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // ... (keep the existing GET logic provided in your prompt)
}
