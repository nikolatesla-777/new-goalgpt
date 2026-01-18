#!/usr/bin/env npx tsx
/**
 * Test database connection
 */

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

async function testConnection() {
  console.log('Testing database connection...\n');
  console.log('Config:');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  Port: ${process.env.DB_PORT}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log('');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '6543'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log('✓ Connected to database!\n');

    // Test query
    const result = await client.query('SELECT NOW() as time, current_user as user');
    console.log('Database time:', result.rows[0].time);
    console.log('Current user:', result.rows[0].user);

    // List tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\nTables in database:');
    tables.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));

    // Check ts_competitions
    const competitions = await client.query(`
      SELECT COUNT(*) as count FROM ts_competitions
    `);
    console.log(`\nts_competitions count: ${competitions.rows[0].count}`);

    client.release();
    await pool.end();
    console.log('\n✓ Test complete!');
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    if (error.code) console.error('  Code:', error.code);
  }

  process.exit(0);
}

testConnection();
