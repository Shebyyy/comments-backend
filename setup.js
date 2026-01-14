const { createClient } = require('@vercel/postgres');

async function setupDatabase() {
  console.log('Setting up database...');
  
  const client = createClient();
  await client.connect();
  
  try {
    // Read and execute the migration
    const fs = require('fs');
    const path = require('path');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'sql', '001_initial_schema.sql'), 
      'utf8'
    );
    
    await client.query(migrationSQL);
    console.log('✅ Database setup completed successfully!');
    
    // Test connection
    const result = await client.query('SELECT COUNT(*) as user_count FROM users');
    console.log(`📊 Current users: ${result.rows[0].user_count}`);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { setupDatabase };