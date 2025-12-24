/**
 * Test database connection
 */
const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log('\n🔍 Testing database connection...\n');
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'goalgpt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 5,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    console.error('❌ Pool error:', err.message);
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT NOW() as now, version() as version');
    console.log('   Current time:', result.rows[0].now);
    console.log('   PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    client.release();
    await pool.end();
    console.log('\n✅ Connection test complete');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    if (error.code === 'ENETUNREACH') {
      console.error('\n💡 IPv6 connection issue detected');
      console.error('   Try using connection pooling URL instead of direct connection');
    }
    await pool.end();
    process.exit(1);
  }
}

testConnection();

