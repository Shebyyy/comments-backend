import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreateCommentRequest, Comment, ApiResponse, NestedCommentsResponse } from '@/lib/types';
import { calculateUserLevel } from '@/lib/ranking';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('media_id');
    const mediaType = searchParams.get('media_type') || 'ANIME';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const sortBy = searchParams.get('sort') || 'newest';
    const parentId = searchParams.get('parent_id');
    const maxDepth = parseInt(searchParams.get('max_depth') || '10');
    const includeDeleted = searchParams.get('include_deleted') === 'true';

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

    // Build where clause
    const whereClause: any = {
      media_id: mediaIdNum,
      media_type: mediaType,
      parent_comment_id: parentId ? parseInt(parentId) : null,
      depth_level: { lte: maxDepth }
    };

    if (!includeDeleted) {
      whereClause.is_deleted = false;
    }

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

    // Fetch comments with nested structure
    const comments = await db.comment.findMany({
      where: whereClause,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            anilist_user_id: true,
            username: true,
            profile_picture_url: true,
            is_mod: true,
            is_admin: true,
            role: true,
            rank_score: true
          }
        },
        votes: userId ? {
          where: { user_id: userId }
        } : false,
        tags: true,
        _count: {
          select: {
            replies: {
              where: includeDeleted ? {} : { is_deleted: false }
            }
          }
        }
      },
      skip: offset,
      take: limit
    });

    const total = await db.comment.count({
      where: whereClause
    });

    // Format response with nested structure
    const formattedComments = await Promise.all(comments.map(async (comment) => {
      const nestedReplies = await getNestedReplies(comment.id, userId, maxDepth, 1, includeDeleted);
      
      return {
        id: comment.id,
        media_id: comment.media_id,
        media_type: comment.media_type,
        parent_comment_id: comment.parent_comment_id,
        root_comment_id: comment.root_comment_id,
        depth_level: comment.depth_level,
        content: comment.is_deleted ? '[deleted]' : comment.content,
        anilist_user_id: comment.anilist_user_id,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        total_votes: comment.total_votes,
        user_vote_type: (comment.votes && comment.votes.length > 0) ? comment.votes[0].vote_type : null,
        is_deleted: comment.is_deleted,
        deleted_by: comment.deleted_by,
        delete_reason: comment.delete_reason,
        is_edited: comment.is_edited,
        is_pinned: comment.is_pinned,
        pin_expires: comment.pin_expires,
        edit_history: comment.edit_history,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        username: comment.user?.username || 'Unknown',
        profile_picture_url: comment.user?.profile_picture_url || null,
        is_mod: comment.user?.is_mod || false,
        is_admin: comment.user?.is_admin || false,
        role: comment.user?.role,
        rank_score: comment.user?.rank_score || 0,
        tags: comment.tags,
        reply_count: comment._count.replies,
        replies: nestedReplies
      };
    }));

    const responseMaxDepth = Math.max(...formattedComments.map(c => 
      Math.max(c.depth_level, ...getAllDepths(c.replies || []))
    ), 0);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        comments: formattedComments,
        hasMore: offset + comments.length < total,
        total,
        page,
        limit,
        max_depth: responseMaxDepth
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

async function getNestedReplies(
  parentId: number, 
  userId: number | null, 
  maxDepth: number, 
  currentDepth: number,
  includeDeleted: boolean
): Promise<any[]> {
  if (currentDepth >= maxDepth) return [];

  const replies = await db.comment.findMany({
    where: {
      parent_comment_id: parentId,
      depth_level: currentDepth,
      ...(includeDeleted ? {} : { is_deleted: false })
    },
    orderBy: { created_at: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          anilist_user_id: true,
          username: true,
          profile_picture_url: true,
          is_mod: true,
          is_admin: true,
          role: true,
          rank_score: true
        }
      },
      votes: userId ? {
        where: { user_id: userId }
      } : false,
      tags: true,
      _count: {
        select: {
          replies: {
            where: includeDeleted ? {} : { is_deleted: false }
          }
        }
      }
    }
  });

  return await Promise.all(replies.map(async (reply) => {
    const nestedReplies = await getNestedReplies(reply.id, userId, maxDepth, currentDepth + 1, includeDeleted);
    
    return {
      id: reply.id,
      media_id: reply.media_id,
      media_type: reply.media_type,
      parent_comment_id: reply.parent_comment_id,
      root_comment_id: reply.root_comment_id,
      depth_level: reply.depth_level,
      content: reply.is_deleted ? '[deleted]' : reply.content,
      anilist_user_id: reply.anilist_user_id,
      upvotes: reply.upvotes,
      downvotes: reply.downvotes,
      total_votes: reply.total_votes,
      user_vote_type: (reply.votes && reply.votes.length > 0) ? reply.votes[0].vote_type : null,
      is_deleted: reply.is_deleted,
      deleted_by: reply.deleted_by,
      delete_reason: reply.delete_reason,
      is_edited: reply.is_edited,
      is_pinned: reply.is_pinned,
      pin_expires: reply.pin_expires,
      edit_history: reply.edit_history,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      username: reply.user?.username || 'Unknown',
      profile_picture_url: reply.user?.profile_picture_url || null,
      is_mod: reply.user?.is_mod || false,
      is_admin: reply.user?.is_admin || false,
      role: reply.user?.role,
      rank_score: reply.user?.rank_score || 0,
      tags: reply.tags,
      reply_count: reply._count.replies,
      replies: nestedReplies
    };
  }));
}

