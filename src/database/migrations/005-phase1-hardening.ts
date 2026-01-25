import { Kysely, sql } from 'kysely';

/**
 * PHASE-1 CRITICAL HARDENING
 *
 * Changes:
 * 1. Make telegram_message_id nullable (DRAFT posts don't have it yet)
 * 2. Add retry tracking columns
 * 3. Add error logging columns
 *
 * New Status Values:
 * - 'draft'     : Post reserved, not sent to Telegram yet
 * - 'published' : Successfully sent to Telegram
 * - 'failed'    : Failed after max retries
 * - 'settled'   : Settlement completed
 *
 * Old 'active' status will be migrated to 'published'
 */
export async function up(db: Kysely<any>): Promise<void> {
  console.log('🔒 PHASE-1 HARDENING: Updating telegram_posts schema...');

  // 1. Make telegram_message_id nullable (for DRAFT state)
  await sql`
    ALTER TABLE telegram_posts
    ALTER COLUMN telegram_message_id DROP NOT NULL
  `.execute(db);

  // 2. Add retry tracking
  await sql`
    ALTER TABLE telegram_posts
    ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL
  `.execute(db);

  // 3. Add error logging
  await sql`
    ALTER TABLE telegram_posts
    ADD COLUMN error_log TEXT
  `.execute(db);

  await sql`
    ALTER TABLE telegram_posts
    ADD COLUMN last_error_at TIMESTAMPTZ
  `.execute(db);

  // 4. Migrate existing 'active' status to 'published'
  await sql`
    UPDATE telegram_posts
    SET status = 'published'
    WHERE status = 'active'
  `.execute(db);

  // 5. Add index on retry_count for monitoring
  await db.schema
    .createIndex('idx_telegram_posts_retry_count')
    .on('telegram_posts')
    .column('retry_count')
    .execute();

  console.log('✅ PHASE-1 HARDENING: Schema updated successfully');
  console.log('   - telegram_message_id is now nullable');
  console.log('   - retry_count column added');
  console.log('   - error_log and last_error_at columns added');
  console.log('   - Existing posts migrated to "published" status');
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('🔄 PHASE-1 HARDENING: Reverting schema changes...');

  // Remove new columns
  await sql`
    ALTER TABLE telegram_posts
    DROP COLUMN IF EXISTS retry_count,
    DROP COLUMN IF EXISTS error_log,
    DROP COLUMN IF EXISTS last_error_at
  `.execute(db);

  // Revert status migration
  await sql`
    UPDATE telegram_posts
    SET status = 'active'
    WHERE status = 'published'
  `.execute(db);

  // Make telegram_message_id NOT NULL again (may fail if DRAFT posts exist)
  await sql`
    ALTER TABLE telegram_posts
    ALTER COLUMN telegram_message_id SET NOT NULL
  `.execute(db);

  // Drop index
  await db.schema
    .dropIndex('idx_telegram_posts_retry_count')
    .ifExists()
    .execute();

  console.log('✅ PHASE-1 HARDENING: Schema reverted');
}
