import { sql } from '@vercel/postgres';

/**
 * Vercel Postgres using sql template literals
 * No manual connection needed - perfect for serverless
 * Automatically uses POSTGRES_URL from environment
 */

export const db = sql;

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Check if required tables exist
 */
export async function checkDatabaseReady() {
  try {
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'comments', 'comment_votes', 'rate_limits')
    `;
    
    const tables = result.rows.map((row: any) => row.table_name);
    const requiredTables = ['users', 'comments', 'comment_votes', 'rate_limits'];
    const missingTables = requiredTables.filter(t => !tables.includes(t));
    
    if (missingTables.length > 0) {
      console.warn('⚠️ Missing tables:', missingTables);
      return false;
    }
    
    console.log('✅ All required tables exist');
    return true;
  } catch (error) {
    console.error('❌ Database check failed:', error);
    return false;
  }
}
