"use strict";
/**
 * Competition Repository
 *
 * Data access layer for ts_competitions table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitionRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class CompetitionRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_competitions', 'external_id');
    }
    /**
     * Find competitions by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        // JOIN ts_countries to get country_name for "Country - League" display format
        const query = `
      SELECT c.*, co.name as country_name 
      FROM ${this.tableName} c
      LEFT JOIN ts_countries co ON c.country_id = co.external_id
      WHERE c.external_id = ANY($1)
    `;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find single competition by external ID (with country JOIN)
     */
    async findByExternalId(externalId) {
        const query = `
      SELECT c.*, co.name as country_name 
      FROM ${this.tableName} c
      LEFT JOIN ts_countries co ON c.country_id = co.external_id
      WHERE c.external_id = $1
    `;
        const results = await this.executeQuery(query, [externalId]);
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Create or update competition (idempotent)
     * CRITICAL: Removes id field to prevent NOT NULL constraint violation
     */
    async createOrUpdate(competitionData) {
        if (!competitionData.external_id) {
            throw new Error('external_id is required');
        }
        // CRITICAL FIX: Create clean object WITHOUT id field from scratch
        // Do NOT use spread operator - it might contain id
        const cleanData = {
            external_id: competitionData.external_id,
            name: competitionData.name || 'Unknown Competition',
            short_name: competitionData.short_name || null,
            logo_url: competitionData.logo_url || null,
            type: competitionData.type || null,
            category_id: competitionData.category_id || null,
            country_id: competitionData.country_id || null,
            cur_season_id: competitionData.cur_season_id || null,
            cur_stage_id: competitionData.cur_stage_id || null,
            primary_color: competitionData.primary_color || null,
            secondary_color: competitionData.secondary_color || null,
            uid: competitionData.uid || null,
            is_duplicate: competitionData.is_duplicate || false,
        };
        // TRIPLE-CHECK: Ensure id is NEVER in the object
        if ('id' in cleanData) {
            delete cleanData.id;
        }
        if ('created_at' in cleanData) {
            delete cleanData.created_at;
        }
        // Final safety check: explicitly set id to undefined
        cleanData.id = undefined;
        delete cleanData.id;
        return this.upsert(cleanData, 'external_id');
    }
    /**
     * Batch upsert competitions
     * CRITICAL: Triple-check ID stripping to prevent NOT NULL constraint violation
     */
    async batchUpsert(competitions) {
        if (competitions.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const comp of competitions) {
                // Determine if this is a duplicate based on uid field
                const isDuplicate = !!(comp.uid && comp.uid.trim() !== '');
                // CRITICAL FIX: Create clean object WITHOUT id field from scratch
                // Do NOT use spread operator on comp - it might contain id
                const cleanComp = {
                    external_id: comp.external_id,
                    name: comp.name,
                    short_name: comp.short_name || null,
                    logo_url: comp.logo_url || null,
                    type: comp.type || null,
                    category_id: comp.category_id || null,
                    country_id: comp.country_id || null,
                    cur_season_id: comp.cur_season_id || null,
                    cur_stage_id: comp.cur_stage_id || null,
                    primary_color: comp.primary_color || null,
                    secondary_color: comp.secondary_color || null,
                    uid: comp.uid || null,
                    is_duplicate: isDuplicate,
                };
                // TRIPLE-CHECK: Ensure id is NEVER in the object
                if ('id' in cleanComp) {
                    delete cleanComp.id;
                }
                if ('created_at' in cleanComp) {
                    delete cleanComp.created_at;
                }
                // Final safety check: explicitly set id to undefined
                cleanComp.id = undefined;
                delete cleanComp.id;
                const result = await this.upsert(cleanComp, 'external_id');
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
exports.CompetitionRepository = CompetitionRepository;
