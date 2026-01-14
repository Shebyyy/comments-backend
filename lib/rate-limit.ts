import { ActionType, RateLimitConfig } from '@/lib/types';

export const RATE_LIMITS: Record<ActionType, RateLimitConfig> = {
  comment: { max: 5, window: 60 }, // 5 comments per hour
  vote: { max: 20, window: 60 },    // 20 votes per hour
  delete: { max: 10, window: 60 }   // 10 deletions per hour
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
  await db.query(`
    DELETE FROM rate_limits 
    WHERE window_end < $1
  `, [now]);

  // Check current window
  const currentCountResult = await db.query(`
    SELECT COALESCE(SUM(action_count), 0) as total
    FROM rate_limits 
    WHERE user_id = $1 
      AND action_type = $2 
      AND window_start >= $3
  `, [userId, actionType, windowStart]);

  const total = parseInt(currentCountResult.rows[0]?.total || '0');

  if (total >= limit.max) {
    throw new Error(
      `Rate limit exceeded for ${actionType}. Maximum ${limit.max} per ${limit.window} minutes.`
    );
  }

  // Record this action
  const windowEnd = new Date(now.getTime() + limit.window * 60 * 1000);
  
  await db.query(`
    INSERT INTO rate_limits (user_id, action_type, window_start, window_end)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, action_type, window_start)
    DO UPDATE SET 
      action_count = rate_limits.action_count + 1,
      window_end = EXCLUDED.window_end
  `, [userId, actionType, windowStart, windowEnd]);
}