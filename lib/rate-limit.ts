import { ActionType, RateLimitConfig } from '@/lib/types';

export const RATE_LIMITS: Record<ActionType, RateLimitConfig> = {
  comment: { max: 5, window: 60 }, // 5 comments per hour
  vote: { max: 20, window: 60 },    // 20 votes per hour
  delete: { max: 10, window: 60 },   // 10 deletions per hour
  edit: { max: 15, window: 60 },     // 15 edits per hour
  report: { max: 10, window: 60 },   // 10 reports per hour
  ban: { max: 5, window: 1440 },     // 5 bans per day
  warn: { max: 20, window: 60 }      // 20 warnings per hour
};

export async function checkRateLimit(
  userId: number, 
  actionType: ActionType, 
  db: any
): Promise<void> {
  const limit = RATE_LIMITS[actionType];
  if (!limit) {
    throw new Error(`Invalid action type: ${actionType}`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - limit.window * 60 * 1000);

  // Clean old rate limit records
  await db.rateLimit.deleteMany({
    where: {
      window_end: {
        lt: now
      }
    }
  });

  // Check current window
  const currentCounts = await db.rateLimit.findMany({
    where: {
      user_id: userId,
      action_type: actionType,
      window_start: {
        gte: windowStart
      }
    }
  });

  const total = currentCounts.reduce((sum: number, record: any) => sum + record.action_count, 0);

  if (total >= limit.max) {
    throw new Error(
      `Rate limit exceeded for ${actionType}. Maximum ${limit.max} per ${limit.window} minutes.`
    );
  }

  // Record this action
  const windowEnd = new Date(now.getTime() + limit.window * 60 * 1000);
  
  await db.rateLimit.upsert({
    where: {
      user_id_action_type_window_start: {
        user_id: userId,
        action_type: actionType,
        window_start: windowStart
      }
    },
    update: {
      action_count: {
        increment: 1
      },
      window_end: windowEnd
    },
    create: {
      user_id: userId,
      action_type: actionType,
      action_count: 1,
      window_start: windowStart,
      window_end: windowEnd
    }
  });
}
