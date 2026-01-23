"use strict";
/**
 * Migration: Add score columns to ts_matches table
 *
 * Adds separate columns for regular_score, overtime_score, and penalty_score
 * to prevent double counting and enable correct display score calculation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addScoreColumnsToTsMatches = addScoreColumnsToTsMatches;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function addScoreColumnsToTsMatches() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add score columns
        await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS home_score_regular INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_score_overtime INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_score_penalties INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_regular INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_overtime INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_penalties INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_score_display INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_display INTEGER DEFAULT 0;
    `);
        // Create indexes for score queries
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_score_display 
      ON ts_matches(home_score_display, away_score_display);
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ Score columns added to ts_matches table successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to add score columns to ts_matches table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if called directly
if (require.main === module) {
    addScoreColumnsToTsMatches()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
