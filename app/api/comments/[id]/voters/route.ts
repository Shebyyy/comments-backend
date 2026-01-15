import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canViewVotes } from '@/lib/permissions';
import { VoterListResponse, ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('comment_id');
    const voteType = searchParams.get('vote_type'); // 'up' | 'down' | 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!commentId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'comment_id is required'
      }, { status: 400 });
    }

    // Check if comment exists
    const comment = await db.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    // Get auth token (optional for read access)
    const authHeader = request.headers.get('authorization');
    let currentUserId: number | null = null;
    let hasPermission = false;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const anilistUser = await verifyAniListToken(token);
        const user = await upsertUser(anilistUser, db);
        currentUserId = anilistUser.id;
        hasPermission = canViewVotes(user);
      } catch (error) {
        // Token verification failed, but allow basic access
        console.warn('Optional auth failed:', error);
      }
    }

    // If not authenticated and not a mod/admin, return limited data
    if (!currentUserId && !hasPermission) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          comment_id: commentId,
          upvoters: [],
          downvoters: [],
          total_upvotes: comment.upvotes,
          total_downvotes: comment.downvotes,
          total_votes: comment.total_votes,
          message: 'Login to see voter details'
        }
      });
    }

    const offset = (page - 1) * limit;

    // Build vote type filter
    let voteTypeFilter: number | undefined;
    if (voteType === 'up') {
      voteTypeFilter = 1;
    } else if (voteType === 'down') {
      voteTypeFilter = -1;
    }

    // Build where clause
    const whereClause: any = {
      comment_id: commentId
    };
    
    if (voteTypeFilter !== undefined) {
      whereClause.vote_type = voteTypeFilter;
    }

    // Get voters with user information
    const voters = await db.vote.findMany({
      where: whereClause,
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
      },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit
    });

    // Get total counts
    const upvoteCount = await db.vote.count({
      where: { comment_id: commentId, vote_type: 1 }
    });

    const downvoteCount = await db.vote.count({
      where: { comment_id: commentId, vote_type: -1 }
    });

    // Format voter information
    const formattedVoters = voters.map(voter => ({
      user_id: voter.user.anilist_user_id,
      username: voter.user.username,
      profile_picture_url: voter.user.profile_picture_url,
      role: voter.user.role,
      vote_type: voter.vote_type as -1 | 0 | 1,
      created_at: voter.created_at
    }));

    // Separate upvoters and downvoters
    const upvoters = formattedVoters.filter(v => v.vote_type === 1);
    const downvoters = formattedVoters.filter(v => v.vote_type === -1);

    // Get total count for pagination
    const totalCount = await db.vote.count({
      where: whereClause
    });

    const response: VoterListResponse = {
      comment_id: commentId,
      upvoters,
      downvoters,
      total_upvotes: upvoteCount,
      total_downvotes: downvoteCount,
      total_votes: upvoteCount + downvoteCount
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...response,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + voters.length < totalCount
        }
      }
    });

  } catch (error) {
    console.error('GET voters error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}