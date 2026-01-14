import { sql, db } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function runMigrations() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Read migration SQL
    const sqlPath = join(process.cwd(), 'sql', '001_initial_schema.sql');
    const migrationSQL = readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the entire migration
    // Vercel Postgres can handle multi-statement SQL
    await sql.query(migrationSQL);
    
    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    // Check if error is about objects already existing
    if (error instanceof Error && 
        (error.message.includes('already exists') || 
         error.message.includes('duplicate'))) {
      console.log('⏭️  Migration skipped (tables already exist)');
      return true;
    }
    
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// API endpoint for running migrations
export async function GET() {
  try {
    const success = await runMigrations();
    return Response.json({ 
      success, 
      message: 'Migration completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
