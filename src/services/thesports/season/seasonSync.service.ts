/**
 * Season Sync Service
 * 
 * Fetches season/timeline data from TheSports API and stores in database
 * Uses /season/list endpoint with pagination
 * Critical for "Standings/Table" and filtering current matches
 */

import axios from 'axios';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';
import { SeasonRepository } from '../../../repositories/implementations/SeasonRepository';

export interface SeasonItem {
  id: string;
  competition_id?: string;
  year?: string; // e.g. "2023-2024"
  is_current?: number; // 1=Yes, 0=No
  has_player_stats?: number;
  has_team_stats?: number;
  has_table?: number; // 1=Has Standings
  start_time?: number; // Unix timestamp
  end_time?: number; // Unix timestamp
  updated_at?: number;
}

export interface SeasonListResponse {
  results: SeasonItem[];
  err?: string;
  code?: number;
  msg?: string;
}

export class SeasonSyncService {
  private repository: SeasonRepository;
  private baseUrl: string;
  private user: string;
  private secret: string;

  constructor() {
    this.repository = new SeasonRepository();
    this.baseUrl = config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
    this.user = config.thesports?.user || '';
    this.secret = config.thesports?.secret || '';
  }

  /**
   * Fetch all seasons from TheSports API
   * Uses pagination to get all results
   * Endpoint: GET /season/list
   */
  async syncAllSeasons(): Promise<{ total: number; synced: number; errors: number }> {
    logger.info('Starting season sync from TheSports API...');
    
    let page = 1;
    let hasMore = true;
    let totalFetched = 0;
    let totalSynced = 0;
    let totalErrors = 0;

    while (hasMore) {
      try {
        logger.info(`Fetching seasons page ${page}...`);
        
        const response = await axios.get<SeasonListResponse>(
          `${this.baseUrl}/season/list`,
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

        const seasons = data.results || [];
        totalFetched += seasons.length;

        // CRITICAL: Break when results array is empty (as per API docs)
        if (seasons.length === 0) {
          hasMore = false;
          break;
        }

        // Transform and save to database
        // Note: Integer fields (0/1) will be converted to booleans in repository
        const seasonsToSave = seasons.map(season => ({
          external_id: season.id,
          competition_id: season.competition_id || null,
          year: season.year || null,
          is_current: season.is_current,
          has_table: season.has_table,
          has_player_stats: season.has_player_stats,
          has_team_stats: season.has_team_stats,
          start_time: season.start_time || null,
          end_time: season.end_time || null,
          updated_at: season.updated_at,
        }));

        try {
          const saved = await this.repository.batchUpsert(seasonsToSave);
          totalSynced += saved.length;
          logger.info(`Synced ${saved.length} seasons from page ${page}`);
        } catch (error: any) {
          logger.error(`Failed to save seasons from page ${page}:`, error.message);
          totalErrors++;
        }

        // Move to next page
        page++;
        // Rate limit safety: wait 200ms between pages to avoid 429
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        logger.error(`Error fetching seasons page ${page}:`, error.message);
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

    logger.info(`Season sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
    return {
      total: totalFetched,
      synced: totalSynced,
      errors: totalErrors,
    };
  }

  /**
   * Sync seasons incrementally (only new/updated since last sync)
   * Note: The /season/list endpoint doesn't support time parameter,
   * so incremental sync will fetch all and update only changed records
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
    logger.info('Starting incremental season sync...');
    
    // Since /season/list doesn't support time parameter,
    // we'll do a full sync but the upsert will only update changed records
    const result = await this.syncAllSeasons();
    return { total: result.total, synced: result.synced };
  }
}









