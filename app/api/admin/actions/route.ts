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
  if (!isSuperAdmin(user) && !canBanUser(user)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Insufficient permissions to ban users'
    }, { status: 403 });
  }

  const body: CreateBanRequest = await request.json();
  const { user_id, reason, duration_hours, is_permanent } = body;

  if (!user_id || !reason || reason.trim().length === 0) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id and reason are required'
    }, { status: 400 });
  }

  if (user_id === anilistUser.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot ban yourself'
    }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { anilist_user_id: user_id }
  });

  if (!targetUser) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Target user not found'
    }, { status: 404 });
  }

  if (!isSuperAdmin(user)) {
    if (targetUser.role === 'ADMIN' || targetUser.role === 'MODERATOR' || targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot ban users with equal or higher privileges'
      }, { status: 403 });
    }
  }

  let expires_at = null;
  if (!is_permanent && duration_hours) {
    expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + duration_hours);
  }

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
    data: { ban_id: newBan.id, user_id, expires_at },
    message: 'User banned successfully'
  });
}

async function handleWarn(request: NextRequest, user: any, anilistUser: any) {
  if (!isSuperAdmin(user) && !canWarnUser(user)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Insufficient permissions to warn users'
    }, { status: 403 });
  }

  const body: CreateWarningRequest = await request.json();
  const { user_id, reason, description } = body;

  if (!user_id || !reason || reason.trim().length === 0) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id and reason are required'
    }, { status: 400 });
  }

  if (user_id === anilistUser.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot warn yourself'
    }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { anilist_user_id: user_id }
  });

  if (!targetUser) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Target user not found'
    }, { status: 404 });
  }

  if (!isSuperAdmin(user)) {
    if (targetUser.role === 'ADMIN' || targetUser.role === 'MODERATOR' || targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot warn users with equal or higher privileges'
      }, { status: 403 });
    }
  }

  // Logic for Automated Punishment
  const currentWarns = targetUser.warning_count || 0;
  const newWarnCount = currentWarns + 1;
  
  let muteExpires: Date | null = null;
  let resetWarns = false;
  let systemActionNote = "";

  // 6 warns = 1 week mute
  if (newWarnCount >= 6) {
    muteExpires = new Date();
    muteExpires.setDate(muteExpires.getDate() + 7);
    resetWarns = true;
    systemActionNote = " (Threshold reached: 1 week mute applied)";
  } 
  // 3 warns = 1 day mute
  else if (newWarnCount >= 3) {
    muteExpires = new Date();
    muteExpires.setDate(muteExpires.getDate() + 1);
    resetWarns = true;
    systemActionNote = " (Threshold reached: 1 day mute applied)";
  }

  // Create the warning record
  const newWarning = await db.warning.create({
    data: {
      user_id: user_id,
      warned_by: anilistUser.id,
      reason: reason.trim() + systemActionNote,
      description: description?.trim() || null
    }
  });

  // Update User state
  await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      // warning_count tracks active warns for next punishment threshold
      warning_count: resetWarns ? 0 : newWarnCount,
      // total_warns is lifetime history (optional, if you want to keep a permanent count)
      total_warns: { increment: 1 },
      // Apply mute if threshold met
      is_muted: !!muteExpires,
      mute_expires: muteExpires
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      warning_id: newWarning.id,
      new_warn_count: resetWarns ? 0 : newWarnCount,
      muted_until: muteExpires
    },
    message: `User warned successfully${systemActionNote}`
  });
}

async function handleRoleChange(request: NextRequest, user: any, anilistUser: any, action: string) {
  const body: AdminActionRequest = await request.json();
  const { user_id, role } = body;

  if (!user_id || !role || !['mod', 'admin'].includes(role)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id and role (mod/admin) are required'
    }, { status: 400 });
  }

  if (user_id === anilistUser.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot change your own role'
    }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { anilist_user_id: user_id }
  });

  if (!targetUser) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Target user not found'
    }, { status: 404 });
  }

  const newRole = role === 'admin' ? 'ADMIN' : 'MODERATOR';

  if (!isSuperAdmin(user) && !canPromoteDemote(user, targetUser, newRole as any)) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Insufficient permissions to change user roles'
    }, { status: 403 });
  }

  let updateData: any = { updated_at: new Date() };

  if (role === 'admin') {
    if (action === 'promote') {
      updateData.role = 'ADMIN';
      updateData.is_admin = true;
      updateData.is_mod = true;
    } else {
      updateData.role = 'USER';
      updateData.is_admin = false;
      updateData.is_mod = false;
    }
  } else if (role === 'mod') {
    if (action === 'promote') {
      updateData.role = 'MODERATOR';
      updateData.is_mod = true;
    } else {
      updateData.role = 'USER';
      updateData.is_mod = false;
      updateData.is_admin = false;
    }
  }

  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: updateData
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id,
      action,
      role,
      db_role: updatedUser.role
    },
    message: `User ${action}d to ${role} successfully`
  });
}
