
/**
 * League Sync Service
 * 
 * Fetches competition/league data from TheSports API and stores in database
 * Uses /competition/additional/list endpoint
 * Implements Full Update vs Incremental Update logic
 */

import { logger } from '../../../utils/logger';
import { CompetitionRepository } from '../../../repositories/implementations/CompetitionRepository';
import { BaseSyncService, SyncResult } from '../sync/baseSync.service';
import { FetchOptions, FetchResult } from '../sync/dataFetcher.util';

export interface CompetitionAdditional {
  id: string;
  name: string;
  short_name?: string;
  logo?: string;
  logo_url?: string;
  country_id?: string;
  category_id?: string;
  type?: number; // 1=League, 2=Cup, 3=Friendly
  cur_season_id?: string;
  cur_stage_id?: string;
  primary_color?: string;
  secondary_color?: string;
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
  updated_at?: number; // Unix timestamp
}

export class LeagueSyncService extends BaseSyncService<CompetitionAdditional> {
  private repository: CompetitionRepository;

  constructor() {
    super('competition');
    this.repository = new CompetitionRepository();
  }

  /**
   * Get fetch options for competition endpoint
   */
  protected getFetchOptions(): FetchOptions {
    return {
      endpoint: '/competition/additional/list',
      rateLimitDelay: 200, // 200ms between pages
      timeout: 30000,
      retryOnRateLimit: true,
    };
  }

  /**
   * Fetch full update (all pages)
   */
  protected async fetchFullUpdate(): Promise<FetchResult<CompetitionAdditional>> {
    return this.dataFetcher.fetchAllPages<CompetitionAdditional>(this.getFetchOptions());
  }

  /**
   * Fetch incremental update (with time parameter)
   */
  protected async fetchIncrementalUpdate(time: number): Promise<FetchResult<CompetitionAdditional>> {
    return this.dataFetcher.fetchIncremental<CompetitionAdditional>(this.getFetchOptions(), time);
  }

  /**
   * Save competitions to database
   */
  protected async saveToDatabase(items: CompetitionAdditional[]): Promise<number> {
    if (items.length === 0) return 0;

    const competitionsToSave = items.map(comp => ({
      external_id: comp.id,
      name: comp.name || comp.short_name || 'Unknown Competition',
      short_name: comp.short_name || null,
      logo_url: comp.logo || comp.logo_url || null,
      type: comp.type || null,
      category_id: comp.category_id || null,
      country_id: comp.country_id || null,
      cur_season_id: comp.cur_season_id || null,
      cur_stage_id: comp.cur_stage_id || null,
      primary_color: comp.primary_color || null,
      secondary_color: comp.secondary_color || null,
      uid: comp.uid || null, // Master ID if duplicate
    }));

    const saved = await this.repository.batchUpsert(competitionsToSave);
    return saved.length;
  }

  /**
   * Sync all competitions from API (Legacy compatibility)
   */
  async syncAllCompetitions(): Promise<{ total: number; synced: number; errors: number }> {
    const result = await this.sync();
    return {
      total: result.total,
      synced: result.synced,
      errors: result.errors,
    };
  }

  /**
   * Sync incremental (Legacy compatibility)
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
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

interface CompetitionAdditionalListResponse {
  results?: CompetitionAdditional[];
  result?: CompetitionAdditional[];
  err?: string;
  code?: number;
  msg?: string;
}

