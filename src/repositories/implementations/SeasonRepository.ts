/**
 * Season Repository
 * 
 * Data access layer for ts_seasons table
 * Critical for "Standings/Table" and filtering current matches
 */

import { BaseRepository } from '../base/BaseRepository';
import { Season } from '../../types/thesports/season/season.types';
import { pool } from '../../database/connection';

export class SeasonRepository extends BaseRepository<Season> {
  constructor() {
    super('ts_seasons', 'external_id');
  }

  /**
   * Find seasons by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Season[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Season>(query, [externalIds]);
  }

  /**
   * Find current season by competition_id
   * Uses composite index for fast lookup
   */
  async findCurrentByCompetitionId(competitionId: string): Promise<Season | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE competition_id = $1 AND is_current = true ORDER BY start_time DESC LIMIT 1`;
    const rows = await this.executeQuery<Season>(query, [competitionId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find all seasons by competition_id
   */
  async findByCompetitionId(competitionId: string): Promise<Season[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE competition_id = $1 ORDER BY start_time DESC`;
    return this.executeQuery<Season>(query, [competitionId]);
  }

  /**
   * Find all current seasons
   */
  async findCurrentSeasons(): Promise<Season[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE is_current = true ORDER BY competition_id, start_time DESC`;
    return this.executeQuery<Season>(query);
  }

  /**
   * Create or update season (idempotent)
   */
  async createOrUpdate(seasonData: Partial<Season>): Promise<Season> {
    if (!seasonData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(seasonData as Season, 'external_id');
  }

  /**
   * Batch upsert seasons
   */
  async batchUpsert(seasons: Array<{
    external_id: string;
    competition_id?: string | null;
    year?: string | null;
    is_current?: number | null; // 1=Yes, 0=No -> Convert to boolean
    has_table?: number | null; // 1=Yes, 0=No -> Convert to boolean
    has_player_stats?: number | null; // 1=Yes, 0=No -> Convert to boolean
    has_team_stats?: number | null; // 1=Yes, 0=No -> Convert to boolean
    start_time?: number | null;
    end_time?: number | null;
    updated_at?: number;
  }>): Promise<Season[]> {
    if (seasons.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Season[] = [];
      for (const season of seasons) {
        const seasonData: Partial<Season> = {
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
        
        const result = await this.upsert(seasonData as Season, 'external_id');
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}








