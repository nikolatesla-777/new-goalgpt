/**
 * Category Repository
 * 
 * Data access layer for ts_categories table
 * STATUS: Skeleton - waiting for API documentation to define schema
 */

import { BaseRepository } from '../base/BaseRepository';
import { pool } from '../../database/connection';

export interface CategoryEntity {
  id: string;
  external_id: string;
  name: string;
  updated_at?: Date;
  created_at?: Date;
}

export class CategoryRepository extends BaseRepository<CategoryEntity> {
  constructor() {
    super('ts_categories', 'external_id');
  }

  /**
   * Find categories by external IDs (batch)
   */
  async findByExternalIds(externalIds: string[]): Promise<CategoryEntity[]> {
    if (externalIds.length === 0) return [];

    const query = `SELECT * FROM ${this.tableName} WHERE external_id = ANY($1)`;
    return this.executeQuery<CategoryEntity>(query, [externalIds]);
  }

  /**
   * Create or update category (idempotent)
   */
  async createOrUpdate(categoryData: Partial<CategoryEntity>): Promise<CategoryEntity> {
    if (!categoryData.external_id) {
      throw new Error('external_id is required');
    }

    return this.upsert(categoryData as CategoryEntity, 'external_id');
  }

  /**
   * Batch upsert categories
   */
  async batchUpsert(categories: Array<{ external_id: string; name: string; updated_at?: number }>): Promise<CategoryEntity[]> {
    if (categories.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: CategoryEntity[] = [];
      for (const cat of categories) {
        const categoryData: Partial<CategoryEntity> = {
          external_id: cat.external_id,
          name: cat.name,
        };
        
        // Convert updated_at timestamp to Date if provided
        if (cat.updated_at) {
          categoryData.updated_at = new Date(cat.updated_at * 1000);
        }
        
        const result = await this.upsert(categoryData as CategoryEntity, 'external_id');
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

