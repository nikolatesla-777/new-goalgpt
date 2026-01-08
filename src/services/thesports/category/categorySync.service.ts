
/**
 * Category Sync Service
 * 
 * Fetches category (country/region) data from TheSports API and stores in database
 * STATUS: Skeleton - waiting for API documentation to define endpoint and response structure
 */

import axios from 'axios';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';
import { CategoryRepository } from '../../../repositories/implementations/CategoryRepository';

// Response structure based on API documentation
export interface CategoryItem {
  id: string; // External ID from TheSports API
  name: string;
  updated_at: number; // Unix timestamp
}

export interface CategoryListResponse {
  results: CategoryItem[];
  err?: string;
  code?: number;
  msg?: string;
}

export class CategorySyncService {
  private repository: CategoryRepository;
  private baseUrl: string;
  private user: string;
  private secret: string;

  constructor() {
    this.repository = new CategoryRepository();
    this.baseUrl = config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
    this.user = config.thesports?.user || '';
    this.secret = config.thesports?.secret || '';
  }

  /**
   * Fetch all categories from TheSports API
   * Endpoint: GET /category/list
   */
  async syncAllCategories(): Promise<{ total: number; synced: number; errors: number }> {
    logger.info('Starting category sync from TheSports API...');
    
    let totalFetched = 0;
    let totalSynced = 0;
    let totalErrors = 0;

    try {
      logger.info('Fetching categories from /category/list...');
      
      const response = await axios.get<CategoryListResponse>(
        `${this.baseUrl}/category/list`,
        {
          params: {
            user: this.user,
            secret: this.secret,
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      // Check for errors
      if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
        const errorMsg = data.err || data.msg || 'Unknown error';
        logger.warn(`TheSports API error: ${errorMsg}`);
        
        // If rate limited, wait and retry
        if (data.code === 429 || errorMsg.toLowerCase().includes('too many requests')) {
          logger.warn('Rate limit hit, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          // Retry once
          return this.syncAllCategories();
        }
        
        return {
          total: 0,
          synced: 0,
          errors: 1,
        };
      }

      const categories = data.results || [];
      totalFetched = categories.length;

      if (categories.length === 0) {
        logger.warn('No categories returned from API');
        return {
          total: 0,
          synced: 0,
          errors: 0,
        };
      }

      // Transform and save to database
      const categoriesToSave = categories.map(cat => ({
        external_id: cat.id,
        name: cat.name,
        updated_at: cat.updated_at,
      }));

      try {
        const saved = await this.repository.batchUpsert(categoriesToSave);
        totalSynced = saved.length;
        logger.info(`Synced ${saved.length} categories to database`);
      } catch (error: any) {
        logger.error(`Failed to save categories:`, error.message);
        totalErrors = categories.length;
      }

    } catch (error: any) {
      logger.error(`Error fetching categories:`, error.message);
      
      // If rate limited, wait and retry
      if (error.response?.status === 429 || error.message?.includes('429')) {
        logger.warn('Rate limit hit, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        // Retry once
        return this.syncAllCategories();
      }
      
      totalErrors = 1;
    }

    logger.info(`Category sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
    return {
      total: totalFetched,
      synced: totalSynced,
      errors: totalErrors,
    };
  }

  /**
   * Sync categories incrementally (only new/updated since last sync)
   * Note: The /category/list endpoint doesn't support time parameter,
   * so incremental sync will fetch all and update only changed records
   */
  async syncIncremental(lastSyncTime?: number): Promise<{ total: number; synced: number }> {
    logger.info('Starting incremental category sync...');
    
    // Since /category/list doesn't support time parameter,
    // we'll do a full sync but the upsert will only update changed records
    const result = await this.syncAllCategories();
    return { total: result.total, synced: result.synced };
  }
}

