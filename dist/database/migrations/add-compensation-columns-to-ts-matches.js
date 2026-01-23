"use strict";
/**
 * Migration: Add compensation columns to ts_matches table
 *
 * Adds columns for compensation/odds data from /compensation/list endpoint:
 * - Win/draw rates from historical confrontation
 * - Recent form win rates
 * - Full compensation data as JSONB backup
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCompensationColumnsToTsMatches = addCompensationColumnsToTsMatches;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function addCompensationColumnsToTsMatches() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add compensation columns
        await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS home_win_rate FLOAT,
      ADD COLUMN IF NOT EXISTS away_win_rate FLOAT,
      ADD COLUMN IF NOT EXISTS draw_rate FLOAT,
      ADD COLUMN IF NOT EXISTS home_recent_win_rate FLOAT,
      ADD COLUMN IF NOT EXISTS away_recent_win_rate FLOAT,
      ADD COLUMN IF NOT EXISTS compensation_data JSONB;
    `);
        // Create indexes for compensation rate queries (optional, for filtering/sorting)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_home_win_rate 
      ON ts_matches(home_win_rate) WHERE home_win_rate IS NOT NULL;
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_away_win_rate 
      ON ts_matches(away_win_rate) WHERE away_win_rate IS NOT NULL;
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_draw_rate 
      ON ts_matches(draw_rate) WHERE draw_rate IS NOT NULL;
    `);
        // Create GIN index for compensation_data JSONB column (for JSON queries)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_compensation_data 
      ON ts_matches USING GIN (compensation_data) WHERE compensation_data IS NOT NULL;
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ Compensation columns added to ts_matches table successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to add compensation columns to ts_matches table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if called directly
if (require.main === module) {
    addCompensationColumnsToTsMatches()
        .then(() => {
        console.log('Migration completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}
