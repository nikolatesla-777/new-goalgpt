/**
 * Player Repository
 * 
 * Data access layer for ts_players table
 * Optimized for high-volume batch operations
 */

import { BaseRepository } from '../base/BaseRepository';
import { Player } from '../../types/thesports/player/player.types';
import { pool } from '../../database/connection';

export class PlayerRepository extends BaseRepository<Player> {
  constructor() {
    super('ts_players', 'external_id');
  }

  /**
   * Find players by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Player[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Player>(query, [externalIds]);
  }

  /**
   * Find players by team_id (squad lookup)
   */
  async findByTeamId(teamId: string): Promise<Player[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE team_id = $1 ORDER BY position, name`;
    return this.executeQuery<Player>(query, [teamId]);
  }

  /**
   * Create or update player (idempotent)
   */
  async createOrUpdate(playerData: Partial<Player>): Promise<Player> {
    if (!playerData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(playerData as Player, 'external_id');
  }

  /**
   * Batch upsert players (optimized for high volume)
   * Processes in batches to avoid memory issues
   */
  async batchUpsert(
    players: Array<{
      external_id: string;
      name: string;
      short_name?: string | null;
      logo?: string | null;
      team_id?: string | null;
      country_id?: string | null;
      age?: number | null;
      birthday?: number | null;
      height?: number | null;
      weight?: number | null;
      market_value?: number | null;
      market_value_currency?: string | null;
      contract_until?: number | null;
      preferred_foot?: number | null;
      position?: string | null;
      positions?: any | null;
      ability?: any | null;
      characteristics?: any | null;
      uid?: string | null;
      updated_at?: number;
    }>,
    conflictKeyOrBatchSize: string | number = 1000
  ): Promise<Player[]> {
    const batchSize = typeof conflictKeyOrBatchSize === 'number' ? conflictKeyOrBatchSize : 1000;
    if (players.length === 0) return [];

    const client = await pool.connect();
    const allResults: Player[] = [];

    try {
      await client.query('BEGIN');

      // Process in batches
      for (let i = 0; i < players.length; i += batchSize) {
        const batch = players.slice(i, i + batchSize);
        const batchResults: Player[] = [];

        for (const player of batch) {
          // CRITICAL: Convert team_id "0" to NULL (Free Agent/Retired)
          const teamId = player.team_id === '0' || player.team_id === '' ? null : (player.team_id || null);

          // Determine if this is a duplicate based on uid field
          const isDuplicate = !!(player.uid && player.uid.trim() !== '');

          const playerData: Partial<Player> = {
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

          const result = await this.upsert(playerData as Player, 'external_id');
          batchResults.push(result);
        }

        allResults.push(...batchResults);
      }

      await client.query('COMMIT');
      return allResults;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

