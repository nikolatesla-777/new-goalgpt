/**
 * Venue Repository
 * 
 * Data access layer for ts_venues table
 * Critical for "Home Advantage" analysis and future Weather integration
 */

import { BaseRepository } from '../base/BaseRepository';
import { Venue } from '../../types/thesports/venue/venue.types';
import { pool } from '../../database/connection';

export class VenueRepository extends BaseRepository<Venue> {
  constructor() {
    super('ts_venues', 'external_id');
  }

  /**
   * Find venues by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<Venue[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<Venue>(query, [externalIds]);
  }

  /**
   * Find venues by country_id
   */
  async findByCountryId(countryId: string): Promise<Venue[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE country_id = $1 ORDER BY capacity DESC, name`;
    return this.executeQuery<Venue>(query, [countryId]);
  }

  /**
   * Find venues by city
   */
  async findByCity(city: string): Promise<Venue[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE city = $1 ORDER BY capacity DESC, name`;
    return this.executeQuery<Venue>(query, [city]);
  }

  /**
   * Create or update venue (idempotent)
   */
  async createOrUpdate(venueData: Partial<Venue>): Promise<Venue> {
    if (!venueData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(venueData as Venue, 'external_id');
  }

  /**
   * Batch upsert venues
   */
  async batchUpsert(venues: Array<{
    external_id: string;
    name: string;
    city?: string | null;
    capacity?: number | null;
    country_id?: string | null;
    updated_at?: number;
  }>): Promise<Venue[]> {
    if (venues.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Venue[] = [];
      for (const venue of venues) {
        const venueData: Partial<Venue> = {
          external_id: venue.external_id,
          name: venue.name,
          city: venue.city || null,
          capacity: venue.capacity || null,
          country_id: venue.country_id || null,
        };
        
        // Convert updated_at timestamp to Date if provided
        if (venue.updated_at) {
          venueData.updated_at = new Date(venue.updated_at * 1000);
        }
        
        const result = await this.upsert(venueData as Venue, 'external_id');
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






