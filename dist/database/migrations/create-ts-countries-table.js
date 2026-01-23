"use strict";
/**
 * Create ts_countries Table Migration
 *
 * Creates the ts_countries table for storing country/region data from TheSports API
 * Note: category_id references ts_categories(external_id) but not as a formal FK constraint
 * to allow for flexibility during sync operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTsCountriesTable = createTsCountriesTable;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function createTsCountriesTable() {
    const client = await connection_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Create ts_countries table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ts_countries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        category_id VARCHAR(255),
        name VARCHAR(255),
        logo VARCHAR(500),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        // Create index on external_id for fast lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_countries_external_id ON ts_countries(external_id)
    `);
        // Create index on category_id for joins with categories
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_countries_category_id ON ts_countries(category_id)
    `);
        // Create index on name for search
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_countries_name ON ts_countries(name)
    `);
        await client.query('COMMIT');
        logger_1.logger.info('✅ ts_countries table created successfully');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('❌ Failed to create ts_countries table:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
// Run migration if executed directly
if (require.main === module) {
    createTsCountriesTable()
        .then(() => {
        logger_1.logger.info('Migration completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    });
}
