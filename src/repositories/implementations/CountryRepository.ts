/**
 * Country Repository
 * 
 * Data access layer for ts_countries table
 */

import { BaseRepository } from '../base/BaseRepository';
import { pool } from '../../database/connection';

export interface CountryEntity {
  id: string;
  external_id: string;
  category_id?: string | null;
  name: string;
  logo?: string | null;
  updated_at?: Date;
  created_at?: Date;
}

export class CountryRepository extends BaseRepository<CountryEntity> {
  constructor() {
    super('ts_countries', 'external_id');
  }

  /**
   * Find countries by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<CountryEntity[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<CountryEntity>(query, [externalIds]);
  }

  /**
   * Find countries by category_id
   */
  async findByCategoryId(categoryId: string): Promise<CountryEntity[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE category_id = $1`;
    return this.executeQuery<CountryEntity>(query, [categoryId]);
  }

  /**
   * Create or update country (idempotent)
   */
  async createOrUpdate(countryData: Partial<CountryEntity>): Promise<CountryEntity> {
    if (!countryData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(countryData as CountryEntity, 'external_id');
  }

  /**
   * Batch upsert countries
   */
  async batchUpsert(countries: Array<{ external_id: string; category_id?: string; name: string; logo?: string; updated_at?: number }>): Promise<CountryEntity[]> {
    if (countries.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: CountryEntity[] = [];
      for (const country of countries) {
        const countryData: Partial<CountryEntity> = {
          external_id: country.external_id,
          category_id: country.category_id || null,
          name: country.name,
          logo: country.logo || null,
        };
        
        // Convert updated_at timestamp to Date if provided
        if (country.updated_at) {
          countryData.updated_at = new Date(country.updated_at * 1000);
        }
        
        const result = await this.upsert(countryData as CountryEntity, 'external_id');
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










