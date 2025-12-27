/**
 * Referee Sync Service
 * 
 * Fetches referee/official data from TheSports API and stores in database
 * Uses /referee/list endpoint with pagination
 * Critical for future "Card/Penalty" AI predictions
 */

import axios from 'axios';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';
import { RefereeRepository } from '../../../repositories/implementations/RefereeRepository';

export interface RefereeItem {
  id: string;
  country_id?: string;
  name: string;
  short_name?: string;
  logo?: string;
  birthday?: number; // Unix timestamp
  updated_at?: number;
}

export interface RefereeListResponse {
  results: RefereeItem[];
  err?: string;
  code?: number;
  msg?: string;
}

export class RefereeSyncService {
  private repository: RefereeRepository;
  private baseUrl: string;
  private user: string;
  private secret: string;

  constructor() {
    this.repository = new RefereeRepository();
    this.baseUrl = config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
    this.user = config.thesports?.user || '';
    this.secret = config.thesports?.secret || '';
  }

  /**
   * Fetch all referees from TheSports API
   * Uses pagination to get all results
   * Endpoint: GET /referee/list
   */
  async syncAllReferees(): Promise<{ total: number; synced: number; errors: number }> {
    logger.info('Starting referee sync from TheSports API...');
    
    let page = 1;
    let hasMore = true;
    let totalFetched = 0;
    let totalSynced = 0;
    let totalErrors = 0;

    while (hasMore) {
      try {
        logger.info(`Fetching referees page ${page}...`);
        
        const response = await axios.get<RefereeListResponse>(
          `${this.baseUrl}/referee/list`,
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

        const referees = data.results || [];
        totalFetched += referees.length;

        // CRITICAL: Break when results array is empty (as per API docs)
        if (referees.length === 0) {
          hasMore = false;
          break;
        }

        // Transform and save to database
        const refereesToSave = referees.map(referee => ({
          external_id: referee.id,
          name: referee.name || 'Unknown Referee',
          short_name: referee.short_name || null,
          logo: referee.logo || null,
          country_id: referee.country_id || null,
          birthday: referee.birthday || null,
          updated_at: referee.updated_at,
        }));

        try {
          const saved = await this.repository.batchUpsert(refereesToSave);
          totalSynced += saved.length;
          logger.info(`Synced ${saved.length} referees from page ${page}`);
        } catch (error: any) {
          logger.error(`Failed to save referees from page ${page}:`, error.message);
          totalErrors++;
        }

        // Move to next page
        page++;
        // Rate limit safety: wait 200ms between pages to avoid 429
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        logger.error(`Error fetching referees page ${page}:`, error.message);
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

    logger.info(`Referee sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
    return {
      total: totalFetched,
      synced: totalSynced,
      errors: totalErrors,
    };
  }

  /**
   * Sync referees incrementally (only new/updated since last sync)
   * Note: The /referee/list endpoint doesn't support time parameter,
   * so incremental sync will fetch all and update only changed records
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
    logger.info('Starting incremental referee sync...');
    
    // Since /referee/list doesn't support time parameter,
    // we'll do a full sync but the upsert will only update changed records
    const result = await this.syncAllReferees();
    return { total: result.total, synced: result.synced };
  }
}










