import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { canViewAuditLogs, getUserRole, Role } from '@/lib/permissions';
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
    if (!canViewAuditLogs(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to view audit logs'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};
    if (userId) whereClause.user_id = parseInt(userId);
    if (action) whereClause.action = { contains: action, mode: 'insensitive' };
    if (targetType) whereClause.target_type = targetType;
    if (targetId) whereClause.target_id = targetId;

    // Get audit logs
    const auditLogs = await db.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
            role: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit
    });

    // Get total count
    const total = await db.auditLog.count({
      where: whereClause
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        audit_logs: auditLogs,
        pagination: {
          page,
          limit,
          total,
          hasMore: offset + auditLogs.length < total
        }
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
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
    const user = await upsertUser(anilistUser, db);

    // Only Super Admin can delete audit logs
    if (getUserRole(user) !== Role.SUPER_ADMIN) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only Super Admin can delete audit logs'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const olderThanDays = searchParams.get('older_than_days');

    let deleteResult;
    if (olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));

      deleteResult = await db.auditLog.deleteMany({
        where: {
          created_at: {
            lt: cutoffDate
          }
        }
      });
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'older_than_days parameter is required'
      }, { status: 400 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        deleted_count: deleteResult.count
      },
      message: `Deleted ${deleteResult.count} audit log entries older than ${olderThanDays} days`
    });

  } catch (error) {
    console.error('Delete audit logs error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}