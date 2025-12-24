/**
 * Coach Repository
 * 
 * Data access layer for ts_coaches table
 */

import { BaseRepository } from '../base/BaseRepository';
import { Coach } from '../../types/thesports/coach/coach.types';
import { pool } from '../../database/connection';

export class CoachRepository extends BaseRepository<Coach> {
  constructor() {
    super('ts_coaches', 'external_id');
  }

  /**
   * Find coaches by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Coach[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Coach>(query, [externalIds]);
  }

  /**
   * Find coach by team_id (current coach lookup)
   */
  async findByTeamId(teamId: string): Promise<Coach | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE team_id = $1 AND type = 1 ORDER BY joined DESC LIMIT 1`;
    const rows = await this.executeQuery<Coach>(query, [teamId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create or update coach (idempotent)
   */
  async createOrUpdate(coachData: Partial<Coach>): Promise<Coach> {
    if (!coachData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(coachData as Coach, 'external_id');
  }

  /**
   * Batch upsert coaches
   */
  async batchUpsert(coaches: Array<{
    external_id: string;
    name: string;
    short_name?: string | null;
    logo?: string | null;
    team_id?: string | null;
    country_id?: string | null;
    type?: number | null;
    birthday?: number | null;
    age?: number | null;
    preferred_formation?: string | null;
    nationality?: string | null;
    joined?: number | null;
    contract_until?: number | null;
    uid?: string | null;
    updated_at?: number;
  }>): Promise<Coach[]> {
    if (coaches.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Coach[] = [];
      for (const coach of coaches) {
        // Determine if this is a duplicate based on uid field
        const isDuplicate = !!(coach.uid && coach.uid.trim() !== '');
        
        const coachData: Partial<Coach> = {
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
        
        const result = await this.upsert(coachData as Coach, 'external_id');
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

