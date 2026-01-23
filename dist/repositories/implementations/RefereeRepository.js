"use strict";
/**
 * Referee Repository
 *
 * Data access layer for ts_referees table
 * Critical for future "Card/Penalty" AI predictions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefereeRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class RefereeRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_referees', 'external_id');
    }
    /**
     * Find referees by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find referees by country_id
     */
    async findByCountryId(countryId) {
        const query = `SELECT * FROM ${this.tableName} WHERE country_id = $1 ORDER BY name`;
        return this.executeQuery(query, [countryId]);
    }
    /**
     * Create or update referee (idempotent)
     */
    async createOrUpdate(refereeData) {
        if (!refereeData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(refereeData, 'external_id');
    }
    /**
     * Batch upsert referees
     */
    async batchUpsert(referees) {
        if (referees.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const referee of referees) {
                const refereeData = {
                    external_id: referee.external_id,
                    name: referee.name,
                    short_name: referee.short_name || null,
                    logo: referee.logo || null,
                    country_id: referee.country_id || null,
                    birthday: referee.birthday || null,
                };
                // Convert updated_at timestamp to Date if provided
                if (referee.updated_at) {
                    refereeData.updated_at = new Date(referee.updated_at * 1000);
                }
                const result = await this.upsert(refereeData, 'external_id');
                results.push(result);
            }
            await client.query('COMMIT');
            return results;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.RefereeRepository = RefereeRepository;
