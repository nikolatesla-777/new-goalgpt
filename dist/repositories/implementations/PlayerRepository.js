"use strict";
/**
 * Player Repository
 *
 * Data access layer for ts_players table
 * Optimized for high-volume batch operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
const connection_1 = require("../../database/connection");
class PlayerRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_players', 'external_id');
    }
    /**
     * Find players by external IDs (batch)
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
        return this.executeQuery(query, [externalIds]);
    }
    /**
     * Find players by team_id (squad lookup)
     */
    async findByTeamId(teamId) {
        const query = `SELECT * FROM ${this.tableName} WHERE team_id = $1 ORDER BY position, name`;
        return this.executeQuery(query, [teamId]);
    }
    /**
     * Create or update player (idempotent)
     */
    async createOrUpdate(playerData) {
        if (!playerData.external_id) {
            throw new Error('external_id is required');
        }
        return this.upsert(playerData, 'external_id');
    }
    /**
     * Batch upsert players (optimized for high volume)
     * Processes in batches to avoid memory issues
     */
    async batchUpsert(players, conflictKeyOrBatchSize = 1000) {
        const batchSize = typeof conflictKeyOrBatchSize === 'number' ? conflictKeyOrBatchSize : 1000;
        if (players.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        const allResults = [];
        try {
            await client.query('BEGIN');
            // Process in batches
            for (let i = 0; i < players.length; i += batchSize) {
                const batch = players.slice(i, i + batchSize);
                const batchResults = [];
                for (const player of batch) {
                    // CRITICAL: Convert team_id "0" to NULL (Free Agent/Retired)
                    const teamId = player.team_id === '0' || player.team_id === '' ? null : (player.team_id || null);
                    // Determine if this is a duplicate based on uid field
                    const isDuplicate = !!(player.uid && player.uid.trim() !== '');
                    const playerData = {
                        external_id: player.external_id,
                        name: player.name,
                        short_name: player.short_name || null,
                        logo: player.logo || null,
                        team_id: teamId,
                        country_id: player.country_id || null,
                        age: player.age || null,
                        birthday: player.birthday || null,
                        height: player.height || null,
                        weight: player.weight || null,
                        market_value: player.market_value || null,
                        market_value_currency: player.market_value_currency || null,
                        contract_until: player.contract_until || null,
                        preferred_foot: player.preferred_foot || null,
                        position: player.position || null,
                        // JSONB fields - PostgreSQL will handle JSON conversion automatically
                        positions: player.positions || null,
                        ability: player.ability || null,
                        characteristics: player.characteristics || null,
                        uid: player.uid || null,
                        is_duplicate: isDuplicate,
                    };
                    // Convert updated_at timestamp to Date if provided
                    if (player.updated_at) {
                        playerData.updated_at = new Date(player.updated_at * 1000);
                    }
                    const result = await this.upsert(playerData, 'external_id');
                    batchResults.push(result);
                }
                allResults.push(...batchResults);
            }
            await client.query('COMMIT');
            return allResults;
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
exports.PlayerRepository = PlayerRepository;
