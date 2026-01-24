/**
 * Check PostgreSQL Pool Limits
 * Run: tsx check-pool-limits.ts
 */

// Skip dotenv if .env doesn't exist (use env from PM2/shell)
import { existsSync } from 'fs';
if (existsSync('.env')) {
  await import('dotenv').then(m => m.config());
}

import { pool } from './src/database/connection';

async function checkPoolLimits() {
  let client;
  try {
    client = await pool.connect();

    console.log('=== POSTGRES CONNECTION LIMITS ===\n');

    const r1 = await client.query('SHOW max_connections');
    console.log('max_connections:', r1.rows[0].max_connections);

    const r2 = await client.query('SHOW superuser_reserved_connections');
    console.log('superuser_reserved_connections:', r2.rows[0].superuser_reserved_connections);

    const r3 = await client.query('SELECT count(*) as current_connections FROM pg_stat_activity');
    console.log('current_connections:', r3.rows[0].current_connections);

    console.log('\n=== CONNECTIONS BY STATE ===\n');
    const r4 = await client.query('SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY count DESC');
    r4.rows.forEach(row => {
      console.log(`  ${row.state || 'NULL'.padEnd(20)}: ${row.count}`);
    });

    // Calculate safe pool max
    const maxConn = parseInt(r1.rows[0].max_connections);
    const superuserReserved = parseInt(r2.rows[0].superuser_reserved_connections);
    const headroom = 20;
    const safeMax = Math.min(maxConn - superuserReserved - headroom, 80);

    console.log('\n=== SAFE POOL MAX CALCULATION ===\n');
    console.log(`  max_connections: ${maxConn}`);
    console.log(`  superuser_reserved: ${superuserReserved}`);
    console.log(`  headroom: ${headroom}`);
    console.log(`  safe_app_pool_max: ${safeMax}`);
    console.log(`  current app pool max: ${pool.options.max}`);

    if (safeMax >= 50) {
      console.log('\n✅ Safe to increase pool max to 50');
    } else {
      console.log(`\n⚠️  WARNING: Recommended max is ${safeMax}, 50 may be too high`);
    }

    client.release();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

checkPoolLimits();
