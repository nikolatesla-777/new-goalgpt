
/**
 * Player Sync Service
 * 
 * Fetches player data from TheSports API and stores in database
 * Uses /player/with_stat/list endpoint
 * Implements Full Update vs Incremental Update logic
 * High volume data - optimized for batch processing
 */

import { logger } from '../../../utils/logger';
import { PlayerRepository } from '../../../repositories/implementations/PlayerRepository';
import { BaseSyncService } from '../sync/baseSync.service';
import { FetchOptions, FetchResult } from '../sync/dataFetcher.util';

export interface PlayerWithStat {
  id: string;
  team_id: string; // Note: "0" means Free Agent/Retired -> Store as NULL
  country_id?: string;
  name: string;
  short_name?: string;
  logo?: string;
  age?: number;
  birthday?: number; // Unix timestamp
  height?: number;
  weight?: number;
  market_value?: number;
  market_value_currency?: string;
  contract_until?: number;
  preferred_foot?: number; // 1=Left, 2=Right, 3=Both
  position?: string; // Main position code (F, M, D, G)
  positions?: any[]; // Complex array -> Store as JSONB
  ability?: any[]; // Complex array -> Store as JSONB
  characteristics?: any[]; // Complex array -> Store as JSONB
  updated_at?: number; // Unix timestamp
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
}

export class PlayerSyncService extends BaseSyncService<PlayerWithStat> {
  private repository: PlayerRepository;
  private batchSize: number = 1000; // Batch size for database inserts

  constructor() {
    super('player');
    this.repository = new PlayerRepository();
  }

  /**
   * Get fetch options for player endpoint
   */
  protected getFetchOptions(): FetchOptions {
    return {
      endpoint: '/player/with_stat/list',
      rateLimitDelay: 500, // 500ms between pages (slower due to high volume)
      timeout: 60000, // Longer timeout for high volume
      retryOnRateLimit: true,
    };
  }

  /**
   * Fetch full update (all pages)
   */
  protected async fetchFullUpdate(): Promise<FetchResult<PlayerWithStat>> {
    return this.dataFetcher.fetchAllPages<PlayerWithStat>(this.getFetchOptions());
  }

  /**
   * Fetch incremental update (with time parameter)
   */
  protected async fetchIncrementalUpdate(time: number): Promise<FetchResult<PlayerWithStat>> {
    return this.dataFetcher.fetchIncremental<PlayerWithStat>(this.getFetchOptions(), time);
  }

  /**
   * Save players to database (with batch processing)
   */
  protected async saveToDatabase(items: PlayerWithStat[]): Promise<number> {
    if (items.length === 0) return 0;

    // Process in batches to avoid memory issues
    let totalSynced = 0;
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      
      const playersToSave = batch.map(player => {
        // CRITICAL: Convert team_id "0" to null (Free Agent/Retired)
        const teamId = player.team_id === '0' || player.team_id === '' ? null : (player.team_id || null);

        return {
          external_id: player.id,
          name: player.name || 'Unknown Player',
          short_name: player.short_name || null,
          logo: player.logo || null,
          team_id: teamId,
          country_id: player.country_id || null,
          age: player.age || null,
          birthday: player.birthday || null,
          height: player.height || null,
          weight: player.weight || null,
          market_value: player.market_value || null,
          market_value_currency: player.market_value_currency || null,
          contract_until: player.contract_until || null,
          preferred_foot: player.preferred_foot || null,
          position: player.position || null,
          positions: player.positions || null,
          ability: player.ability || null,
          characteristics: player.characteristics || null,
          uid: player.uid || null, // Master ID if duplicate
          updated_at: player.updated_at,
        };
      });

      try {
        const saved = await this.repository.batchUpsert(playersToSave, this.batchSize);
        totalSynced += saved.length;
        logger.debug(`Synced batch: ${saved.length} players (total: ${totalSynced})`);
      } catch (error: any) {
        logger.error(`Failed to save player batch:`, error.message);
        // Continue with next batch
      }
    }

    return totalSynced;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use sync() instead
   */
  async syncAllPlayers(): Promise<{ total: number; synced: number; errors: number }> {
    const result = await this.sync();
    return {
      total: result.total,
      synced: result.synced,
      errors: result.errors,
    };
  }
}
