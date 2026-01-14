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

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}