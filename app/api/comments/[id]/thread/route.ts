import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { ApiResponse } from '@/lib/types';

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

    // Parse commentId to number for database queries (Comment.id is now Int)
    const commentIdNumber = parseInt(commentId, 10);

    // Get full comment thread recursively
    const fullThread = await getFullCommentThread(commentIdNumber, 20, 0);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: fullThread
    });
  } catch (error) {
    console.error('Get comment thread error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function getFullCommentThread(commentId: number, maxDepth: number = 20, currentDepth: number = 0): Promise<any> {
  if (currentDepth >= maxDepth) {
    throw new Error('Maximum thread depth exceeded');
  }

  // Get comment
  const comment = await db.comment.findUnique({
      where: { id: commentId },
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
        },
        votes: true,
        tags: true,
        _count: {
          select: {
            replies: {
              where: { is_deleted: false }
            }
          }
        }
    }
  });

  if (!comment) {
    throw new Error('Comment not found');
  }

  // Get all replies recursively
  const replies = await db.comment.findMany({
    where: {
      parent_comment_id: commentId,
      depth_level: currentDepth + 1
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
          role: true
        }
      },
      votes: true,
      tags: true,
      _count: {
        select: {
          replies: {
            where: { is_deleted: false }
          }
        }
      }
    }
  });

  // Recursively get nested replies
  const nestedReplies = await Promise.all(
      replies.map(async (reply) => {
        return await getFullCommentThread(reply.id, maxDepth, currentDepth + 1);
      })
    );

  // Calculate vote counts
  const upvotes = comment.votes.filter(vote => vote.vote_type === 1).length;
  const downvotes = comment.votes.filter(vote => vote.vote_type === -1).length;

  // Calculate thread statistics
  const totalComments = 1 + nestedReplies.reduce((acc, thread) => {
    return acc + (thread.thread_stats?.total_comments || 0);
  }, 0);

  const maxThreadDepth = Math.max(
    comment.depth_level,
    ...nestedReplies.map(thread => thread.thread_stats?.max_depth || 0)
  );

  const totalUpvotes = upvotes + nestedReplies.reduce((acc, thread) => {
    return acc + (thread.thread_stats?.total_upvotes || 0);
  }, 0);

  const totalDownvotes = downvotes + nestedReplies.reduce((acc, thread) => {
    return acc + (thread.thread_stats?.total_downvotes || 0);
  }, 0);

  return {
    comment: {
      id: comment.id,
      media_id: comment.media_id,
      media_type: comment.media_type,
      parent_comment_id: comment.parent_comment_id,
      root_comment_id: comment.root_comment_id,
      depth_level: comment.depth_level,
      content: comment.is_deleted ? '[deleted]' : comment.content,
      anilist_user_id: comment.anilist_user_id,
      upvotes,
      downvotes,
      total_votes: upvotes + downvotes,
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
      tags: comment.tags,
      reply_count: comment._count.replies,
      replies: nestedReplies.map(thread => thread.comment)
    },
    thread_stats: {
      total_comments: totalComments,
      max_depth: maxThreadDepth,
      total_upvotes: totalUpvotes,
      total_downvotes: totalDownvotes
    }
  };
}
