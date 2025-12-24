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
   * Legacy method for backward compatibility
   * @deprecated Use sync() instead
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

  /**
   * Fetch all competitions from TheSports API
   * Uses pagination to get all results
   */
  async syncAllCompetitions(): Promise<{ total: number; synced: number; errors: number }> {
    logger.info('Starting competition sync from TheSports API...');
    
    let page = 1;
    let hasMore = true;
    let totalFetched = 0;
    let totalSynced = 0;
    let totalErrors = 0;

    while (hasMore) {
      try {
        logger.info(`Fetching competitions page ${page}...`);
        
        const response = await axios.get<CompetitionAdditionalListResponse>(
          `${this.baseUrl}/competition/additional/list`,
          {
            params: {
              user: this.user,
              secret: this.secret,
              page,
            },
            timeout: 30000,
          }
        );

        const data = response.data;

        // Check for errors
        if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
          const errorMsg = data.err || data.msg || 'Unknown error';
          logger.warn(`TheSports API error on page ${page}: ${errorMsg}`);
          
          // If rate limited, wait and retry
          if (data.code === 429 || errorMsg.toLowerCase().includes('too many requests')) {
            logger.warn('Rate limit hit, waiting 60 seconds...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue; // Retry same page
          }
          
          totalErrors++;
          page++;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before next page
          continue;
        }

        const competitions = data.results || [];
        totalFetched += competitions.length;

        // CRITICAL: Break when results array is empty (as per API docs)
        if (competitions.length === 0) {
          hasMore = false;
          break;
        }

        // Transform and save to database
        const competitionsToSave = competitions.map(comp => ({
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

        try {
          const saved = await this.repository.batchUpsert(competitionsToSave);
          totalSynced += saved.length;
          logger.info(`Synced ${saved.length} competitions from page ${page}`);
        } catch (error: any) {
          logger.error(`Failed to save competitions from page ${page}:`, error.message);
          totalErrors++;
        }

        // Move to next page
        page++;
        // Rate limit safety: wait 200ms between pages to avoid 429
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        logger.error(`Error fetching competitions page ${page}:`, error.message);
        totalErrors++;
        
        // If rate limited, wait longer
        if (error.response?.status === 429 || error.message?.includes('429')) {
          logger.warn('Rate limit hit, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          page++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    logger.info(`Competition sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
    return {
      total: totalFetched,
      synced: totalSynced,
      errors: totalErrors,
    };
  }

  /**
   * Sync competitions incrementally (only new/updated since last sync)
   * Uses time parameter for incremental updates
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
    logger.info('Starting incremental competition sync...');
    
    const time = lastSyncTime || 0;
    let totalFetched = 0;
    let totalSynced = 0;

    try {
      const response = await axios.get<CompetitionAdditionalListResponse>(
        `${this.baseUrl}/competition/additional/list`,
        {
          params: {
            user: this.user,
            secret: this.secret,
            time, // Unix timestamp for incremental sync
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
        const errorMsg = data.err || data.msg || 'Unknown error';
        logger.warn(`TheSports API error: ${errorMsg}`);
        return { total: 0, synced: 0 };
      }

      const competitions = data.results || [];
      totalFetched = competitions.length;

      if (competitions.length > 0) {
        const competitionsToSave = competitions.map(comp => ({
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
        }));

        const saved = await this.repository.batchUpsert(competitionsToSave);
        totalSynced = saved.length;
        logger.info(`Incremental sync: ${totalSynced} competitions updated`);
      }

    } catch (error: any) {
      logger.error('Error in incremental competition sync:', error.message);
    }

    return { total: totalFetched, synced: totalSynced };
  }
}

