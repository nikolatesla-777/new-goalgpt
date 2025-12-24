/**
 * Coach Sync Service
 * 
 * Fetches coach/manager data from TheSports API and stores in database
 * Uses /coach/list endpoint
 * Implements Full Update vs Incremental Update logic
 */

import { logger } from '../../../utils/logger';
import { CoachRepository } from '../../../repositories/implementations/CoachRepository';
import { BaseSyncService } from '../sync/baseSync.service';
import { FetchOptions, FetchResult } from '../sync/dataFetcher.util';

export interface CoachItem {
  id: string;
  team_id: string; // FK to ts_teams, can be NULL if not currently coaching
  country_id?: string;
  name: string;
  short_name?: string;
  logo?: string;
  type?: number; // 1=Head coach, 2=Interim
  birthday?: number; // Unix timestamp
  age?: number;
  preferred_formation?: string; // e.g. "4-4-2"
  nationality?: string;
  joined?: number; // Unix timestamp
  contract_until?: number; // Unix timestamp
  updated_at?: number; // Unix timestamp
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
}

export class CoachSyncService extends BaseSyncService<CoachItem> {
  private repository: CoachRepository;

  constructor() {
    super('coach');
    this.repository = new CoachRepository();
  }

  /**
   * Get fetch options for coach endpoint
   */
  protected getFetchOptions(): FetchOptions {
    return {
      endpoint: '/coach/list',
      rateLimitDelay: 200, // 200ms between pages
      timeout: 30000,
      retryOnRateLimit: true,
    };
  }

  /**
   * Fetch full update (all pages)
   */
  protected async fetchFullUpdate(): Promise<FetchResult<CoachItem>> {
    return this.dataFetcher.fetchAllPages<CoachItem>(this.getFetchOptions());
  }

  /**
   * Fetch incremental update (with time parameter)
   */
  protected async fetchIncrementalUpdate(time: number): Promise<FetchResult<CoachItem>> {
    return this.dataFetcher.fetchIncremental<CoachItem>(this.getFetchOptions(), time);
  }

  /**
   * Save coaches to database
   */
  protected async saveToDatabase(items: CoachItem[]): Promise<number> {
    if (items.length === 0) return 0;

    const coachesToSave = items.map(coach => ({
      external_id: coach.id,
      name: coach.name || 'Unknown Coach',
      short_name: coach.short_name || null,
      logo: coach.logo || null,
      team_id: coach.team_id || null,
      country_id: coach.country_id || null,
      type: coach.type || null,
      birthday: coach.birthday || null,
      age: coach.age || null,
      preferred_formation: coach.preferred_formation || null,
      nationality: coach.nationality || null,
      joined: coach.joined || null,
      contract_until: coach.contract_until || null,
      uid: coach.uid || null, // Master ID if duplicate
      updated_at: coach.updated_at,
    }));

    const saved = await this.repository.batchUpsert(coachesToSave);
    return saved.length;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use sync() instead
   */
  async syncAllCoaches(): Promise<{ total: number; synced: number; errors: number }> {
    const result = await this.sync();
    return {
      total: result.total,
      synced: result.synced,
      errors: result.errors,
    };
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use sync() instead - it automatically handles incremental updates
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
    // If lastSyncTime provided, update sync state first
    if (lastSyncTime) {
      await this.syncStateRepository.updateSyncState(this.entityType, lastSyncTime);
    }
    
    const result = await this.sync();
    return {
      total: result.total,
      synced: result.synced,
    };
  }
}
