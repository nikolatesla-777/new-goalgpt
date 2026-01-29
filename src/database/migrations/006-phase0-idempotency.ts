import { Kysely, sql } from 'kysely';

/**
 * PHASE-0: Critical Fixes Migration
 *
 * Changes:
 * 1. Add dedupe_key column for idempotency
 * 2. Add content_type and template_version columns
 * 3. Create telegram_blocked_chats table for 403 handling
 * 4. Create job_execution_logs table for job tracking
 */
export async function up(db: Kysely<any>): Promise<void> {
  console.log('🚀 PHASE-0: Running critical fixes migration...');

  // ============================================================================
  // 1. IDEMPOTENCY: Add dedupe_key column to telegram_posts
  // ============================================================================
  console.log('📝 Adding idempotency columns to telegram_posts...');

  // Add dedupe_key column
  await sql`
    ALTER TABLE telegram_posts
    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(64)
  `.execute(db);

  // Add content_type column (match, daily_list, etc.)
  await sql`
    ALTER TABLE telegram_posts
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'match'
  `.execute(db);

  // Add template_version column
  await sql`
    ALTER TABLE telegram_posts
    ADD COLUMN IF NOT EXISTS template_version VARCHAR(10) DEFAULT 'v2'
  `.execute(db);

  // Create unique index on dedupe_key (partial - only for non-null)
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_posts_dedupe_key
    ON telegram_posts (dedupe_key)
    WHERE dedupe_key IS NOT NULL
  `.execute(db);

  console.log('✅ Idempotency columns added');

  // ============================================================================
  // 2. BLOCKED USERS: Create telegram_blocked_chats table
  // ============================================================================
  console.log('📝 Creating telegram_blocked_chats table...');

  await sql`
    CREATE TABLE IF NOT EXISTS telegram_blocked_chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id VARCHAR(100) NOT NULL UNIQUE,
      blocked_at TIMESTAMPTZ DEFAULT NOW(),
      error_code INTEGER,
      error_description TEXT,
      retry_count INTEGER DEFAULT 0,
      last_retry_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_telegram_blocked_chats_blocked_at
    ON telegram_blocked_chats (blocked_at DESC)
  `.execute(db);

  console.log('✅ telegram_blocked_chats table created');

  // ============================================================================
  // 3. JOB LOGGING: Create job_execution_logs table
  // ============================================================================
  console.log('📝 Creating job_execution_logs table...');

  await sql`
    CREATE TABLE IF NOT EXISTS job_execution_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_name VARCHAR(100) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL,
      duration_ms INTEGER,
      rows_affected INTEGER,
      error_message TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_job_logs_name_started
    ON job_execution_logs (job_name, started_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_job_logs_status
    ON job_execution_logs (status)
  `.execute(db);

  // Add index for cleanup (delete old logs)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_job_logs_created_at
    ON job_execution_logs (created_at)
  `.execute(db);

  console.log('✅ job_execution_logs table created');

  console.log('🎉 PHASE-0 migration completed successfully!');
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('🔄 PHASE-0: Reverting migration...');

  // Drop job_execution_logs
  await sql`DROP TABLE IF EXISTS job_execution_logs`.execute(db);
  console.log('✅ job_execution_logs dropped');

  // Drop telegram_blocked_chats
  await sql`DROP TABLE IF EXISTS telegram_blocked_chats`.execute(db);
  console.log('✅ telegram_blocked_chats dropped');

  // Remove idempotency columns from telegram_posts
  await sql`DROP INDEX IF EXISTS idx_telegram_posts_dedupe_key`.execute(db);
  await sql`
    ALTER TABLE telegram_posts
    DROP COLUMN IF EXISTS dedupe_key,
    DROP COLUMN IF EXISTS content_type,
    DROP COLUMN IF EXISTS template_version
  `.execute(db);
  console.log('✅ Idempotency columns removed from telegram_posts');

  console.log('🔄 PHASE-0 migration reverted');
}
