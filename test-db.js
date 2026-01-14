const { createClient } = require('@vercel/postgres');

async function testConnection() {
  console.log('Testing database connection...');
  
  const client = createClient();
  await client.connect();
  
  try {
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log('📅 Current time:', result.rows[0].current_time);
    
    // Test basic table creation
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Test table created successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

testConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));