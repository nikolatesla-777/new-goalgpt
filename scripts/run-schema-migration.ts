#!/usr/bin/env ts-node
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { up as schemaUp } from '../src/database/migrations/001-mobile-app-schema';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const db = new Kysely<any>({
  dialect: new PostgresDialect({ pool }),
});

async function runMigration() {
  try {
    console.log('🔄 Running schema migration...');
    await schemaUp(db);
    console.log('✅ Schema migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
