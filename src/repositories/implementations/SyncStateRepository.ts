/**
 * Sync State Repository
 * 
 * Manages sync state tracking for incremental updates
 */

import { BaseRepository } from '../base/BaseRepository';
import { pool } from '../../database/connection';

export interface SyncStateEntity {
  entity_type: string;
  last_updated_at: number | null; // Unix timestamp (MAX(updated_at) from entity table)
  last_sync_at: Date;
  created_at: Date;
  updated_at: Date;
}

export class SyncStateRepository extends BaseRepository<SyncStateEntity> {
  constructor() {
    super('ts_sync_state', 'entity_type');
  }

  /**
   * Get last updated_at timestamp for an entity type
   * Returns null if no sync has been performed (triggers full update)
   */
  async getLastUpdatedAt(entityType: string): Promise<number | null> {
    const query = `SELECT last_updated_at FROM ${this.tableName} WHERE entity_type = $1`;
    const rows = await this.executeQuery<{ last_updated_at: number | null }>(query, [entityType]);
    return rows.length > 0 ? rows[0].last_updated_at : null;
  }

  /**
   * Get last sync time (alias for getLastUpdatedAt for compatibility)
   */
  async getLastSyncTime(entityType: string): Promise<{ last_updated_at: number | null; last_sync_at: Date | null } | null> {
    const query = `SELECT last_updated_at, last_sync_at FROM ${this.tableName} WHERE entity_type = $1`;
    const rows = await this.executeQuery<{ last_updated_at: number | null; last_sync_at: Date | null }>(query, [entityType]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update last sync time (alias for updateSyncState for compatibility)
   */
  async updateLastSyncTime(entityType: string, lastUpdatedAt: number): Promise<void> {
    await this.updateSyncState(entityType, lastUpdatedAt);
  }

  /**
   * Update sync state after successful sync
   * @param entityType - Entity type (e.g., 'competition', 'team')
   * @param maxUpdatedAt - Maximum updated_at timestamp from the synced records
   */
  async updateSyncState(entityType: string, maxUpdatedAt: number): Promise<void> {
    const query = `
      INSERT INTO ${this.tableName} (entity_type, last_updated_at, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (entity_type) 
      DO UPDATE SET 
        last_updated_at = $2,
        last_sync_at = NOW(),
        updated_at = NOW()
    `;
    await this.executeQuery(query, [entityType, maxUpdatedAt]);
  }

  /**
   * Reset sync state (force full update on next sync)
   */
  async resetSyncState(entityType: string): Promise<void> {
    const query = `
      DELETE FROM ${this.tableName} WHERE entity_type = $1
    `;
    await this.executeQuery(query, [entityType]);
  }
}

