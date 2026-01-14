import { db } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function runMigrations() {
  try {
    const sqlPath = join(process.cwd(), 'sql', '001_initial_schema.sql');
    const migrationSQL = readFileSync(sqlPath, 'utf8');
    
    await db.query(migrationSQL);
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// API endpoint for running migrations
export async function GET() {
  try {
    const success = await runMigrations();
    return Response.json({ 
      success, 
      message: success ? 'Migration completed' : 'Migration failed' 
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