function getAllDepths(comments: any[]): number[] {
  const depths: number[] = [];
  for (const comment of comments) {
    depths.push(comment.depth_level);
    if (comment.replies && comment.replies.length > 0) {
      depths.push(...getAllDepths(comment.replies));
    }
  }
  return depths;
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
    
    // Upsert user to get current permissions and status
    const user = await upsertUser(anilistUser, db);

    // Mute/Warn Punishment Check
    if (user.is_muted) {
      if (user.mute_expires && new Date() < user.mute_expires) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: `You are currently muted from posting until ${user.mute_expires.toLocaleString()}` 
        }, { status: 403 });
      } else {
        // Mute expired, clean up status
        await db.user.update({
          where: { anilist_user_id: user.anilist_user_id },
          data: { is_muted: false, mute_expires: null }
        });
      }
    }
    
    // Check rate limit
    await checkRateLimit(anilistUser.id, 'comment', db);

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

    let rootCommentId: number | null = null;
    let depthLevel = 0;

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

      if (parentComment.depth_level >= 20) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Maximum nesting depth reached'
        }, { status: 400 });
      }

      if (parentComment.media_id !== media_id) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Parent comment media_id mismatch'
        }, { status: 400 });
      }

      rootCommentId = parentComment.root_comment_id || parentComment.id;
      depthLevel = parentComment.depth_level + 1;
    }

    // Create comment
    const newComment = await db.comment.create({
      data: {
        media_id: media_id,
        media_type: media_type || 'ANIME',
        content: content.trim(),
        anilist_user_id: user.anilist_user_id,
        parent_comment_id: parent_comment_id || null,
        root_comment_id: rootCommentId,
        depth_level: depthLevel
      },
      include: {
        user: {
          select: {
            id: true,
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

    // LIVE LEVEL UPDATE: Every new comment increases engagement baseline
    const authorWithStats = await db.user.findUnique({
      where: { anilist_user_id: user.anilist_user_id },
      include: {
        _count: { select: { comments: { where: { is_deleted: false } } } }
      }
    });

    let newRankScore = 0;
    if (authorWithStats) {
      newRankScore = calculateUserLevel(
        authorWithStats.total_upvotes,
        authorWithStats.total_downvotes,
        authorWithStats._count.comments
      );

      await db.user.update({
        where: { anilist_user_id: user.anilist_user_id },
        data: { rank_score: newRankScore }
      });
    }

    // Format response
    const formattedComment = {
      id: newComment.id,
      media_id: newComment.media_id,
      media_type: newComment.media_type,
      parent_comment_id: newComment.parent_comment_id,
      root_comment_id: newComment.root_comment_id,
      depth_level: newComment.depth_level,
      content: newComment.content,
      anilist_user_id: newComment.anilist_user_id,
      upvotes: newComment.upvotes,
      downvotes: newComment.downvotes,
      total_votes: newComment.total_votes,
      user_vote_type: null,
      is_deleted: newComment.is_deleted,
      is_edited: newComment.is_edited,
      is_pinned: newComment.is_pinned,
      pin_expires: newComment.pin_expires,
      created_at: newComment.created_at,
      updated_at: newComment.updated_at,
      username: newComment.user.username,
      profile_picture_url: newComment.user.profile_picture_url,
      is_mod: newComment.user.is_mod,
      is_admin: newComment.user.is_admin,
      role: newComment.user.role,
      rank_score: newRankScore,
      tags: [],
      reply_count: 0,
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
