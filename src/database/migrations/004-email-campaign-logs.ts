/**
 * Migration: 004-email-campaign-logs
 *
 * Creates the email_campaign_logs table for tracking
 * re-engagement email campaigns sent via Resend.
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

const UP_SQL = `
  CREATE TABLE IF NOT EXISTS email_campaign_logs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name         VARCHAR(255) NOT NULL,
    channel               VARCHAR(50)  NOT NULL DEFAULT 'email',
    segment_params        JSONB        NOT NULL DEFAULT '{}',
    recipient_count       INTEGER      NOT NULL DEFAULT 0,
    accepted_count        INTEGER,
    rejected_count        INTEGER,
    status                VARCHAR(20)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'partial', 'failed')),
    error_message         TEXT,
    sent_at               TIMESTAMPTZ,
    created_by_admin_id   VARCHAR(255) NOT NULL DEFAULT 'system',
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_status    ON email_campaign_logs (status);
  CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_created   ON email_campaign_logs (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_admin     ON email_campaign_logs (created_by_admin_id);

  COMMENT ON TABLE  email_campaign_logs IS 'Tracks GoalGPT re-engagement email campaigns sent via Resend';
  COMMENT ON COLUMN email_campaign_logs.segment_params  IS 'JSON: {inactiveDays, planFilter}';
  COMMENT ON COLUMN email_campaign_logs.channel         IS 'email | whatsapp | sms';
  COMMENT ON COLUMN email_campaign_logs.accepted_count  IS 'Emails accepted by Resend API';
  COMMENT ON COLUMN email_campaign_logs.rejected_count  IS 'Emails rejected (invalid address, etc.)';
`;

const DOWN_SQL = `
  DROP TABLE IF EXISTS email_campaign_logs CASCADE;
`;

export async function up(): Promise<void> {
  logger.info('[Migration 004] Creating email_campaign_logs table...');
  await pool.query(UP_SQL);
  logger.info('[Migration 004] Done.');
}

export async function down(): Promise<void> {
  logger.info('[Migration 004] Dropping email_campaign_logs table...');
  await pool.query(DOWN_SQL);
  logger.info('[Migration 004] Done.');
}

// Run directly: npx tsx src/database/migrations/004-email-campaign-logs.ts
if (require.main === module) {
  up()
    .then(() => {
      logger.info('[Migration 004] Migration applied successfully');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, '[Migration 004] Migration failed');
      process.exit(1);
    });
}
