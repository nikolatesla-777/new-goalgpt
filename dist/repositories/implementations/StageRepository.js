"use strict";
/**
 * Stage Repository
 *
 * Data access layer for ts_stages table
 * Crucial for distinguishing "Group Stage" vs "Finals"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class StageRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_stages', 'external_id');
    }
    /**
     * Find stages by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find stages by season_id (ordered by sort_order field)
     */
    async findBySeasonId(seasonId) {
        const query = `SELECT * FROM ${this.tableName} WHERE season_id = $1 ORDER BY sort_order ASC, name ASC`;
        return this.executeQuery(query, [seasonId]);
    }
    /**
     * Find stages by mode (1=League, 2=Cup)
     */
    async findByMode(mode) {
        const query = `SELECT * FROM ${this.tableName} WHERE mode = $1 ORDER BY season_id, sort_order ASC`;
        return this.executeQuery(query, [mode]);
    }
    /**
     * Create or update stage (idempotent)
     */
    async createOrUpdate(stageData) {
        if (!stageData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(stageData, 'external_id');
    }
    /**
     * Batch upsert stages
     */
    async batchUpsert(stages) {
        if (stages.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const stage of stages) {
                const stageData = {
                    external_id: stage.external_id,
                    season_id: stage.season_id || null,
                    name: stage.name || null,
                    mode: stage.mode || null,
                    group_count: stage.group_count || null,
                    round_count: stage.round_count || null,
                    sort_order: stage.sort_order || null,
                };
                // Convert updated_at timestamp to Date if provided
                if (stage.updated_at) {
                    stageData.updated_at = new Date(stage.updated_at * 1000);
                }
                const result = await this.upsert(stageData, 'external_id');
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
exports.StageRepository = StageRepository;
