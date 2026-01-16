import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canViewVotes } from '@/lib/permissions';
import { VoteListResponse, ApiResponse } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;

    // Convert commentId from string to number (Comment.id is now Int in schema)
    const commentIdNumber = parseInt(commentId, 10);

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

    // Check if user can view votes
    if (!canViewVotes(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to view votes'
      }, { status: 403 });
    }

    // Check if comment ID is valid
    if (!commentIdNumber) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment ID is required'
      }, { status: 400 });
    }

    // Get comment with user data
    const comment = await db.comment.findUnique({
      where: { id: commentIdNumber },
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

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    // Get all votes for this comment
    const votes = await db.vote.findMany({
      where: { comment_id: commentIdNumber },
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
      },
      orderBy: { created_at: 'desc' }
    });

    // Separate upvotes and downvotes
    const upvotes = votes.filter(vote => vote.vote_type === 1);
    const downvotes = votes.filter(vote => vote.vote_type === -1);

    // Format response
    const response: VoteListResponse = {
      comment_id: commentId,
      upvotes: upvotes.map(vote => ({
        user_id: vote.user_id,
        username: vote.user.username,
        profile_picture_url: vote.user.profile_picture_url || undefined,
        created_at: vote.created_at
      })),
      downvotes: downvotes.map(vote => ({
        user_id: vote.user_id,
        username: vote.user.username,
        profile_picture_url: vote.user.profile_picture_url || undefined,
        created_at: vote.created_at
      }))
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('GET votes error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
