import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canViewReports } from '@/lib/permissions';
import { ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
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
    const user = await upsertUser(anilistUser, db);

    // Check permissions
    if (!canViewReports(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const sortBy = searchParams.get('sort') || 'recent';

    const offset = (page - 1) * limit;

    // Build sort order
    let orderBy: any = { created_at: 'desc' };
    switch (sortBy) {
      case 'recent':
        orderBy = { created_at: 'desc' };
        break;
      case 'oldest':
        orderBy = { created_at: 'asc' };
        break;
      case 'popular':
        orderBy = [
          { total_votes: 'desc' },
          { created_at: 'desc' }
        ];
        break;
      case 'controversial':
        orderBy = [
          { total_votes: 'desc' },
          { upvotes: 'asc' }
        ];
        break;
    }

    // Get vote statistics
    const voteStats = await db.vote.groupBy({
      by: ['vote_type'],
      _count: {
        vote_type: true
      }
    });

    const totalUpvotes = voteStats.find(v => v.vote_type === 1)?._count.vote_type || 0;
    const totalDownvotes = voteStats.find(v => v.vote_type === -1)?._count.vote_type || 0;
    const totalVotes = totalUpvotes + totalDownvotes;

    // Get top voted comments
    const topComments = await db.comment.findMany({
      where: {
        is_deleted: false,
        total_votes: { gt: 0 }
      },
      orderBy: [
        { total_votes: 'desc' },
        { created_at: 'desc' }
      ],
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
      take: 10
    });

    // Get most active voters
    const activeVoters = await db.vote.groupBy({
      by: ['user_id'],
      _count: {
        vote_type: true
      },
      orderBy: {
        _count: {
          vote_type: 'desc'
        }
      },
      take: 10
    });

    // Get voter details for most active voters
    const activeVoterDetails = await Promise.all(
      activeVoters.map(async (voter) => {
        const user = await db.user.findUnique({
          where: { anilist_user_id: voter.user_id },
          select: {
            anilist_user_id: true,
            username: true,
            profile_picture_url: true,
            is_mod: true,
            is_admin: true,
            role: true
          }
        });
        
        return {
          user_id: voter.user_id,
          username: user?.username || 'Unknown',
          profile_picture_url: user?.profile_picture_url,
          role: user?.role,
          total_votes: voter._count.vote_type,
          upvotes: voter._count.vote_type === 1 ? voter._count.vote_type : 0,
          downvotes: voter._count.vote_type === -1 ? voter._count.vote_type : 0
        };
      })
    );

    // Get voting trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentVotes = await db.vote.findMany({
      where: {
        created_at: { gte: sevenDaysAgo }
      },
      orderBy: { created_at: 'asc' },
      include: {
        comment: {
          select: {
            id: true,
            media_id: true,
            media_type: true,
            depth_level: true,
            is_deleted: true
          }
        },
        user: {
          select: {
            anilist_user_id: true,
            username: true,
            role: true
          }
        }
      },
      take: 1000
    });

    // Group votes by day for trend analysis
    const dailyVotes = recentVotes.reduce((acc, vote) => {
      const date = vote.created_at.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { upvotes: 0, downvotes: 0, total: 0, users: new Set() };
      }
      
      if (vote.vote_type === 1) {
        acc[date].upvotes++;
      } else if (vote.type === -1) {
        acc[date].downvotes++;
      }
      acc[date].total++;
      acc[date].users.add(vote.user_id);
      
      return acc;
    }, {} as Record<string, any>);

    // Convert to array format for response
    const votingTrends = Object.entries(dailyVotes).map(([date, data]) => ({
      date,
      upvotes: data.upvotes,
      downvotes: data.downvotes,
      total: data.total,
      unique_voters: data.users.size
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get comment depth distribution
    const depthDistribution = await db.comment.groupBy({
      by: ['depth_level'],
      where: {
        is_deleted: false
      },
      _count: {
        depth_level: true
      }
    });

    const depthStats = depthDistribution.map(d => ({
      depth_level: d.depth_level,
      count: d._count.depth_level
    })).sort((a, b) => a.depth_level - b.depth_level);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        overview: {
          total_votes,
          total_upvotes,
          total_downvotes,
          total_comments: await db.comment.count({ where: { is_deleted: false } }),
          total_voters: await db.vote.count(),
          active_voters: activeVoterDetails.length
        },
        top_comments: topComments.map(comment => ({
          id: comment.id,
          content: comment.content,
          total_votes: comment.total_votes,
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
          depth_level: comment.depth_level,
          reply_count: comment._count.replies,
          created_at: comment.created_at,
          username: comment.user?.username || 'Unknown',
          profile_picture_url: comment.user?.profile_picture_url,
          role: comment.user?.role,
          is_mod: comment.user?.is_mod || false,
          is_admin: comment.user?.is_admin || false
        })),
        active_voters: activeVoterDetails,
        voting_trends: votingTrends,
        depth_distribution: depthStats
      }
    });

  } catch (error) {
    console.error('GET vote statistics error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}