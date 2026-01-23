"use strict";
/**
 * Migration: Add statistics column to ts_matches table
 *
 * Adds a JSONB column to store match statistics (possession, shots, corners, etc.)
 * Note: Stats are only available for popular competitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addStatisticsColumnToTsMatches = addStatisticsColumnToTsMatches;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function addStatisticsColumnToTsMatches() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add statistics JSONB column
        await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS statistics JSONB;
    `);
        // Create index for JSONB queries (optional, but useful for filtering)
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_statistics 
      ON ts_matches USING GIN (statistics);
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ statistics column added to ts_matches table successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to add statistics column to ts_matches table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if called directly
if (require.main === module) {
    addStatisticsColumnToTsMatches()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
