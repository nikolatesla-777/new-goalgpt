
/**
 * Team Sync Service
 * 
 * Fetches team/club data from TheSports API and stores in database
 * Uses /team/additional/list endpoint
 * Implements Full Update vs Incremental Update logic
 */

import { logger } from '../../../utils/logger';
import { TeamRepository } from '../../../repositories/implementations/TeamRepository';
import { BaseSyncService } from '../sync/baseSync.service';
import { FetchOptions, FetchResult } from '../sync/dataFetcher.util';

export interface TeamAdditional {
  id: string;
  name: string;
  short_name?: string;
  logo?: string;
  logo_url?: string;
  competition_id?: string;
  country_id?: string;
  national?: number; // 1=Yes, 0=No
  foundation_time?: number;
  website?: string;
  venue_id?: string;
  coach_id?: string;
  updated_at?: number; // Unix timestamp
  uid?: string | null; // Master ID if this is a duplicate (empty/null = master record)
}

export class TeamSyncService extends BaseSyncService<TeamAdditional> {
  private repository: TeamRepository;

  constructor() {
    super('team');
    this.repository = new TeamRepository();
  }

  /**
   * Get fetch options for team endpoint
   */
  protected getFetchOptions(): FetchOptions {
    return {
      endpoint: '/team/additional/list',
      rateLimitDelay: 200, // 200ms between pages
      timeout: 30000,
      retryOnRateLimit: true,
    };
  }

  /**
   * Fetch full update (all pages)
   */
  protected async fetchFullUpdate(): Promise<FetchResult<TeamAdditional>> {
    return this.dataFetcher.fetchAllPages<TeamAdditional>(this.getFetchOptions());
  }

  /**
   * Fetch incremental update (with time parameter)
   */
  protected async fetchIncrementalUpdate(time: number): Promise<FetchResult<TeamAdditional>> {
    return this.dataFetcher.fetchIncremental<TeamAdditional>(this.getFetchOptions(), time);
  }

  /**
   * Save teams to database
   */
  protected async saveToDatabase(items: TeamAdditional[]): Promise<number> {
    if (items.length === 0) return 0;

    const teamsToSave = items.map(team => ({
      external_id: team.id,
      name: team.name || 'Unknown Team',
      short_name: team.short_name || null,
      logo_url: team.logo || team.logo_url || null,
      website: team.website || null,
      national: team.national !== undefined ? (team.national === 1) : null, // Convert 1->true, 0->false
      foundation_time: team.foundation_time || null,
      competition_id: team.competition_id || null,
      country_id: team.country_id || null,
      venue_id: team.venue_id || null,
      coach_id: team.coach_id || null,
      uid: team.uid || null, // Master ID if duplicate
      updated_at: team.updated_at,
    }));

    const saved = await this.repository.batchUpsert(teamsToSave);
    return saved.length;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use sync() instead
   */
  async syncAllTeams(): Promise<{ total: number; synced: number; errors: number }> {
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
