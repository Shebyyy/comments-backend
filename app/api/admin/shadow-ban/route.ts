import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canShadowBanUser, Role } from '@/lib/permissions';
import { ShadowBanRequest, ApiResponse } from '@/lib/types';

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
    const actor = await upsertUser(anilistUser, db);

    const body: ShadowBanRequest = await request.json();
    const { user_id, reason, duration_hours } = body;

    // Validate input
    if (!user_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'user_id is required'
      }, { status: 400 });
    }

    // Check permissions
    if (!canShadowBanUser(actor)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to shadow ban users'
      }, { status: 403 });
    }

    // Get target user
    const targetUser = await db.user.findUnique({
      where: { anilist_user_id: user_id }
    });

    if (!targetUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Target user not found'
      }, { status: 404 });
    }

    // Prevent self-shadow ban
    if (actor.anilist_user_id === user_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot shadow ban yourself'
      }, { status: 400 });
    }

    // Cannot shadow ban Super Admin
    const targetRole = targetUser.role || Role.USER;
    if (targetRole === Role.SUPER_ADMIN) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot shadow ban Super Admin'
      }, { status: 403 });
    }

    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (duration_hours && duration_hours > 0) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration_hours);
    }

    // Update user with shadow ban
    const updatedUser = await db.user.update({
      where: { anilist_user_id: user_id },
      data: {
        shadow_banned: true,
        shadow_ban_reason: reason || null,
        shadow_ban_expires: expiresAt
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        user_id: actor.anilist_user_id,
        action: 'SHADOW_BAN',
        target_type: 'user',
        target_id: user_id.toString(),
        details: {
          reason: reason || 'No reason provided',
          duration_hours: duration_hours || null,
          expires_at: expiresAt
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent')
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user_id: updatedUser.anilist_user_id,
        shadow_banned: true,
        shadow_ban_reason: updatedUser.shadow_ban_reason,
        shadow_ban_expires: updatedUser.shadow_ban_expires,
        shadow_banned_by: actor.username
      },
      message: `User shadow banned successfully${expiresAt ? ` until ${expiresAt.toISOString()}` : ' permanently'}`
    });

  } catch (error) {
    console.error('Shadow ban error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const actor = await upsertUser(anilistUser, db);

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'user_id query parameter is required'
      }, { status: 400 });
    }

    // Check permissions
    if (!canShadowBanUser(actor)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to remove shadow bans'
      }, { status: 403 });
    }

    // Get target user
    const targetUser = await db.user.findUnique({
      where: { anilist_user_id: parseInt(user_id) }
    });

    if (!targetUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Target user not found'
      }, { status: 404 });
    }

    // Remove shadow ban
    const updatedUser = await db.user.update({
      where: { anilist_user_id: parseInt(user_id) },
      data: {
        shadow_banned: false,
        shadow_ban_reason: null,
        shadow_ban_expires: null
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        user_id: actor.anilist_user_id,
        action: 'REMOVE_SHADOW_BAN',
        target_type: 'user',
        target_id: user_id,
        details: {
          previous_reason: targetUser.shadow_ban_reason,
          previous_expires: targetUser.shadow_ban_expires
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent')
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user_id: updatedUser.anilist_user_id,
        shadow_banned: false,
        shadow_ban_removed_by: actor.username
      },
      message: 'Shadow ban removed successfully'
    });

  } catch (error) {
    console.error('Remove shadow ban error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}