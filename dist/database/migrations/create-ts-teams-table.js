"use strict";
/**
 * Create ts_teams Table Migration
 *
 * Creates the ts_teams table for storing team data from TheSports API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTsTeamsTable = createTsTeamsTable;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function createTsTeamsTable() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Drop table if exists (for clean migration)
        await client.query('DROP TABLE IF EXISTS ts_teams CASCADE');
        // Create ts_teams table
        await client.query(`
      CREATE TABLE ts_teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo_url TEXT,
        country_id VARCHAR(255),
        competition_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        // Create indexes (after table creation)
        await client.query(`
      CREATE INDEX idx_ts_teams_external_id ON ts_teams(external_id)
    `);
        await client.query(`
      CREATE INDEX idx_ts_teams_name ON ts_teams(name)
    `);
        await client.query(`
      CREATE INDEX idx_ts_teams_country_id ON ts_teams(country_id)
    `);
        await client.query(`
      CREATE INDEX idx_ts_teams_competition_id ON ts_teams(competition_id)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ ts_teams table created successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to create ts_teams table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if executed directly
if (require.main === module) {
    createTsTeamsTable()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
