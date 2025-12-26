/**
 * Table Live Service
 * 
 * Handles real-time standings from /table/live endpoint
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { pool } from '../../../database/connection';

export interface TableLiveResponse {
    code: number;
    results: any[];
}

export class TableLiveService {
    constructor(private client: TheSportsClient) { }

    /**
     * Get real-time standings with cache support
     */
    async getTableLive(seasonId?: string): Promise<TableLiveResponse> {
        const cacheKey = `${CacheKeyPrefix.TheSports}:table:live${seasonId ? `:${seasonId}` : ''}`;

        const cached = await cacheService.get<TableLiveResponse>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for table live: ${cacheKey}`);
            return cached;
        }

        logger.info(`Fetching table live${seasonId ? ` for season ${seasonId}` : ''}`);
        const params = seasonId ? { season_id: seasonId } : {};
        const response = await this.client.get<TableLiveResponse>('/table/live', params);

        // Cache for 1 minute (real-time data)
        await cacheService.set(cacheKey, response, CacheTTL.Minute);

        return response;
    }

    /**
     * Sync standings to database for a season
     */
    async syncStandingsToDb(seasonId: string): Promise<void> {
        try {
            const response = await this.getTableLive(seasonId);

            if (!response.results || response.results.length === 0) {
                logger.debug(`No standings data for season ${seasonId}`);
                return;
            }

            const client = await pool.connect();
            try {
                await client.query(`
          INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (season_id) 
          DO UPDATE SET 
            standings = EXCLUDED.standings,
            raw_response = EXCLUDED.raw_response,
            updated_at = NOW()
        `, [seasonId, JSON.stringify(response.results), JSON.stringify(response)]);

                logger.info(`✅ Synced standings for season ${seasonId}`);
            } finally {
                client.release();
            }
        } catch (error: any) {
            logger.error(`Failed to sync standings for season ${seasonId}:`, error.message);
        }
    }
}
