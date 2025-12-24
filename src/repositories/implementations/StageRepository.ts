/**
 * Stage Repository
 * 
 * Data access layer for ts_stages table
 * Crucial for distinguishing "Group Stage" vs "Finals"
 */

import { BaseRepository } from '../base/BaseRepository';
import { Stage } from '../../types/thesports/stage/stage.types';
import { pool } from '../../database/connection';

export class StageRepository extends BaseRepository<Stage> {
  constructor() {
    super('ts_stages', 'external_id');
  }

  /**
   * Find stages by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Stage[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Stage>(query, [externalIds]);
  }

  /**
   * Find stages by season_id (ordered by sort_order field)
   */
  async findBySeasonId(seasonId: string): Promise<Stage[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE season_id = $1 ORDER BY sort_order ASC, name ASC`;
    return this.executeQuery<Stage>(query, [seasonId]);
  }

  /**
   * Find stages by mode (1=League, 2=Cup)
   */
  async findByMode(mode: number): Promise<Stage[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE mode = $1 ORDER BY season_id, sort_order ASC`;
    return this.executeQuery<Stage>(query, [mode]);
  }

  /**
   * Create or update stage (idempotent)
   */
  async createOrUpdate(stageData: Partial<Stage>): Promise<Stage> {
    if (!stageData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(stageData as Stage, 'external_id');
  }

  /**
   * Batch upsert stages
   */
  async batchUpsert(stages: Array<{
    external_id: string;
    season_id?: string | null;
    name?: string | null;
    mode?: number | null;
    group_count?: number | null;
    round_count?: number | null;
    sort_order?: number | null;
    updated_at?: number;
  }>): Promise<Stage[]> {
    if (stages.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Stage[] = [];
      for (const stage of stages) {
        const stageData: Partial<Stage> = {
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
        
        const result = await this.upsert(stageData as Stage, 'external_id');
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

