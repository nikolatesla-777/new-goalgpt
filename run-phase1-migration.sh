#!/bin/bash

# PHASE-1 HARDENING - Migration Runner
# Run this script to apply Phase-1 database changes

set -e  # Exit on error

echo "========================================="
echo "  PHASE-1 HARDENING - MIGRATION RUNNER  "
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from project root directory"
  exit 1
fi

# Check if migration file exists
if [ ! -f "src/database/migrations/005-phase1-hardening.ts" ]; then
  echo "❌ Error: Migration file not found"
  exit 1
fi

echo "📋 Migration: 005-phase1-hardening.ts"
echo ""
echo "This migration will:"
echo "  1. Make telegram_message_id nullable"
echo "  2. Add retry_count column"
echo "  3. Add error_log column"
echo "  4. Add last_error_at column"
echo "  5. Migrate 'active' status to 'published'"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo ""
echo "🚀 Running migration..."
echo ""

# Run migration using npx tsx
npx tsx -e "
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔒 PHASE-1 HARDENING: Updating telegram_posts schema...');

    // 1. Make telegram_message_id nullable
    await client.query(\`
      ALTER TABLE telegram_posts
      ALTER COLUMN telegram_message_id DROP NOT NULL
    \`);

    // 2. Add retry tracking
    await client.query(\`
      ALTER TABLE telegram_posts
      ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL
    \`);

    // 3. Add error logging
    await client.query(\`
      ALTER TABLE telegram_posts
      ADD COLUMN error_log TEXT
    \`);

    await client.query(\`
      ALTER TABLE telegram_posts
      ADD COLUMN last_error_at TIMESTAMPTZ
    \`);

    // 4. Migrate existing 'active' status to 'published'
    const result = await client.query(\`
      UPDATE telegram_posts
      SET status = 'published'
      WHERE status = 'active'
      RETURNING id
    \`);

    console.log(\`✅ Migrated \${result.rowCount} posts from 'active' to 'published'\`);

    // 5. Create index
    await client.query(\`
      CREATE INDEX IF NOT EXISTS idx_telegram_posts_retry_count
      ON telegram_posts (retry_count)
    \`);

    console.log('✅ PHASE-1 HARDENING: Schema updated successfully');
    console.log('   - telegram_message_id is now nullable');
    console.log('   - retry_count column added');
    console.log('   - error_log and last_error_at columns added');
    console.log('   - Index on retry_count created');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
"

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Restart backend: npm run dev (or pm2 restart goalgpt)"
echo "  2. Verify: curl http://localhost:3000/api/telegram/health"
echo "  3. Test idempotency by publishing same match twice"
echo ""
echo "See PHASE-1-HARDENING-COMPLETE.md for full documentation."
