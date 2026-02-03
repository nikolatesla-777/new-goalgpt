/**
 * Migration: Create telegram_user_preferences table
 *
 * Stores user preferences for notifications and settings
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function up() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('[Migration] Creating telegram_user_preferences table...');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS telegram_user_preferences (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        language_code VARCHAR(10) DEFAULT 'tr',

        -- Notification preferences
        notifications_enabled BOOLEAN DEFAULT true,
        notify_btts BOOLEAN DEFAULT true,
        notify_over25 BOOLEAN DEFAULT true,
        notify_corners BOOLEAN DEFAULT false,
        notify_cards BOOLEAN DEFAULT false,
        notify_ht_over05 BOOLEAN DEFAULT false,
        notification_time TIME DEFAULT '09:00:00',

        -- Metadata
        created_at TIMESTAMP DEFAULT NOW(),
        last_active_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_user_preferences_chat_id
      ON telegram_user_preferences(chat_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_user_preferences_notifications
      ON telegram_user_preferences(notifications_enabled)
      WHERE notifications_enabled = true
    `);

    await client.query('COMMIT');
    logger.info('[Migration] ✅ telegram_user_preferences table created');

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Migration] ❌ Error creating telegram_user_preferences table:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('[Migration] Dropping telegram_user_preferences table...');

    await client.query('DROP TABLE IF EXISTS telegram_user_preferences');

    await client.query('COMMIT');
    logger.info('[Migration] ✅ telegram_user_preferences table dropped');

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Migration] ❌ Error dropping telegram_user_preferences table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  up()
    .then(() => {
      logger.info('[Migration] Complete');
      process.exit(0);
    })
    .catch(error => {
      logger.error('[Migration] Failed:', error);
      process.exit(1);
    });
}
