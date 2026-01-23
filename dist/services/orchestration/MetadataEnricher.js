"use strict";
/**
 * Metadata Enricher
 *
 * Fills missing metadata for minor league matches.
 * Pattern: Singleton (same as other orchestrators)
 *
 * PROBLEM: Minor leagues (Gambia, Sierra Leone, etc.) have matches with:
 * - season_id = NULL (prevents standings API)
 * - competition metadata incomplete
 *
 * SOLUTION: Cross-reference with multiple API endpoints to find season_id:
 * 1. /competition/info - Get seasons for competition
 * 2. /season/list - Get all seasons
 * 3. Cache mappings to avoid repeated lookups
 *
 * @module services/orchestration/MetadataEnricher
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetadataEnricher = exports.MetadataEnricher = void 0;
const connection_1 = require("../../database/connection");
const TheSportsAPIManager_1 = require("../../core/TheSportsAPIManager");
const logger_1 = require("../../utils/logger");
const RedisManager_1 = require("../../core/RedisManager");
class MetadataEnricher {
    constructor() {
        // Cache competition -> current season mapping (in memory)
        this.competitionSeasonCache = new Map();
        // Stats tracking
        this.stats = {
            totalEnrichments: 0,
            successfulEnrichments: 0,
            cacheHits: 0,
            failedEnrichments: 0,
        };
        logger_1.logger.info('[MetadataEnricher] Initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = new MetadataEnricher();
        }
        return this.instance;
    }
    /**
     * Enrich match with missing metadata (especially season_id)
     *
     * @param matchId - External match ID
     * @returns Enrichment result with found metadata
     */
    async enrichMatch(matchId) {
        this.stats.totalEnrichments++;
        try {
            // Step 1: Get match from database
            const matchResult = await connection_1.pool.query(`
        SELECT external_id, competition_id, season_id, home_team_id, away_team_id
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            if (matchResult.rows.length === 0) {
                logger_1.logger.warn(`[MetadataEnricher] Match ${matchId} not found`);
                return { enriched: false };
            }
            const match = matchResult.rows[0];
            // Already has season_id - no enrichment needed
            if (match.season_id) {
                return {
                    season_id: match.season_id,
                    competition_id: match.competition_id,
                    enriched: false,
                    source: 'existing'
                };
            }
            // Step 2: Try to find season_id from competition
            if (match.competition_id) {
                const seasonId = await this.findSeasonForCompetition(match.competition_id);
                if (seasonId) {
                    // Update match with found season_id
                    await connection_1.pool.query(`
            UPDATE ts_matches
            SET season_id = $1, updated_at = NOW()
            WHERE external_id = $2
          `, [seasonId, matchId]);
                    this.stats.successfulEnrichments++;
                    logger_1.logger.info(`[MetadataEnricher] ✅ Enriched ${matchId} with season_id ${seasonId}`);
                    return {
                        season_id: seasonId,
                        competition_id: match.competition_id,
                        enriched: true,
                        source: 'competition_info',
                    };
                }
            }
            // Step 3: Try /match/analysis endpoint for match-specific metadata
            const analysisSeasonId = await this.findSeasonFromMatchAnalysis(matchId);
            if (analysisSeasonId) {
                await connection_1.pool.query(`
          UPDATE ts_matches
          SET season_id = $1, updated_at = NOW()
          WHERE external_id = $2
        `, [analysisSeasonId, matchId]);
                this.stats.successfulEnrichments++;
                logger_1.logger.info(`[MetadataEnricher] ✅ Enriched ${matchId} with season_id ${analysisSeasonId} from match/analysis`);
                return {
                    season_id: analysisSeasonId,
                    competition_id: match.competition_id,
                    enriched: true,
                    source: 'match_analysis',
                };
            }
            this.stats.failedEnrichments++;
            logger_1.logger.debug(`[MetadataEnricher] Could not find season_id for ${matchId}`);
            return { enriched: false };
        }
        catch (error) {
            this.stats.failedEnrichments++;
            logger_1.logger.error(`[MetadataEnricher] Error enriching ${matchId}:`, error);
            return { enriched: false };
        }
    }
    /**
     * Find current season for a competition
     */
    async findSeasonForCompetition(competitionId) {
        // Check memory cache first
        const cached = this.competitionSeasonCache.get(competitionId);
        if (cached) {
            this.stats.cacheHits++;
            return cached;
        }
        // Check Redis cache
        const redisCached = await RedisManager_1.RedisManager.get(`meta:comp_season:${competitionId}`);
        if (redisCached) {
            this.competitionSeasonCache.set(competitionId, redisCached);
            this.stats.cacheHits++;
            return redisCached;
        }
        try {
            // Try /competition/info endpoint
            const response = await TheSportsAPIManager_1.theSportsAPI.get('/competition/info', {
                id: competitionId,
            });
            // Find current season (usually the one with most recent start date)
            const seasons = response?.results?.[0]?.seasons || [];
            if (seasons.length > 0) {
                // Sort by year descending, get latest
                const sortedSeasons = seasons.sort((a, b) => {
                    const yearA = parseInt(a.year || '0', 10);
                    const yearB = parseInt(b.year || '0', 10);
                    return yearB - yearA;
                });
                const currentSeason = sortedSeasons[0];
                if (currentSeason?.id) {
                    // Cache for 24 hours
                    this.competitionSeasonCache.set(competitionId, currentSeason.id);
                    await RedisManager_1.RedisManager.set(`meta:comp_season:${competitionId}`, currentSeason.id, 86400);
                    logger_1.logger.debug(`[MetadataEnricher] Found season ${currentSeason.id} for competition ${competitionId}`);
                    return currentSeason.id;
                }
            }
            return null;
        }
        catch (error) {
            logger_1.logger.warn(`[MetadataEnricher] Failed to get competition info for ${competitionId}:`, error);
            return null;
        }
    }
    /**
     * Find season_id from /match/analysis endpoint
     */
    async findSeasonFromMatchAnalysis(matchId) {
        try {
            const response = await TheSportsAPIManager_1.theSportsAPI.get('/match/analysis', {
                match_id: matchId,
            });
            const seasonId = response?.results?.[0]?.season_id;
            return seasonId || null;
        }
        catch (error) {
            logger_1.logger.debug(`[MetadataEnricher] match/analysis failed for ${matchId}`);
            return null;
        }
    }
    /**
     * Batch enrich multiple matches (for cron jobs)
     */
    async enrichBatch(limit = 100) {
        let enriched = 0;
        let failed = 0;
        try {
            // Find matches without season_id
            const result = await connection_1.pool.query(`
        SELECT external_id
        FROM ts_matches
        WHERE season_id IS NULL
          AND competition_id IS NOT NULL
          AND match_time > NOW() - INTERVAL '7 days'
        ORDER BY match_time DESC
        LIMIT $1
      `, [limit]);
            for (const row of result.rows) {
                const enrichResult = await this.enrichMatch(row.external_id);
                if (enrichResult.enriched) {
                    enriched++;
                }
                else {
                    failed++;
                }
            }
            logger_1.logger.info(`[MetadataEnricher] Batch complete: ${enriched} enriched, ${failed} failed`);
        }
        catch (error) {
            logger_1.logger.error('[MetadataEnricher] Batch enrichment error:', error);
        }
        return { enriched, failed };
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
}
exports.MetadataEnricher = MetadataEnricher;
MetadataEnricher.instance = null;
// Export singleton getter
const getMetadataEnricher = () => MetadataEnricher.getInstance();
exports.getMetadataEnricher = getMetadataEnricher;
