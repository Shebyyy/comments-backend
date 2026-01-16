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
        error: 'Insufficient permissions to view users'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'ALL';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    if (status === 'BANNED') {
      whereClause.is_banned = true;
    } else if (status === 'SHADOW_BANNED') {
      whereClause.shadow_banned = true;
    } else if (status === 'ACTIVE') {
      whereClause.is_banned = false;
      whereClause.shadow_banned = false;
    }
    // ALL shows all users

    if (search && search.trim().length > 0) {
      whereClause.username = {
        contains: search.trim(),
        mode: 'insensitive'
      };
    }

    // Get users with comment counts
    const users = await db.user.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            comments: {
              where: { is_deleted: false }
            }
          }
        }
      }
    });

    // Get total count
    const total = await db.user.count({
      where: whereClause
    });

    // Format user data
    const formattedUsers = users.map(user => ({
      anilist_user_id: user.anilist_user_id,
      username: user.username,
      profile_picture_url: user.profile_picture_url,
      is_mod: user.is_mod,
      is_admin: user.is_admin,
      role: user.role,
      is_banned: user.is_banned,
      shadow_banned: user.shadow_banned,
      ban_reason: user.ban_reason,
      ban_expires: user.ban_expires,
      shadow_ban_reason: user.shadow_ban_reason,
      shadow_ban_expires: user.shadow_ban_expires,
      warning_count: user.warning_count,
      comment_count: user._count.comments,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          hasMore: offset + users.length < total
        }
      }
    });

  } catch (error) {
    console.error('GET admin users error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
