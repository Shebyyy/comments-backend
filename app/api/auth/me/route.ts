import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { ApiResponse } from '@/lib/types';

// GET /api/auth/me - Get current user's role and permissions from database
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

    // Get user from database (this uses the role field, not AniList moderatorStatus)
    const user = await upsertUser(anilistUser, db);

    // Format response with role information
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: {
          id: user.anilist_user_id,
          username: user.username,
          profile_picture_url: user.profile_picture_url,
        },
        // Role information from database
        role: user.role,
        is_mod: user.is_mod,
        is_admin: user.is_admin,
        is_super_admin: user.role === 'SUPER_ADMIN',

        // Permission indicators
        permissions: {
          can_ban_users: user.is_admin || user.role === 'SUPER_ADMIN',
          can_warn_users: user.is_admin || user.role === 'SUPER_ADMIN',
          can_view_reports: user.is_mod || user.is_admin || user.role === 'SUPER_ADMIN',
          can_view_audit_logs: user.is_admin || user.role === 'SUPER_ADMIN',
          can_promote_demote: user.is_admin || user.role === 'SUPER_ADMIN',
          can_shadow_ban: user.is_admin || user.role === 'SUPER_ADMIN',
        }
      }
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to get user information'
    }, { status: 500 });
  }
}
