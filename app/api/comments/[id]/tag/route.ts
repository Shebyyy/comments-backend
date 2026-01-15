import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canTagComment } from '@/lib/permissions';
import { CreateCommentTagRequest, ApiResponse } from '@/lib/types';
import { TagType } from '@prisma/client';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const body: CreateCommentTagRequest = await request.json();
    const { tag_type, expires_at } = body;

    // Validate input
    if (!tag_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'tag_type is required'
      }, { status: 400 });
    }

    // Validate that tag_type is a valid TagType enum value
    if (!Object.values(TagType).includes(tag_type as TagType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid tag_type. Must be one of: ' + Object.values(TagType).join(', ')
      }, { status: 400 });
    }

    // Cast string to TagType enum
    const tagTypeEnum = tag_type as TagType;

    // Check if user can tag comments
    if (!canTagComment(user, tagTypeEnum)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to tag comments'
      }, { status: 403 });
    }

    // Check if comment exists
    const comment = await db.comment.findUnique({
      where: { id: params.id }
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
        error: 'Cannot tag deleted comment'
      }, { status: 400 });
    }

    // Create or update comment tag
    const commentTag = await db.commentTag.upsert({
      where: {
        comment_id_tag_type: {
          comment_id: params.id,
          tag_type: tagTypeEnum
        }
      },
      update: {
        tagged_by_user_id: user.anilist_user_id,
        expires_at: expires_at ? new Date(expires_at) : null,
        created_at: new Date()
      },
      create: {
        comment_id: params.id,
        tag_type: tagTypeEnum,
        tagged_by_user_id: user.anilist_user_id,
        expires_at: expires_at ? new Date(expires_at) : null
      },
      include: {
        tagged_by_user: {
          select: { username: true }
        }
      }
    });

    // Special handling for PINNED tag
    if (tagTypeEnum === 'PINNED') {
      await db.comment.update({
        where: { id: params.id },
        data: {
          is_pinned: true,
          pin_expires: expires_at ? new Date(expires_at) : null
        }
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: commentTag,
      message: `Comment tagged as ${tagTypeEnum} successfully`
    });

  } catch (error) {
    console.error('Comment tag error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const { searchParams } = new URL(request.url);
    const tag_type = searchParams.get('tag_type');

    if (!tag_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'tag_type query parameter is required'
      }, { status: 400 });
    }

    // Validate that tag_type is a valid TagType enum value
    if (!Object.values(TagType).includes(tag_type as TagType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid tag_type. Must be one of: ' + Object.values(TagType).join(', ')
      }, { status: 400 });
    }

    // Cast string to TagType enum
    const tagTypeEnum = tag_type as TagType;

    // Check if user can tag comments
    if (!canTagComment(user, tagTypeEnum)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to remove comment tags'
      }, { status: 403 });
    }

    // Delete the tag
    const deletedTag = await db.commentTag.delete({
      where: {
        comment_id_tag_type: {
          comment_id: params.id,
          tag_type: tagTypeEnum
        }
      }
    });

    // Special handling for PINNED tag
    if (tagTypeEnum === 'PINNED') {
      await db.comment.update({
        where: { id: params.id },
        data: {
          is_pinned: false,
          pin_expires: null
        }
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: deletedTag,
      message: `Comment ${tagTypeEnum} tag removed successfully`
    });

  } catch (error) {
    console.error('Delete comment tag error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Tag not found or internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get all tags for a comment (no auth required for reading)
    const tags = await db.commentTag.findMany({
      where: { comment_id: params.id },
      include: {
        tagged_by_user: {
          select: { username: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: tags
    });

  } catch (error) {
    console.error('Get comment tags error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}