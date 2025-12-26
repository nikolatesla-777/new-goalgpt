/**
 * Compensation Service
 * 
 * Handles historical compensation data from /compensation/list endpoint
 * Returns H2H, recent record, and historical compensation for upcoming matches
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { pool } from '../../../database/connection';

export interface CompensationResponse {
    code: number;
    results: any[];
}

export class CompensationService {
    constructor(private client: TheSportsClient) { }

    /**
     * Get compensation list with pagination support
     */
    async getCompensationList(page: number = 1): Promise<CompensationResponse> {
        const cacheKey = `${CacheKeyPrefix.TheSports}:compensation:list:${page}`;

        const cached = await cacheService.get<CompensationResponse>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for compensation list: ${cacheKey}`);
            return cached;
        }

        logger.info(`Fetching compensation list page ${page}`);
        const response = await this.client.get<CompensationResponse>('/compensation/list', { page });

        // Cache for 30 minutes
        await cacheService.set(cacheKey, response, CacheTTL.FiveMinutes * 6);

        return response;
    }

    /**
     * Sync compensation data to database for a match
     */
    async syncCompensationToDb(matchData: any): Promise<void> {
        if (!matchData.id) return;

        const client = await pool.connect();
        try {
            await client.query(`
        INSERT INTO ts_compensation (match_id, h2h_data, recent_record, historical_compensation, raw_response, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (match_id) 
        DO UPDATE SET 
          h2h_data = EXCLUDED.h2h_data,
          recent_record = EXCLUDED.recent_record,
          historical_compensation = EXCLUDED.historical_compensation,
          raw_response = EXCLUDED.raw_response,
          updated_at = NOW()
      `, [
                matchData.id,
                JSON.stringify(matchData.h2h || null),
                JSON.stringify(matchData.recent_record || null),
                JSON.stringify(matchData.historical_compensation || null),
                JSON.stringify(matchData)
            ]);

            logger.debug(`✅ Synced compensation for match ${matchData.id}`);
        } catch (error: any) {
            logger.error(`Failed to sync compensation for match ${matchData.id}:`, error.message);
        } finally {
            client.release();
        }
    }

    /**
     * Sync all compensation data (paginated)
     */
    async syncAllCompensation(): Promise<number> {
        let page = 1;
        let totalSynced = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await this.getCompensationList(page);

            if (!response.results || response.results.length === 0) {
                hasMore = false;
                break;
            }

            for (const matchData of response.results) {
                await this.syncCompensationToDb(matchData);
                totalSynced++;
            }

            // Check if there are more pages (TheSports typically returns 100 per page)
            if (response.results.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        logger.info(`✅ Synced ${totalSynced} compensation records`);
        return totalSynced;
    }
}
