import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { isSuperAdmin } from '@/lib/permissions';
import { ApiResponse } from '@/lib/types';

// Super Admin only endpoint - Only ASheby (5724017) can access
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

    // Verify this is the super admin
    if (!isSuperAdmin(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Super admin access required'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'force_admin') {
      return handleForceAdmin(request, anilistUser);
    } else if (action === 'remove_admin') {
      return handleRemoveAdmin(request, anilistUser);
    } else if (action === 'force_mod') {
      return handleForceMod(request, anilistUser);
    } else if (action === 'remove_mod') {
      return handleRemoveMod(request, anilistUser);
    } else if (action === 'unban_user') {
      return handleUnbanUser(request, anilistUser);
    } else if (action === 'clear_warnings') {
      return handleClearWarnings(request, anilistUser);
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid action. Use: force_admin, remove_admin, force_mod, remove_mod, unban_user, clear_warnings'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('POST super admin error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function handleForceAdmin(request: NextRequest, superAdmin: any) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id is required'
    }, { status: 400 });
  }

  // Force user to be admin (override AniList status)
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      role: 'ADMIN', // CRITICAL: Update role field
      is_admin: true,
      is_mod: true, // Admins are also mods
      updated_at: new Date()
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      role: updatedUser.role, // Return role
      is_admin: updatedUser.is_admin,
      is_mod: updatedUser.is_mod
    },
    message: `User ${user_id} has been granted admin privileges by super admin`
  });
}

async function handleRemoveAdmin(request: NextRequest, superAdmin: any) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id is required'
    }, { status: 400 });
  }

  // Cannot remove admin from yourself
  if (user_id === superAdmin.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot remove admin from yourself'
    }, { status: 400 });
  }

  // Remove admin status (demote to USER)
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      role: 'USER', // CRITICAL: Update role field
      is_admin: false,
      is_mod: false,
      updated_at: new Date()
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      role: updatedUser.role, // Return role
      is_admin: updatedUser.is_admin,
      is_mod: updatedUser.is_mod
    },
    message: `Admin privileges removed from user ${user_id} by super admin`
  });
}

async function handleForceMod(request: NextRequest, superAdmin: any) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id is required'
    }, { status: 400 });
  }

  // Force user to be mod
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      role: 'MODERATOR', // CRITICAL: Update role field
      is_mod: true,
      updated_at: new Date()
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      role: updatedUser.role, // Return role
      is_mod: updatedUser.is_mod,
      is_admin: updatedUser.is_admin
    },
    message: `User ${user_id} has been granted mod privileges by super admin`
  });
}

async function handleRemoveMod(request: NextRequest, superAdmin: any) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id is required'
    }, { status: 400 });
  }

  // Cannot remove mod from yourself
  if (user_id === superAdmin.id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Cannot remove mod from yourself'
    }, { status: 400 });
  }

  // Remove mod status (demote to USER)
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      role: 'USER', // CRITICAL: Update role field
      is_mod: false,
      is_admin: false,
      updated_at: new Date()
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      role: updatedUser.role, // Return role
      is_mod: updatedUser.is_mod,
      is_admin: updatedUser.is_admin
    },
    message: `Mod privileges removed from user ${user_id} by super admin`
  });
}

async function handleUnbanUser(request: NextRequest, superAdmin: any) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id is required'
    }, { status: 400 });
  }

  // Clear ban status
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      is_banned: false,
      ban_reason: null,
      ban_expires: null,
      updated_at: new Date()
    }
  });

  // Deactivate all active bans
  await db.ban.updateMany({
    where: {
      user_id: user_id,
      is_active: true
    },
    data: {
      is_active: false
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      is_banned: updatedUser.is_banned
    },
    message: `User ${user_id} has been unbanned by super admin`
  });
}

async function handleClearWarnings(request: NextRequest, superAdmin: any) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'user_id is required'
    }, { status: 400 });
  }

  // Deactivate all warnings
  await db.warning.updateMany({
    where: {
      user_id: user_id,
      is_active: true
    },
    data: {
      is_active: false
    }
  });

  // Reset warning count
  const updatedUser = await db.user.update({
    where: { anilist_user_id: user_id },
    data: {
      warning_count: 0,
      updated_at: new Date()
    }
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user_id: user_id,
      warning_count: updatedUser.warning_count
    },
    message: `All warnings cleared for user ${user_id} by super admin`
  });
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
    
    // Upsert user to get current permissions
    const user = await upsertUser(anilistUser, db);

    // Verify this is the super admin
    if (!isSuperAdmin(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Super admin access required'
      }, { status: 403 });
    }

    // Get system overview
    const totalUsers = await db.user.count();
    const totalComments = await db.comment.count();
    const activeBans = await db.ban.count({ where: { is_active: true } });
    const activeWarnings = await db.warning.count({ where: { is_active: true } });
    const pendingReports = await db.report.count({ where: { status: 'PENDING' } });

    const recentBans = await db.ban.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        banned_user: {
          select: { username: true }
        },
        banner: {
          select: { username: true }
        }
      }
    });

    const recentReports = await db.report.findMany({
      take: 5,
      where: { status: 'PENDING' },
      orderBy: { created_at: 'desc' },
      include: {
        reporter: {
          select: { username: true }
        },
        comment: {
          include: {
            user: {
              select: { username: true }
            }
          }
        }
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        super_admin: {
          user_id: anilistUser.id,
          username: anilistUser.name,
          role: 'super_admin'
        },
        system_stats: {
          total_users: totalUsers,
          total_comments: totalComments,
          active_bans: activeBans,
          active_warnings: activeWarnings,
          pending_reports: pendingReports
        },
        recent_activity: {
          recent_bans: recentBans,
          recent_reports: recentReports
        }
      }
    });

  } catch (error) {
    console.error('GET super admin error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}