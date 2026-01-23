"use strict";
/**
 * Compensation Service
 *
 * Handles historical compensation data from /compensation/list endpoint
 * Returns H2H, recent record, and historical compensation for upcoming matches
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const connection_1 = require("../../../database/connection");
class CompensationService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get compensation list with pagination support
     */
    async getCompensationList(page = 1) {
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:compensation:list:${page}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Cache hit for compensation list: ${cacheKey}`);
            return cached;
        }
        logger_1.logger.info(`Fetching compensation list page ${page}`);
        const response = await this.client.get('/compensation/list', { page });
        // Cache for 30 minutes
        await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.FiveMinutes * 6);
        return response;
    }
    /**
     * Sync compensation data to database for a match
     * Updates both ts_compensation table and ts_matches table
     */
    async syncCompensationToDb(matchData) {
        if (!matchData.id)
            return;
        const client = await connection_1.pool.connect();
        try {
            // Extract data from API response
            const history = matchData.history || matchData.h2h || {};
            const recent = matchData.recent || matchData.recent_record || {};
            const similar = matchData.similar || matchData.historical_compensation || {};
            // Extract win rates from history (historical confrontation)
            const homeWinRate = history.home?.rate || null;
            const awayWinRate = history.away?.rate || null;
            // Calculate draw rate from history counts (more accurate than estimation)
            // Use home team's stats to calculate total matches and draw rate
            let drawRate = null;
            if (history.home?.won_count != null && history.home?.drawn_count != null && history.home?.lost_count != null) {
                const totalMatches = history.home.won_count + history.home.drawn_count + history.home.lost_count;
                if (totalMatches > 0) {
                    drawRate = history.home.drawn_count / totalMatches;
                }
            }
            else if (homeWinRate != null && awayWinRate != null) {
                // Fallback: Estimate draw rate if counts are not available
                // Draw rate = 1 - home_win_rate - away_win_rate (normalized)
                const sum = homeWinRate + awayWinRate;
                if (sum < 1) {
                    drawRate = 1 - sum;
                }
            }
            // Extract recent form win rates
            const homeRecentWinRate = recent.home?.rate || null;
            const awayRecentWinRate = recent.away?.rate || null;
            // 1. Update ts_compensation table (existing logic)
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
                JSON.stringify(history),
                JSON.stringify(recent),
                JSON.stringify(similar),
                JSON.stringify(matchData)
            ]);
            // 2. Update ts_matches table with compensation data
            // Check if compensation columns exist
            const columnCheck = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'ts_matches' 
                AND column_name IN ('home_win_rate', 'away_win_rate', 'draw_rate', 'home_recent_win_rate', 'away_recent_win_rate', 'compensation_data')
            `);
            const hasCompensationColumns = columnCheck.rows.length > 0;
            if (hasCompensationColumns) {
                await client.query(`
                    UPDATE ts_matches
                    SET 
                      home_win_rate = $1,
                      away_win_rate = $2,
                      draw_rate = $3,
                      home_recent_win_rate = $4,
                      away_recent_win_rate = $5,
                      compensation_data = $6::jsonb,
                      updated_at = NOW()
                    WHERE external_id = $7
                `, [
                    homeWinRate,
                    awayWinRate,
                    drawRate,
                    homeRecentWinRate,
                    awayRecentWinRate,
                    JSON.stringify(matchData),
                    matchData.id
                ]);
            }
            logger_1.logger.debug(`✅ Synced compensation for match ${matchData.id}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to sync compensation for match ${matchData.id}:`, error.message);
        }
        finally {
            client.release();
        }
    }
    /**
     * Sync all compensation data (paginated)
     */
    async syncAllCompensation() {
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
            }
            else {
                page++;
            }
        }
        logger_1.logger.info(`✅ Synced ${totalSynced} compensation records`);
        return totalSynced;
    }
}
exports.CompensationService = CompensationService;
