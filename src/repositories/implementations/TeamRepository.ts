/**
 * Team Repository
 * 
 * Data access layer for ts_teams table
 */

import { BaseRepository } from '../base/BaseRepository';
import { Team } from '../../types/thesports/team';

export class TeamRepository extends BaseRepository<Team> {
  constructor() {
    super('ts_teams', 'external_id');
  }

  /**
   * Find teams by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Team[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Team>(query, [externalIds]);
  }

  /**
   * Create or update team (idempotent)
   * CRITICAL: Removes id field to prevent NOT NULL constraint violation
   */
  async createOrUpdate(teamData: Partial<Team>): Promise<Team> {
    if (!teamData.external_id) {
      throw new Error('external_id is required');
    }

    // CRITICAL: Force strip id field using destructuring (most aggressive method)
    const { id, created_at, ...cleanData } = teamData as any;
    // Double-check: ensure id is not in the object
    if ('id' in cleanData) {
      delete (cleanData as any).id;
    }
    if ('created_at' in cleanData) {
      delete (cleanData as any).created_at;
    }

    return this.upsert(cleanData as Team, 'external_id');
  }

  /**
   * Find incomplete teams (missing name or logo)
   */
  async findIncomplete(limit: number = 100): Promise<Team[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE name IS NULL OR logo_url IS NULL
      ORDER BY updated_at ASC
      LIMIT $1
    `;
    return this.executeQuery<Team>(query, [limit]);
  }

  /**
   * Find teams without logo
   */
  async findWithoutLogo(limit: number = 100): Promise<Team[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE logo_url IS NULL
      ORDER BY updated_at ASC
      LIMIT $1
    `;
    return this.executeQuery<Team>(query, [limit]);
  }

  /**
   * Batch upsert teams
   */
  async batchUpsert(teams: Array<{
    external_id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
    website?: string | null;
    national?: boolean | null;
    foundation_time?: number | null;
    competition_id?: string | null;
    country_id?: string | null;
    venue_id?: string | null;
    coach_id?: string | null;
    uid?: string | null;
    updated_at?: number;
  }>): Promise<Team[]> {
    if (teams.length === 0) return [];

    const { pool } = await import('../../database/connection');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Team[] = [];
      for (const team of teams) {
        // Determine if this is a duplicate based on uid field
        const isDuplicate = !!(team.uid && team.uid.trim() !== '');
        
        const teamData: Partial<Team> = {
          external_id: team.external_id,
          name: team.name,
          short_name: team.short_name || null,
          logo_url: team.logo_url || null,
          website: team.website || null,
          national: team.national !== undefined ? team.national : null,
          foundation_time: team.foundation_time || null,
          competition_id: team.competition_id || null,
          country_id: team.country_id || null,
          venue_id: team.venue_id || null,
          coach_id: team.coach_id || null,
          uid: team.uid || null,
          is_duplicate: isDuplicate,
        };
        
        // Convert updated_at timestamp to Date if provided
        if (team.updated_at) {
          teamData.updated_at = new Date(team.updated_at * 1000);
        }
        
        const result = await this.upsert(teamData as Team, 'external_id');
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

