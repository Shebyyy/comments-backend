import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canBanUser, canWarnUser, canPromoteDemote, isSuperAdmin } from '@/lib/permissions';
import { CreateBanRequest, CreateWarningRequest, AdminActionRequest, ApiResponse } from '@/lib/types';

// POST /api/admin/actions
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
    
    // Upsert user to get current permissions
    const user = await upsertUser(anilistUser, db);
    
    // Check rate limit
    await checkRateLimit(anilistUser.id, 'ban', db);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'ban') {
      return handleBan(request, user, anilistUser);
    } else if (action === 'warn') {
      return handleWarn(request, user, anilistUser);
    } else if (action === 'promote' || action === 'demote') {
      return handleRoleChange(request, user, anilistUser, action);
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid action. Use: ban, warn, promote, demote'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('POST admin action error:', error);
    
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

async function handleBan(request: NextRequest, user: any, anilistUser: any) {
  // Check if user can ban (super admin can always ban)
  if (!isSuperAdmin(user) && !canBanUser(user)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Insufficient permissions to ban users'
    }, { status: 403 });
  }

  const body: CreateBanRequest = await request.json();
  const { user_id, reason, duration_hours, is_permanent } = body;

  // Validate input
  if (!user_id || !reason || reason.trim().length === 0) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id and reason are required'
    }, { status: 400 });
  }

  if (reason.length > 200) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Reason too long (max 200 characters)'
    }, { status: 400 });
  }

  // Cannot ban yourself
  if (user_id === anilistUser.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot ban yourself'
    }, { status: 400 });
  }

  // Check if target user exists
  const targetUser = await db.user.findUnique({
    where: { anilist_user_id: user_id }
  });

  if (!targetUser) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Target user not found'
    }, { status: 404 });
  }

  // Cannot ban users with equal or higher privileges (unless you're super admin)
  if (!isSuperAdmin(user)) {
    if (targetUser.is_mod || targetUser.is_admin) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot ban users with equal or higher privileges'
      }, { status: 403 });
    }
  }

  // Calculate expiration date
  let expires_at = null;
  if (!is_permanent && duration_hours) {
    expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + duration_hours);
  }

  // Create ban
  const newBan = await db.ban.create({
    data: {
      user_id: user_id,
      banned_by: anilistUser.id,
      reason: reason.trim(),
      duration_hours: duration_hours || null,
      is_permanent: is_permanent || false,
      expires_at: expires_at
    }
  });

  // Update user's ban status
  await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      is_banned: true,
      ban_reason: reason.trim(),
      ban_expires: expires_at
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      ban_id: newBan.id,
      user_id: user_id,
      banned_by: anilistUser.id,
      reason: newBan.reason,
      is_permanent: newBan.is_permanent,
      expires_at: newBan.expires_at
    },
    message: 'User banned successfully'
  });
}

async function handleWarn(request: NextRequest, user: any, anilistUser: any) {
  // Check if user can warn (super admin can always warn)
  if (!isSuperAdmin(user) && !canWarnUser(user)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Insufficient permissions to warn users'
    }, { status: 403 });
  }

  const body: CreateWarningRequest = await request.json();
  const { user_id, reason, description } = body;

  // Validate input
  if (!user_id || !reason || reason.trim().length === 0) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id and reason are required'
    }, { status: 400 });
  }

  if (reason.length > 200) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Reason too long (max 200 characters)'
    }, { status: 400 });
  }

  if (description && description.length > 500) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Description too long (max 500 characters)'
    }, { status: 400 });
  }

  // Cannot warn yourself
  if (user_id === anilistUser.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot warn yourself'
    }, { status: 400 });
  }

  // Check if target user exists
  const targetUser = await db.user.findUnique({
    where: { anilist_user_id: user_id }
  });

  if (!targetUser) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Target user not found'
    }, { status: 404 });
  }

  // Cannot warn users with equal or higher privileges (unless you're super admin)
  if (!isSuperAdmin(user)) {
    if (targetUser.is_mod || targetUser.is_admin) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot warn users with equal or higher privileges'
      }, { status: 403 });
    }
  }

  // Create warning
  const newWarning = await db.warning.create({
    data: {
      user_id: user_id,
      warned_by: anilistUser.id,
      reason: reason.trim(),
      description: description?.trim() || null
    }
  });

  // Update user's warning count
  await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      warning_count: {
        increment: 1
      }
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      warning_id: newWarning.id,
      user_id: user_id,
      warned_by: anilistUser.id,
      reason: newWarning.reason,
      description: newWarning.description
    },
    message: 'User warned successfully'
  });
}

async function handleRoleChange(request: NextRequest, user: any, anilistUser: any, action: string) {
  const body: AdminActionRequest = await request.json();
  const { user_id, role } = body;

  // Validate input
  if (!user_id || !role || !['mod', 'admin'].includes(role)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id and role (mod/admin) are required'
    }, { status: 400 });
  }

  // Cannot change your own role
  if (user_id === anilistUser.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot change your own role'
    }, { status: 400 });
  }

  // Check if target user exists
  const targetUser = await db.user.findUnique({
    where: { anilist_user_id: user_id }
  });

  if (!targetUser) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Target user not found'
    }, { status: 404 });
  }

  // Map role string to Role enum
  const newRole = role === 'admin' ? 'ADMIN' : 'MODERATOR';

  // Check if user can promote/demote (super admin can always do this)
  if (!isSuperAdmin(user) && (!targetUser || !canPromoteDemote(user, targetUser, newRole))) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Insufficient permissions to change user roles'
    }, { status: 403 });
  }

  // Only admins can manage admin roles (super admin can do anything)
  if (role === 'admin' && !user.is_admin && !isSuperAdmin(user)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Only admins can manage admin roles'
    }, { status: 403 });
  }

  // Cannot modify users with equal or higher privileges (unless you're super admin)
  if (!isSuperAdmin(user)) {
    if (targetUser.is_mod || targetUser.is_admin) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot modify users with equal or higher privileges'
      }, { status: 403 });
    }
  }

  // Prepare update data
  let updateData: any = {
    updated_at: new Date()
  };

  if (role === 'admin') {
    updateData.is_admin = action === 'promote';
    updateData.is_mod = action === 'promote'; // Admins are also mods
  } else if (role === 'mod') {
    updateData.is_mod = action === 'promote';
    // Don't change admin status when modifying mod role
  }

  // Update user role
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: updateData
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      action: action,
      role: role,
      is_mod: updatedUser.is_mod,
      is_admin: updatedUser.is_admin
    },
    message: `User ${action}d to ${role} successfully`
  });
}