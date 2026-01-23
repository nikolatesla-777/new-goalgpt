"use strict";
/**
 * Season Repository
 *
 * Data access layer for ts_seasons table
 * Critical for "Standings/Table" and filtering current matches
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeasonRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class SeasonRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_seasons', 'external_id');
    }
    /**
     * Find seasons by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find current season by competition_id
     * Uses composite index for fast lookup
     */
    async findCurrentByCompetitionId(competitionId) {
        const query = `SELECT * FROM ${this.tableName} WHERE competition_id = $1 AND is_current = true ORDER BY start_time DESC LIMIT 1`;
        const rows = await this.executeQuery(query, [competitionId]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Find all seasons by competition_id
     */
    async findByCompetitionId(competitionId) {
        const query = `SELECT * FROM ${this.tableName} WHERE competition_id = $1 ORDER BY start_time DESC`;
        return this.executeQuery(query, [competitionId]);
    }
    /**
     * Find all current seasons
     */
    async findCurrentSeasons() {
        const query = `SELECT * FROM ${this.tableName} WHERE is_current = true ORDER BY competition_id, start_time DESC`;
        return this.executeQuery(query);
    }
    /**
     * Create or update season (idempotent)
     */
    async createOrUpdate(seasonData) {
        if (!seasonData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(seasonData, 'external_id');
    }
    /**
     * Batch upsert seasons
     */
    async batchUpsert(seasons) {
        if (seasons.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const season of seasons) {
                const seasonData = {
                    external_id: season.external_id,
                    competition_id: season.competition_id || null,
                    year: season.year || null,
                    // Convert integers (0/1) to booleans
                    is_current: season.is_current !== undefined ? (season.is_current === 1) : null,
                    has_table: season.has_table !== undefined ? (season.has_table === 1) : null,
                    has_player_stats: season.has_player_stats !== undefined ? (season.has_player_stats === 1) : null,
                    has_team_stats: season.has_team_stats !== undefined ? (season.has_team_stats === 1) : null,
                    start_time: season.start_time || null,
                    end_time: season.end_time || null,
                };
                // Convert updated_at timestamp to Date if provided
                if (season.updated_at) {
                    seasonData.updated_at = new Date(season.updated_at * 1000);
                }
                const result = await this.upsert(seasonData, 'external_id');
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
exports.SeasonRepository = SeasonRepository;
