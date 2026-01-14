import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/api/db/connection';
import { verifyAniListToken, upsertUser } from '@/app/api/auth/verify';
import { checkRateLimit } from '@/lib/rate-limit';
import { canReportComment } from '@/lib/permissions';
import { CreateReportRequest, ApiResponse } from '@/lib/types';

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
    await checkRateLimit(anilistUser.id, 'report', db);

    // Check if user can report comments
    if (!canReportComment(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'You do not have permission to report comments'
      }, { status: 403 });
    }

    const body: CreateReportRequest = await request.json();
    const { comment_id, reason, description } = body;

    // Validate input
    if (!comment_id || !reason || reason.trim().length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'comment_id and reason are required'
      }, { status: 400 });
    }

    if (reason.length > 100) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Reason too long (max 100 characters)'
      }, { status: 400 });
    }

    if (description && description.length > 500) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Description too long (max 500 characters)'
      }, { status: 400 });
    }

    // Check if comment exists
    const comment = await db.comment.findUnique({
      where: { id: comment_id }
    });

    if (!comment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Comment not found'
      }, { status: 404 });
    }

    // Check if user already reported this comment
    const existingReport = await db.report.findUnique({
      where: {
        comment_id_reporter_user_id: {
          comment_id: comment_id,
          reporter_user_id: anilistUser.id
        }
      }
    });

    if (existingReport) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'You have already reported this comment'
      }, { status: 400 });
    }

    // Create report
    const newReport = await db.report.create({
      data: {
        comment_id: comment_id,
        reporter_user_id: anilistUser.id,
        reason: reason.trim(),
        description: description?.trim() || null
      },
      include: {
        reporter: {
          select: {
            username: true,
            profile_picture_url: true
          }
        }
      }
    });

    // Format response
    const formattedReport = {
      id: newReport.id,
      comment_id: newReport.comment_id,
      reporter_user_id: newReport.reporter_user_id,
      reason: newReport.reason,
      description: newReport.description,
      status: newReport.status,
      created_at: newReport.created_at,
      updated_at: newReport.updated_at,
      reporter: newReport.reporter
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: formattedReport,
      message: 'Comment reported successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('POST report error:', error);
    
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

    // Check if user can view reports
    const { canViewReports } = await import('@/lib/permissions');
    if (!canViewReports(user)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions to view reports'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};
    if (status !== 'ALL') {
      whereClause.status = status;
    }

    // Fetch reports
    const reports = await db.report.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: {
        reporter: {
          select: {
            username: true,
            profile_picture_url: true
          }
        },
        comment: {
          include: {
            user: {
              select: {
                username: true,
                profile_picture_url: true,
                is_mod: true,
                is_admin: true
              }
            }
          }
        }
      },
      skip: offset,
      take: limit
    });

    // Get total count
    const total = await db.report.count({
      where: whereClause
    });

    // Format response
    const formattedReports = reports.map(report => ({
      id: report.id,
      comment_id: report.comment_id,
      reporter_user_id: report.reporter_user_id,
      reason: report.reason,
      description: report.description,
      status: report.status,
      reviewed_by: report.reviewed_by,
      review_note: report.review_note,
      created_at: report.created_at,
      updated_at: report.updated_at,
      reporter: report.reporter,
      comment: {
        id: report.comment.id,
        content: report.comment.content,
        anilist_user_id: report.comment.anilist_user_id,
        username: report.comment.user.username,
        profile_picture_url: report.comment.user.profile_picture_url,
        is_mod: report.comment.user.is_mod,
        is_admin: report.comment.user.is_admin,
        created_at: report.comment.created_at
      }
    }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        reports: formattedReports,
        hasMore: offset + reports.length < total,
        total,
        page,
        limit
      }
    });

  } catch (error) {
    console.error('GET reports error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}