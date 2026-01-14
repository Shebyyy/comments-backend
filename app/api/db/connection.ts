import { sql } from '@vercel/postgres';

export const db = sql;

export async function testConnection() {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}