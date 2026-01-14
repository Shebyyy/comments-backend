import { createClient } from '@vercel/postgres';

export const db = createClient();

// Connect to database
export async function connectDatabase() {
  try {
    await db.connect();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export async function testConnection() {
  try {
    await connectDatabase();
    const result = await db.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}