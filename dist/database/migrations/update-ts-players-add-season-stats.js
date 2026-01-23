"use strict";
/**
 * Update ts_players Table - Add Season Stats
 *
 * Adds season_stats JSONB column for storing player statistics
 * and shirt_number for jersey number
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTsPlayersAddSeasonStats = updateTsPlayersAddSeasonStats;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function updateTsPlayersAddSeasonStats() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Add season_stats column (JSONB for {goals, assists, yellow_cards, red_cards, minutes_played, etc.})
        await client.query(`
      ALTER TABLE ts_players
      ADD COLUMN IF NOT EXISTS season_stats JSONB DEFAULT '{}'::jsonb
    `);
        // Add shirt_number column
        await client.query(`
      ALTER TABLE ts_players
      ADD COLUMN IF NOT EXISTS shirt_number INTEGER
    `);
        // Add nationality (redundant with country_id but useful for display)
        await client.query(`
      ALTER TABLE ts_players
      ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)
    `);
        // Add current_season_id for which season the stats apply
        await client.query(`
      ALTER TABLE ts_players
      ADD COLUMN IF NOT EXISTS current_season_id VARCHAR(255)
    `);
        // Create index for season lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_season_id ON ts_players(current_season_id)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ ts_players table updated with season_stats columns');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to update ts_players table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if executed directly
if (require.main === module) {
    updateTsPlayersAddSeasonStats()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
