"use strict";
/**
 * Migration: Add Phase 3 Live Engine columns to ts_matches table
 *
 * Adds columns required for live match synchronization:
 * - Kickoff timestamps (first_half, second_half, overtime)
 * - Minute calculation
 * - Optimistic locking timestamps (provider_update_time, last_event_ts)
 * - Minute update tracking (last_minute_update_ts)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPhase3LiveColumns = addPhase3LiveColumns;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function addPhase3LiveColumns() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add Phase 3 columns
        await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS first_half_kickoff_ts BIGINT,
      ADD COLUMN IF NOT EXISTS second_half_kickoff_ts BIGINT,
      ADD COLUMN IF NOT EXISTS overtime_kickoff_ts BIGINT,
      ADD COLUMN IF NOT EXISTS minute INTEGER,
      ADD COLUMN IF NOT EXISTS provider_update_time BIGINT,
      ADD COLUMN IF NOT EXISTS last_event_ts BIGINT,
      ADD COLUMN IF NOT EXISTS last_minute_update_ts BIGINT;
    `);
        // Create partial indexes for kickoff timestamps (only where not null)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_first_half_kickoff 
      ON ts_matches(first_half_kickoff_ts) WHERE first_half_kickoff_ts IS NOT NULL;
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_second_half_kickoff 
      ON ts_matches(second_half_kickoff_ts) WHERE second_half_kickoff_ts IS NOT NULL;
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_overtime_kickoff 
      ON ts_matches(overtime_kickoff_ts) WHERE overtime_kickoff_ts IS NOT NULL;
    `);
        // Create partial indexes for optimistic locking timestamps
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_provider_update_time 
      ON ts_matches(provider_update_time) WHERE provider_update_time IS NOT NULL;
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_last_event_ts 
      ON ts_matches(last_event_ts) WHERE last_event_ts IS NOT NULL;
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ Phase 3 Live Engine columns added to ts_matches table successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to add Phase 3 Live Engine columns to ts_matches table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if called directly
if (require.main === module) {
    addPhase3LiveColumns()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
