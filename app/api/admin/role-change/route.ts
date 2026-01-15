import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canPromoteDemote, Role } from '@/lib/permissions';
import { RoleChangeRequest, ApiResponse } from '@/lib/types';

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

    const body: RoleChangeRequest = await request.json();
    const { target_user_id, new_role, reason } = body;

    // Validate input
    if (!target_user_id || !new_role) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'target_user_id and new_role are required'
      }, { status: 400 });
    }

    if (!Object.values(Role).includes(new_role)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid role'
      }, { status: 400 });
    }

    // Get target user
    const targetUser = await db.user.findUnique({
      where: { anilist_user_id: target_user_id }
    });

    if (!targetUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Target user not found'
      }, { status: 404 });
    }

    // Check permissions
    if (!canPromoteDemote(actor, targetUser, new_role)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions for this role change'
      }, { status: 403 });
    }

    // Prevent self-role changes
    if (actor.anilist_user_id === target_user_id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot change your own role'
      }, { status: 400 });
    }

    // Create role change audit log
    await db.roleChange.create({
      data: {
        target_user_id: target_user_id,
        changed_by_user_id: actor.anilist_user_id,
        old_role: targetUser.role || Role.USER,
        new_role: new_role,
        reason: reason || null
      }
    });

    // Update user role
    const updatedUser = await db.user.update({
      where: { anilist_user_id: target_user_id },
      data: { 
        role: new_role,
        // Update legacy boolean fields for backward compatibility
        is_mod: new_role === Role.MODERATOR || new_role === Role.ADMIN || new_role === Role.SUPER_ADMIN,
        is_admin: new_role === Role.ADMIN || new_role === Role.SUPER_ADMIN
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        target_user_id: updatedUser.anilist_user_id,
        old_role: targetUser.role || Role.USER,
        new_role: new_role,
        changed_by: actor.username
      },
      message: `User role changed to ${new_role} successfully`
    });

  } catch (error) {
    console.error('Role change error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

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

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('target_user_id');

    if (targetUserId) {
      // Get role changes for specific user
      const roleChanges = await db.roleChange.findMany({
        where: { target_user_id: parseInt(targetUserId) },
        include: {
          target_user: {
            select: { username: true }
          },
          changed_by_user: {
            select: { username: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 50
      });

      return NextResponse.json<ApiResponse>({
        success: true,
        data: roleChanges
      });
    } else {
      // Get all role changes (admin only)
      // This would need additional permission check
      const roleChanges = await db.roleChange.findMany({
        include: {
          target_user: {
            select: { username: true }
          },
          changed_by_user: {
            select: { username: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 100
      });

      return NextResponse.json<ApiResponse>({
        success: true,
        data: roleChanges
      });
    }

  } catch (error) {
    console.error('Get role changes error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}