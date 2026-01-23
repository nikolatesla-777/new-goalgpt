"use strict";
/**
 * Coach Repository
 *
 * Data access layer for ts_coaches table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoachRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class CoachRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_coaches', 'external_id');
    }
    /**
     * Find coaches by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find coach by team_id (current coach lookup)
     */
    async findByTeamId(teamId) {
        const query = `SELECT * FROM ${this.tableName} WHERE team_id = $1 AND type = 1 ORDER BY joined DESC LIMIT 1`;
        const rows = await this.executeQuery(query, [teamId]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Create or update coach (idempotent)
     */
    async createOrUpdate(coachData) {
        if (!coachData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(coachData, 'external_id');
    }
    /**
     * Batch upsert coaches
     */
    async batchUpsert(coaches) {
        if (coaches.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const coach of coaches) {
                // Determine if this is a duplicate based on uid field
                const isDuplicate = !!(coach.uid && coach.uid.trim() !== '');
                const coachData = {
                    external_id: coach.external_id,
                    name: coach.name,
                    short_name: coach.short_name || null,
                    logo: coach.logo || null,
                    team_id: coach.team_id || null,
                    country_id: coach.country_id || null,
                    type: coach.type || null,
                    birthday: coach.birthday || null,
                    age: coach.age || null,
                    preferred_formation: coach.preferred_formation || null,
                    nationality: coach.nationality || null,
                    joined: coach.joined || null,
                    contract_until: coach.contract_until || null,
                    uid: coach.uid || null,
                    is_duplicate: isDuplicate,
                };
                // Convert updated_at timestamp to Date if provided
                if (coach.updated_at) {
                    coachData.updated_at = new Date(coach.updated_at * 1000);
                }
                const result = await this.upsert(coachData, 'external_id');
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
exports.CoachRepository = CoachRepository;
