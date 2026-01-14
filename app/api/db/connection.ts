import { createClient } from '@vercel/postgres';

export const db = createClient();

export async function testConnection() {
  try {
    const result = await db`SELECT NOW()`;
    console.log('Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
