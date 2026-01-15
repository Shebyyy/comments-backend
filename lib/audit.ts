import { NextRequest } from 'next/server';
import { db } from '@/app/api/db/connection';
import { CreateAuditLogRequest } from '@/lib/types';

export async function createAuditLog(request: NextRequest, auditData: CreateAuditLogRequest) {
  try {
    await db.auditLog.create({
      data: {
        user_id: auditData.user_id,
        action: auditData.action,
        target_type: auditData.target_type,
        target_id: auditData.target_id,
        details: auditData.details,
        ip_address: auditData.ip_address || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: auditData.user_agent || request.headers.get('user-agent')
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking main functionality
  }
}

export async function logUserAction(
  request: NextRequest,
  userId: number,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any
) {
  await createAuditLog(request, {
    user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    user_agent: request.headers.get('user-agent')
  });
}

export async function logModerationAction(
  request: NextRequest,
  moderatorId: number,
  action: string,
  targetType: string,
  targetId: string,
  details: any
) {
  await createAuditLog(request, {
    user_id: moderatorId,
    action: `MODERATION_${action}`,
    target_type: targetType,
    target_id: targetId,
    details: {
      ...details,
      moderation_timestamp: new Date().toISOString()
    },
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    user_agent: request.headers.get('user-agent')
  });
}

export async function logSystemAction(
  request: NextRequest,
  userId: number,
  action: string,
  details?: any
) {
  await createAuditLog(request, {
    user_id: userId,
    action: `SYSTEM_${action}`,
    target_type: 'system',
    details: {
      ...details,
      system_timestamp: new Date().toISOString()
    },
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    user_agent: request.headers.get('user-agent')
  });
}

// Middleware function to wrap API routes with audit logging
export function withAuditLog(action: string, targetType?: string) {
  return function(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      const startTime = Date.now();
      
      try {
        const result = await handler(request, ...args);
        
        // Log successful action if we have user info
        if (request.headers.get('authorization')) {
          // This would need to be implemented based on your auth system
          // For now, we'll skip automatic logging on success
        }
        
        return result;
      } catch (error) {
        // Log failed action
        console.error(`Action ${action} failed:`, error);
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        console.log(`Action ${action} completed in ${duration}ms`);
      }
    };
  };
}