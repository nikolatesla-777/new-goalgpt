/**
 * Base Sync Service
 * 
 * Generic base class for entity synchronization
 * Implements Full Update vs Incremental Update logic
 */

import { logger } from '../../../utils/logger';
import { DataFetcher, FetchOptions, FetchResult } from './dataFetcher.util';
import { SyncStateRepository } from '../../../repositories/implementations/SyncStateRepository';

export interface SyncResult {
  total: number;
  synced: number;
  errors: number;
  isFullUpdate: boolean;
}

export abstract class BaseSyncService<T extends { updated_at?: number; id: string }> {
  protected dataFetcher: DataFetcher;
  protected syncStateRepository: SyncStateRepository;
  protected entityType: string;

  constructor(entityType: string) {
    this.dataFetcher = new DataFetcher();
    this.syncStateRepository = new SyncStateRepository();
    this.entityType = entityType;
  }

  /**
   * Main sync method
   * Automatically chooses Full Update or Incremental Update based on sync state
   */
  async sync(): Promise<SyncResult> {
    logger.info(`Starting ${this.entityType} sync...`);

    // Get last sync state
    const lastUpdatedAt = await this.syncStateRepository.getLastUpdatedAt(this.entityType);

    let result: FetchResult<T>;
    let isFullUpdate = false;

    if (lastUpdatedAt === null) {
      // Full Update: No previous sync state
      logger.info(`No previous sync state found. Performing FULL UPDATE for ${this.entityType}...`);
      isFullUpdate = true;
      result = await this.fetchFullUpdate();
    } else {
      // Incremental Update: Use time parameter
      const timeParam = lastUpdatedAt + 1; // MAX(updated_at) + 1
      logger.info(`Performing INCREMENTAL UPDATE for ${this.entityType} (time=${timeParam})...`);
      result = await this.fetchIncrementalUpdate(timeParam);
    }

    // Transform and save to database
    const synced = await this.saveToDatabase(result.items);

    // Update sync state with max updated_at
    if (result.maxUpdatedAt !== null) {
      await this.syncStateRepository.updateSyncState(this.entityType, result.maxUpdatedAt);
      logger.info(`Updated sync state for ${this.entityType}: last_updated_at=${result.maxUpdatedAt}`);
    } else if (result.items.length > 0) {
      // If no updated_at field, use current timestamp
      const currentTimestamp = Math.floor(Date.now() / 1000);
      await this.syncStateRepository.updateSyncState(this.entityType, currentTimestamp);
    }

    logger.info(
      `${this.entityType} sync completed: ${result.totalFetched} fetched, ${synced} synced, ${result.errors} errors (${isFullUpdate ? 'FULL' : 'INCREMENTAL'})`
    );

    return {
      total: result.totalFetched,
      synced,
      errors: result.errors,
      isFullUpdate,
    };
  }

  /**
   * Fetch full update (all pages)
   * Must be implemented by subclasses
   */
  protected abstract fetchFullUpdate(): Promise<FetchResult<T>>;

  /**
   * Fetch incremental update (with time parameter)
   * Must be implemented by subclasses
   */
  protected abstract fetchIncrementalUpdate(time: number): Promise<FetchResult<T>>;

  /**
   * Save items to database
   * Must be implemented by subclasses
   */
  protected abstract saveToDatabase(items: T[]): Promise<number>;

  /**
   * Get fetch options for the entity
   * Must be implemented by subclasses
   */
  protected abstract getFetchOptions(): FetchOptions;
}








