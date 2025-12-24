/**
 * Base Repository
 * 
 * Generic base class for repositories with common CRUD logic and idempotency
 */

import { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../../database/connection';
import { IBaseRepository } from '../interfaces/IBaseRepository';
import { logger } from '../../utils/logger';

export abstract class BaseRepository<T extends Record<string, any>> implements IBaseRepository<T> {
  protected tableName: string;
  protected externalIdColumn: string;

  constructor(tableName: string, externalIdColumn: string = 'external_id') {
    this.tableName = tableName;
    this.externalIdColumn = externalIdColumn;
  }

  /**
   * Execute query with error handling
   */
  protected async executeQuery<R extends QueryResultRow>(
    query: string,
    params: any[] = [],
    client?: PoolClient
  ): Promise<R[]> {
    const dbClient = client || await pool.connect();
    try {
      const result = await dbClient.query<R>(query, params);
      return result.rows;
    } catch (error: any) {
      logger.error(`Database error in ${this.tableName}:`, {
        message: error.message,
        query,
        params,
      });
      throw error;
    } finally {
      if (!client) {
        dbClient.release();
      }
    }
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const rows = await this.executeQuery<T>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find by external ID (TheSports ID)
   */
  async findByExternalId(externalId: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.externalIdColumn} = $1`;
    const rows = await this.executeQuery<T>(query, [externalId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find all
   */
  async findAll(): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName}`;
    return this.executeQuery<T>(query);
  }

  /**
   * Create new record
   */
  async create(item: T): Promise<T> {
    const columns = Object.keys(item).join(', ');
    const placeholders = Object.keys(item)
      .map((_, index) => `$${index + 1}`)
      .join(', ');
    const values = Object.values(item);

    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const rows = await this.executeQuery<T>(query, values);
    return rows[0];
  }

  /**
   * Update record
   */
  async update(id: string, item: Partial<T>): Promise<T | null> {
    const setClause = Object.keys(item)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    const values = [id, ...Object.values(item)];

    const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const rows = await this.executeQuery<T>(query, values);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Upsert (Insert or Update) - Idempotent operation
   * Uses ON CONFLICT DO UPDATE to prevent duplicates
   * CRITICAL: Triple-check ID stripping to prevent NOT NULL constraint violation
   */
  async upsert(item: T, conflictKey: string = this.externalIdColumn): Promise<T> {
    // CRITICAL FIX: Create clean object WITHOUT id/created_at from scratch
    const itemAny = item as any;
    const insertData: any = {};
    
    // Only copy allowed fields (explicitly exclude id and created_at)
    for (const key in itemAny) {
      if (key !== 'id' && key !== 'created_at' && itemAny.hasOwnProperty(key)) {
        insertData[key] = itemAny[key];
      }
    }
    
    // FINAL SAFETY CHECK: Explicitly remove id if it somehow got in
    delete insertData.id;
    delete insertData.created_at;
    
    // Build columns and values arrays (id is guaranteed to be excluded)
    const columns = Object.keys(insertData).filter(k => k !== 'id' && k !== 'created_at').join(', ');
    const placeholders = Object.keys(insertData)
      .filter(k => k !== 'id' && k !== 'created_at')
      .map((_, index) => `$${index + 1}`)
      .join(', ');
    const values = Object.keys(insertData)
      .filter(k => k !== 'id' && k !== 'created_at')
      .map(k => insertData[k]);

    const updateClause = Object.keys(insertData)
      .filter(key => key !== conflictKey && key !== 'updated_at') // Exclude updated_at - we set it manually
      .map((key, index) => {
        const valueIndex = Object.keys(insertData).indexOf(key) + 1;
        return `${key} = $${valueIndex}`;
      })
      .join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      ON CONFLICT (${conflictKey}) 
      DO UPDATE SET ${updateClause}, updated_at = NOW()
      RETURNING *
    `;

    const rows = await this.executeQuery<T>(query, values);
    return rows[0];
  }

  /**
   * Delete record
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const rows = await this.executeQuery<{ id: string }>(query, [id]);
    return rows.length > 0;
  }

  /**
   * Batch upsert - Idempotent bulk operation
   */
  async batchUpsert(items: any[], conflictKey: string = this.externalIdColumn): Promise<T[]> {
    if (items.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: T[] = [];
      for (const item of items) {
        const result = await this.upsert(item as any, conflictKey);
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
