/**
 * Referee Repository
 * 
 * Data access layer for ts_referees table
 * Critical for future "Card/Penalty" AI predictions
 */

import { BaseRepository } from '../base/BaseRepository';
import { Referee } from '../../types/thesports/referee/referee.types';
import { pool } from '../../database/connection';

export class RefereeRepository extends BaseRepository<Referee> {
  constructor() {
    super('ts_referees', 'external_id');
  }

  /**
   * Find referees by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Referee[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Referee>(query, [externalIds]);
  }

  /**
   * Find referees by country_id
   */
  async findByCountryId(countryId: string): Promise<Referee[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE country_id = $1 ORDER BY name`;
    return this.executeQuery<Referee>(query, [countryId]);
  }

  /**
   * Create or update referee (idempotent)
   */
  async createOrUpdate(refereeData: Partial<Referee>): Promise<Referee> {
    if (!refereeData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(refereeData as Referee, 'external_id');
  }

  /**
   * Batch upsert referees
   */
  async batchUpsert(referees: Array<{
    external_id: string;
    name: string;
    short_name?: string | null;
    logo?: string | null;
    country_id?: string | null;
    birthday?: number | null;
    updated_at?: number;
  }>): Promise<Referee[]> {
    if (referees.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Referee[] = [];
      for (const referee of referees) {
        const refereeData: Partial<Referee> = {
          external_id: referee.external_id,
          name: referee.name,
          short_name: referee.short_name || null,
          logo: referee.logo || null,
          country_id: referee.country_id || null,
          birthday: referee.birthday || null,
        };
        
        // Convert updated_at timestamp to Date if provided
        if (referee.updated_at) {
          refereeData.updated_at = new Date(referee.updated_at * 1000);
        }
        
        const result = await this.upsert(refereeData as Referee, 'external_id');
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






