/**
 * Competition Repository
 * 
 * Data access layer for ts_competitions table
 */

import { BaseRepository } from '../base/BaseRepository';
import { pool } from '../../database/connection';

export interface CompetitionEntity {
  id: string;
  external_id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  type?: number | null;
  category_id?: string | null;
  country_id?: string | null;
  cur_season_id?: string | null;
  cur_stage_id?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
  is_duplicate?: boolean; // true if uid is present (duplicate/merged record)
  created_at?: Date;
  updated_at?: Date;
}

export class CompetitionRepository extends BaseRepository<CompetitionEntity> {
  constructor() {
    super('ts_competitions', 'external_id');
  }

  /**
   * Find competitions by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<CompetitionEntity[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<CompetitionEntity>(query, [externalIds]);
  }

  /**
   * Create or update competition (idempotent)
   * CRITICAL: Removes id field to prevent NOT NULL constraint violation
   */
  async createOrUpdate(competitionData: Partial<CompetitionEntity>): Promise<CompetitionEntity> {
    if (!competitionData.external_id) {
      throw new Error('external_id is required');
    }

    // CRITICAL FIX: Create clean object WITHOUT id field from scratch
    // Do NOT use spread operator - it might contain id
    const cleanData: any = {
      external_id: competitionData.external_id,
      name: competitionData.name || 'Unknown Competition',
      short_name: competitionData.short_name || null,
      logo_url: competitionData.logo_url || null,
      type: competitionData.type || null,
      category_id: competitionData.category_id || null,
      country_id: competitionData.country_id || null,
      cur_season_id: competitionData.cur_season_id || null,
      cur_stage_id: competitionData.cur_stage_id || null,
      primary_color: competitionData.primary_color || null,
      secondary_color: competitionData.secondary_color || null,
      uid: competitionData.uid || null,
      is_duplicate: competitionData.is_duplicate || false,
    };
    
    // TRIPLE-CHECK: Ensure id is NEVER in the object
    if ('id' in cleanData) {
      delete cleanData.id;
    }
    if ('created_at' in cleanData) {
      delete cleanData.created_at;
    }
    // Final safety check: explicitly set id to undefined
    cleanData.id = undefined;
    delete cleanData.id;

    return this.upsert(cleanData as CompetitionEntity, 'external_id');
  }

  /**
   * Batch upsert competitions
   * CRITICAL: Triple-check ID stripping to prevent NOT NULL constraint violation
   */
  async batchUpsert(competitions: Array<{
    external_id: string;
    name: string;
    short_name?: string | null;
    logo_url?: string | null;
    type?: number | null;
    category_id?: string | null;
    country_id?: string | null;
    cur_season_id?: string | null;
    cur_stage_id?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    uid?: string | null;
    is_duplicate?: boolean;
  }>): Promise<CompetitionEntity[]> {
    if (competitions.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: CompetitionEntity[] = [];
      for (const comp of competitions) {
        // Determine if this is a duplicate based on uid field
        const isDuplicate = !!(comp.uid && comp.uid.trim() !== '');
        
        // CRITICAL FIX: Create clean object WITHOUT id field from scratch
        // Do NOT use spread operator on comp - it might contain id
        const cleanComp: any = {
          external_id: comp.external_id,
          name: comp.name,
          short_name: comp.short_name || null,
          logo_url: comp.logo_url || null,
          type: comp.type || null,
          category_id: comp.category_id || null,
          country_id: comp.country_id || null,
          cur_season_id: comp.cur_season_id || null,
          cur_stage_id: comp.cur_stage_id || null,
          primary_color: comp.primary_color || null,
          secondary_color: comp.secondary_color || null,
          uid: comp.uid || null,
          is_duplicate: isDuplicate,
        };
        
        // TRIPLE-CHECK: Ensure id is NEVER in the object
        if ('id' in cleanComp) {
          delete cleanComp.id;
        }
        if ('created_at' in cleanComp) {
          delete cleanComp.created_at;
        }
        // Final safety check: explicitly set id to undefined
        cleanComp.id = undefined;
        delete cleanComp.id;
        
        const result = await this.upsert(cleanComp as CompetitionEntity, 'external_id');
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

