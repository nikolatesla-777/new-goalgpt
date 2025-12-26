/**
 * Data Fetcher Utility
 * 
 * Generic utility for fetching paginated data from TheSports API
 * Handles both Full Update (pagination) and Incremental Update (time parameter)
 */

import axios, { AxiosResponse } from 'axios';
import { logger } from '../../../utils/logger';
import { config } from '../../../config';

export interface ListResponse<T> {
  results: T[];
  err?: string;
  code?: number;
  msg?: string;
}

export interface FetchOptions {
  endpoint: string;
  params?: Record<string, any>;
  rateLimitDelay?: number; // Delay between pages (ms)
  timeout?: number;
  retryOnRateLimit?: boolean;
}

export interface FetchResult<T> {
  items: T[];
  totalFetched: number;
  errors: number;
  maxUpdatedAt: number | null; // Maximum updated_at from fetched items
}

export class DataFetcher {
  private baseUrl: string;
  private user: string;
  private secret: string;

  constructor() {
    this.baseUrl = config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
    this.user = config.thesports?.user || '';
    this.secret = config.thesports?.secret || '';
  }

  /**
   * Fetch all pages (Full Update)
   * Loops through pages starting from 1 until results array is empty
   */
  async fetchAllPages<T extends { updated_at?: number }>(
    options: FetchOptions
  ): Promise<FetchResult<T>> {
    const {
      endpoint,
      params = {},
      rateLimitDelay = 200,
      timeout = 30000,
      retryOnRateLimit = true,
    } = options;

    let page = 1;
    let hasMore = true;
    const allItems: T[] = [];
    let totalErrors = 0;
    let maxUpdatedAt: number | null = null;

    while (hasMore) {
      try {
        logger.debug(`Fetching ${endpoint} page ${page}...`);

        const response = await axios.get<ListResponse<T>>(
          `${this.baseUrl}${endpoint}`,
          {
            params: {
              user: this.user,
              secret: this.secret,
              page,
              ...params, // Additional params (e.g., time for incremental)
            },
            timeout,
          }
        );

        const data = response.data;

        // Check for errors
        if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
          const errorMsg = data.err || data.msg || 'Unknown error';
          logger.warn(`TheSports API error on page ${page}: ${errorMsg}`);

          // Handle rate limiting
          if (data.code === 429 || errorMsg.toLowerCase().includes('too many requests')) {
            if (retryOnRateLimit) {
              logger.warn('Rate limit hit, waiting 60 seconds...');
              await new Promise(resolve => setTimeout(resolve, 60000));
              continue; // Retry same page
            }
          }

          totalErrors++;
          page++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        const items = data.results || [];

        // CRITICAL: Break when results array is empty (as per API docs)
        if (items.length === 0) {
          hasMore = false;
          break;
        }

        // Track max updated_at for incremental sync
        for (const item of items) {
          if (item.updated_at) {
            if (maxUpdatedAt === null || item.updated_at > maxUpdatedAt) {
              maxUpdatedAt = item.updated_at;
            }
          }
        }

        allItems.push(...items);

        // Move to next page
        page++;
        // Rate limit safety: wait between pages
        if (rateLimitDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
        }
      } catch (error: any) {
        logger.error(`Error fetching ${endpoint} page ${page}:`, error.message);
        totalErrors++;

        // Handle rate limiting
        if (error.response?.status === 429 || error.message?.includes('429')) {
          if (retryOnRateLimit) {
            logger.warn('Rate limit hit, waiting 60 seconds...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue; // Retry same page
          }
        } else {
          page++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    logger.info(`Fetched ${allItems.length} items from ${endpoint} (${totalErrors} errors)`);

    return {
      items: allItems,
      totalFetched: allItems.length,
      errors: totalErrors,
      maxUpdatedAt,
    };
  }

  /**
   * Fetch incremental updates (Incremental Update)
   * Uses time parameter to fetch only changed/new records
   * @param time - Unix timestamp (MAX(updated_at) + 1 from local DB)
   */
  async fetchIncremental<T extends { updated_at?: number }>(
    options: FetchOptions,
    time: number
  ): Promise<FetchResult<T>> {
    return this.fetchAllPages<T>({
      ...options,
      params: {
        ...options.params,
        time, // Add time parameter for incremental fetch
      },
    });
  }
}









