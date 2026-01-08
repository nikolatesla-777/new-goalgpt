
/**
 * Venue Sync Service
 * 
 * Fetches venue/stadium data from TheSports API and stores in database
 * Uses /venue/list endpoint with pagination
 * Critical for "Home Advantage" analysis and future Weather integration
 */

import axios from 'axios';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';
import { VenueRepository } from '../../../repositories/implementations/VenueRepository';

export interface VenueItem {
  id: string;
  country_id?: string;
  name: string;
  city?: string;
  capacity?: number;
  updated_at?: number;
}

export interface VenueListResponse {
  results: VenueItem[];
  err?: string;
  code?: number;
  msg?: string;
}

export class VenueSyncService {
  private repository: VenueRepository;
  private baseUrl: string;
  private user: string;
  private secret: string;

  constructor() {
    this.repository = new VenueRepository();
    this.baseUrl = config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
    this.user = config.thesports?.user || '';
    this.secret = config.thesports?.secret || '';
  }

  /**
   * Fetch all venues from TheSports API
   * Uses pagination to get all results
   * Endpoint: GET /venue/list
   */
  async syncAllVenues(): Promise<{ total: number; synced: number; errors: number }> {
    logger.info('Starting venue sync from TheSports API...');
    
    let page = 1;
    let hasMore = true;
    let totalFetched = 0;
    let totalSynced = 0;
    let totalErrors = 0;

    while (hasMore) {
      try {
        logger.info(`Fetching venues page ${page}...`);
        
        const response = await axios.get<VenueListResponse>(
          `${this.baseUrl}/venue/list`,
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

        const venues = data.results || [];
        totalFetched += venues.length;

        // CRITICAL: Break when results array is empty (as per API docs)
        if (venues.length === 0) {
          hasMore = false;
          break;
        }

        // Transform and save to database
        const venuesToSave = venues.map(venue => ({
          external_id: venue.id,
          name: venue.name || 'Unknown Venue',
          city: venue.city || null,
          capacity: venue.capacity || null,
          country_id: venue.country_id || null,
          updated_at: venue.updated_at,
        }));

        try {
          const saved = await this.repository.batchUpsert(venuesToSave);
          totalSynced += saved.length;
          logger.info(`Synced ${saved.length} venues from page ${page}`);
        } catch (error: any) {
          logger.error(`Failed to save venues from page ${page}:`, error.message);
          totalErrors++;
        }

        // Move to next page
        page++;
        // Rate limit safety: wait 200ms between pages to avoid 429
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        logger.error(`Error fetching venues page ${page}:`, error.message);
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

    logger.info(`Venue sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
    return {
      total: totalFetched,
      synced: totalSynced,
      errors: totalErrors,
    };
  }

  /**
   * Sync venues incrementally (only new/updated since last sync)
   * Note: The /venue/list endpoint doesn't support time parameter,
   * so incremental sync will fetch all and update only changed records
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
    logger.info('Starting incremental venue sync...');
    
    // Since /venue/list doesn't support time parameter,
    // we'll do a full sync but the upsert will only update changed records
    const result = await this.syncAllVenues();
    return { total: result.total, synced: result.synced };
  }
}










