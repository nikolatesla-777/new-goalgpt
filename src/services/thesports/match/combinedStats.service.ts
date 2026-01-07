/**
 * Combined Stats Service
 * 
 * Combines data from multiple TheSports API endpoints:
 * 1. /match/detail_live (or /match/live/history for historical) - Basic stats (corner, cards, shots, attacks, possession)
 * 2. /match/team_stats/list (or /detail for historical) - Detailed team stats (passes, tackles, interceptions)
 * 
 * This provides comprehensive match statistics similar to AIscore.
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { MatchDetailLiveService } from './matchDetailLive.service';
import { MatchTeamStatsService } from './matchTeamStats.service';
import { pool } from '../../../database/connection';

// Stat type mapping for human-readable names
// Based on official TheSports API documentation for detail_live and team_stats
export const STAT_TYPE_MAP: Record<number, { name: string; nameTr: string }> = {
    // Basic stats (detail_live / TechnicalStatistics enum)
    1: { name: 'Goals', nameTr: 'Gol' },
    2: { name: 'Corner Kicks', nameTr: 'Korner' },
    3: { name: 'Yellow Cards', nameTr: 'Sarı Kart' },
    4: { name: 'Red Cards', nameTr: 'Kırmızı Kart' },
    5: { name: 'Offsides', nameTr: 'Ofsayt' },
    6: { name: 'Free Kicks', nameTr: 'Serbest Vuruş' },
    7: { name: 'Goal Kicks', nameTr: 'Aut' },
    8: { name: 'Penalties', nameTr: 'Penaltı' },
    9: { name: 'Substitutions', nameTr: 'Oyuncu Değişikliği' },
    21: { name: 'Shots on Target', nameTr: 'İsabetli Şut' },
    22: { name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
    23: { name: 'Attacks', nameTr: 'Atak' },
    24: { name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
    25: { name: 'Ball Possession (%)', nameTr: 'Top Hakimiyeti' },
    37: { name: 'Blocked Shots', nameTr: 'Engellenen Şut' },

    // Detailed stats (team_stats / HalfTimeStatistics enum)
    33: { name: 'Dribbles', nameTr: 'Top Sürme' },
    34: { name: 'Successful Dribbles', nameTr: 'Başarılı Top Sürme' },
    36: { name: 'Clearances', nameTr: 'Uzaklaştırma (Eski)' },
    38: { name: 'Interceptions', nameTr: 'Top Çalma (Eski)' },
    39: { name: 'Tackles', nameTr: 'Müdahale (Eski)' },
    40: { name: 'Total Passes', nameTr: 'Toplam Pas (Eski)' },
    41: { name: 'Accurate Passes', nameTr: 'İsabetli Pas (Eski)' },
    42: { name: 'Key Passes', nameTr: 'Kilit Pas (Eski)' },
    43: { name: 'Crosses', nameTr: 'Orta' },
    44: { name: 'Accurate Crosses', nameTr: 'İsabetli Orta (Eski)' },
    45: { name: 'Long Balls', nameTr: 'Uzun Pas (Eski)' },
    46: { name: 'Accurate Long Balls', nameTr: 'İsabetli Uzun Pas (Eski)' },
    51: { name: 'Fouls', nameTr: 'Faul (Eski)' },
    52: { name: 'Saves', nameTr: 'Kurtarış' },
    69: { name: 'Hit Woodwork', nameTr: 'Direkten Dönen (Eski)' },
    83: { name: 'Total Shots', nameTr: 'Toplam Şut' },

    // Custom Detailed Stats (Mapped from team_stats/list named fields)
    101: { name: 'Total Passes', nameTr: 'Toplam Pas' },
    102: { name: 'Accurate Passes', nameTr: 'İsabetli Pas' },
    103: { name: 'Key Passes', nameTr: 'Kilit Pas' },
    104: { name: 'Accurate Crosses', nameTr: 'İsabetli Orta' },
    105: { name: 'Accurate Long Balls', nameTr: 'İsabetli Uzun Top' },
    106: { name: 'Interceptions', nameTr: 'Top Kesme' },
    107: { name: 'Fouls', nameTr: 'Faul' },
    108: { name: 'Offsides', nameTr: 'Ofsayt' },
    109: { name: 'Fastbreak Shots', nameTr: 'Hızlı Hücum Şutu' },
    110: { name: 'Duels / Tackles', nameTr: 'İkili Mücadele' },
    111: { name: 'Clearances', nameTr: 'Uzaklaştırma' },
    112: { name: 'Successful Dribbles', nameTr: 'Başarılı Çalım' },
    113: { name: 'Duels Won', nameTr: 'Kazanılan İkili Mücadele' },
    115: { name: 'Hit Woodwork', nameTr: 'Direkten Dönen' }
};

export interface CombinedStatItem {
    type: number;
    home: number;
    away: number;
    name: string;
    nameTr: string;
    source: 'basic' | 'detailed';
}

export interface HalfTimeStats {
    firstHalf: CombinedStatItem[];
    secondHalf: CombinedStatItem[];
    fullTime: CombinedStatItem[];
}

export interface CombinedMatchStats {
    matchId: string;
    basicStats: CombinedStatItem[];
    detailedStats: CombinedStatItem[];
    allStats: CombinedStatItem[];
    halfTimeStats?: HalfTimeStats;
    incidents: any[];
    score: any[] | null;
    lastUpdated: number;
}

// Field mapping for team_stats/list to Custom IDs
const FIELD_TO_ID_MAP: Record<string, number> = {
    'passes': 101,
    'passes_accuracy': 102,
    'key_passes': 103,
    'crosses_accuracy': 104,
    'long_balls_accuracy': 105,
    'interceptions': 106,
    'fouls': 107,
    'offsides': 108,
    'fastbreak_shots': 109,
    'tackles': 110,
    'clearances': 111,
    'dribble_succ': 112,
    'duels_won': 113,
    'hit_woodwork': 115
};

export class CombinedStatsService {
    private matchDetailLiveService: MatchDetailLiveService;
    private matchTeamStatsService: MatchTeamStatsService;

    constructor(private client: TheSportsClient) {
        this.matchDetailLiveService = new MatchDetailLiveService(client);
        this.matchTeamStatsService = new MatchTeamStatsService(client);
    }

    /**
     * Get combined match statistics from multiple endpoints
     * Merges basic stats (detail_live) with detailed stats (team_stats)
     */
    async getCombinedMatchStats(matchId: string): Promise<CombinedMatchStats> {
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:combined_stats:${matchId}`;

        // Check cache first (short TTL for live data)
        const cached = await cacheService.get<CombinedMatchStats>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for combined stats: ${matchId}`);
            return cached;
        }

        logger.info(`Fetching combined stats for match: ${matchId}`);

        // Fetch from both endpoints in parallel
        const [liveStatsResult, teamStatsResult] = await Promise.allSettled([
            this.matchDetailLiveService.getMatchStatsFromLive(matchId),
            this.matchTeamStatsService.getMatchTeamStats({ match_id: matchId }),
        ]);

        // Process live stats (basic stats)
        let basicStats: CombinedStatItem[] = [];
        let incidents: any[] = [];
        let score: any[] | null = null;
        let isLiveStatsFound = false;

        if (liveStatsResult.status === 'fulfilled' && liveStatsResult.value) {
            const liveData = liveStatsResult.value;
            incidents = liveData.incidents || [];
            score = liveData.score || null;

            if (Array.isArray(liveData.stats) && liveData.stats.length > 0) {
                basicStats = liveData.stats.map((stat: any) => {
                    const typeInfo = STAT_TYPE_MAP[stat.type] || { name: `Unknown (${stat.type})`, nameTr: `Bilinmiyor (${stat.type})` };
                    return {
                        type: stat.type,
                        home: stat.home ?? 0,
                        away: stat.away ?? 0,
                        name: typeInfo.name,
                        nameTr: typeInfo.nameTr,
                        source: 'basic' as const,
                    };
                });
                isLiveStatsFound = true;
            }

            logger.info(`Live stats for ${matchId}: ${basicStats.length} basic stats, ${incidents.length} incidents`);
        } else if (liveStatsResult.status === 'rejected') {
            logger.warn(`Failed to fetch live stats for ${matchId}: ${liveStatsResult.reason}`);
        }

        // Fallback: If no live stats found (e.g. match finished), try historical endpoint
        if (!isLiveStatsFound) {
            logger.info(`No live stats found for ${matchId}, attempting fallback to historical data`);
            try {
                const historyData = await this.client.get<any>('/match/live/history', { match_id: matchId });
                const results = historyData?.results || [];

                if (Array.isArray(results) && results.length > 0) {
                    const matchData = results.find((r: any) => r.id === matchId || r.match_id === matchId) || results[0];
                    // Only overwrite if we don't have them yet
                    if (incidents.length === 0) incidents = matchData?.incidents || [];
                    if (!score) score = matchData?.score || null;

                    const statsArray = matchData?.stats || [];
                    if (Array.isArray(statsArray)) {
                        basicStats = statsArray.map((stat: any) => {
                            const typeInfo = STAT_TYPE_MAP[stat.type] || { name: `Unknown (${stat.type})`, nameTr: `Bilinmiyor (${stat.type})` };
                            return {
                                type: stat.type,
                                home: stat.home ?? 0,
                                away: stat.away ?? 0,
                                name: typeInfo.name,
                                nameTr: typeInfo.nameTr,
                                source: 'basic' as const,
                            };
                        });
                        logger.info(`Fallback successful: found ${basicStats.length} basic stats in history for ${matchId}`);
                    }
                } else {
                    logger.info(`No historical data found for ${matchId}`);
                }
            } catch (error) {
                logger.warn(`Failed to fetch historical fallback for ${matchId}: ${error}`);
            }
        }

        // Process team stats (detailed stats)
        let detailedStats: CombinedStatItem[] = [];

        if (teamStatsResult.status === 'fulfilled' && teamStatsResult.value) {
            const teamData = teamStatsResult.value;
            const results = (teamData as any).results || [];

            logger.info(`Raw team stats results count: ${results.length}`);

            if (Array.isArray(results) && results.length > 0) {
                // Find the specific match data
                const matchData = results.find((r: any) => r.id === matchId || r.match_id === matchId);

                if (matchData) {
                    logger.info(`Found match data for ${matchId}. Keys: ${Object.keys(matchData).join(',')}`);

                    // Scenario 2: 'stats' is an array of team objects (Realtime /match/team_stats/list format)
                    // Check this FIRST because it has a specific structure
                    if (Array.isArray(matchData.stats) && matchData.stats.length === 2 && matchData.stats[0].team_id) {
                        detailedStats = this.transformTeamStats(matchData.stats);
                    }
                    // Scenario 1: 'stats' is an array of objects (Standard API format)
                    // Default fallback if not team stats
                    else if (Array.isArray(matchData.stats)) {
                        detailedStats = matchData.stats.map((stat: any) => {
                            const typeInfo = STAT_TYPE_MAP[stat.type] || { name: `Unknown (${stat.type})`, nameTr: `Bilinmiyor (${stat.type})` };
                            return {
                                type: stat.type,
                                home: stat.home ?? 0,
                                away: stat.away ?? 0,
                                name: typeInfo.name,
                                nameTr: typeInfo.nameTr,
                                source: 'detailed' as const,
                            };
                        });
                    }
                } else {
                    logger.warn(`[STATS_DEBUG] Match data not found in results for ${matchId}`);
                }
            }

            logger.info(`Team stats for ${matchId}: ${detailedStats.length} detailed stats`);
        }
        else if (teamStatsResult.status === 'rejected') {
            logger.warn(`Failed to fetch team stats for ${matchId}: ${teamStatsResult.reason}`);
        }

        // Merge stats: basic stats first, then add any unique detailed stats
        const basicTypeIds = new Set(basicStats.map(s => s.type));
        const uniqueDetailedStats = detailedStats.filter(s => !basicTypeIds.has(s.type));
        const allStats = [...basicStats, ...uniqueDetailedStats];

        // Sort by type for consistent ordering
        allStats.sort((a, b) => a.type - b.type);

        const result: CombinedMatchStats = {
            matchId,
            basicStats,
            detailedStats,
            allStats,
            incidents,
            score,
            lastUpdated: Date.now(),
        };

        // Cache with short TTL (30 seconds for live matches)
        await cacheService.set(cacheKey, result, CacheTTL.TenSeconds * 3);

        return result;
    }

    /**
     * Get historical match statistics (for finished matches)
     * Uses /match/live/history and /match/team_stats/detail endpoints
     */
    async getHistoricalMatchStats(matchId: string): Promise<CombinedMatchStats> {
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:historical_stats:${matchId}`;

        // Check cache first (longer TTL for historical data)
        const cached = await cacheService.get<CombinedMatchStats>(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for historical stats: ${matchId}`);
            return cached;
        }

        logger.info(`Fetching historical stats for match: ${matchId}`);

        // Fetch from both historical endpoints in parallel
        const [historyResult, teamStatsResult] = await Promise.allSettled([
            this.client.get<any>('/match/live/history', { match_id: matchId }),
            this.matchTeamStatsService.getMatchTeamStats({ match_id: matchId }),
        ]);

        // Process history stats (basic stats)
        let basicStats: CombinedStatItem[] = [];
        let incidents: any[] = [];
        let score: any[] | null = null;

        if (historyResult.status === 'fulfilled' && historyResult.value) {
            const historyData = historyResult.value;
            const results = historyData.results || [];

            if (Array.isArray(results) && results.length > 0) {
                const matchData = results.find((r: any) => r.id === matchId || r.match_id === matchId) || results[0];
                incidents = matchData?.incidents || [];
                score = matchData?.score || null;

                const statsArray = matchData?.stats || [];
                if (Array.isArray(statsArray)) {
                    basicStats = statsArray.map((stat: any) => {
                        const typeInfo = STAT_TYPE_MAP[stat.type] || { name: `Unknown (${stat.type})`, nameTr: `Bilinmiyor (${stat.type})` };
                        return {
                            type: stat.type,
                            home: stat.home ?? 0,
                            away: stat.away ?? 0,
                            name: typeInfo.name,
                            nameTr: typeInfo.nameTr,
                            source: 'basic' as const,
                        };
                    });
                }
            }

            logger.info(`Historical stats for ${matchId}: ${basicStats.length} basic stats`);
        } else if (historyResult.status === 'rejected') {
            logger.warn(`Failed to fetch historical stats for ${matchId}: ${historyResult.reason}`);
        }

        // Process team stats (same as live)
        let detailedStats: CombinedStatItem[] = [];

        if (teamStatsResult.status === 'fulfilled' && teamStatsResult.value) {
            const teamData = teamStatsResult.value;
            const results = (teamData as any).results || [];

            if (Array.isArray(results) && results.length > 0) {
                const matchData = results.find((r: any) => r.id === matchId || r.match_id === matchId);
                const statsArray = matchData?.stats || results[0]?.stats || [];

                if (Array.isArray(statsArray)) {
                    detailedStats = statsArray.map((stat: any) => {
                        const typeInfo = STAT_TYPE_MAP[stat.type] || { name: `Unknown (${stat.type})`, nameTr: `Bilinmiyor (${stat.type})` };
                        return {
                            type: stat.type,
                            home: stat.home ?? 0,
                            away: stat.away ?? 0,
                            name: typeInfo.name,
                            nameTr: typeInfo.nameTr,
                            source: 'detailed' as const,
                        };
                    });
                }
            }
        }

        // Merge stats
        const basicTypeIds = new Set(basicStats.map(s => s.type));
        const uniqueDetailedStats = detailedStats.filter(s => !basicTypeIds.has(s.type));
        const allStats = [...basicStats, ...uniqueDetailedStats];
        allStats.sort((a, b) => a.type - b.type);

        const result: CombinedMatchStats = {
            matchId,
            basicStats,
            detailedStats,
            allStats,
            incidents,
            score,
            lastUpdated: Date.now(),
        };

        // Cache with longer TTL (5 minutes for historical)
        await cacheService.set(cacheKey, result, CacheTTL.FiveMinutes);

        return result;
    }

    /**
     * Transform named stats from team_stats/list (realtime) into standard stat objects
     */
    private transformTeamStats(teamsStats: any[]): CombinedStatItem[] {
        const homeTeam = teamsStats[0]; // Assuming first team is home (standard behavior)
        const awayTeam = teamsStats[1]; // Assuming second team is away (standard behavior)
        const result: CombinedStatItem[] = [];

        if (!homeTeam || !awayTeam) return result;

        // Iterate through known fields map
        for (const [field, typeId] of Object.entries(FIELD_TO_ID_MAP)) {
            const homeValue = Number(homeTeam[field]) || 0;
            const awayValue = Number(awayTeam[field]) || 0;

            // Only add if at least one team has non-zero value OR if it's a critical stat
            if (homeValue > 0 || awayValue > 0 || ['passes', 'fouls', 'offsides'].includes(field)) {
                const typeInfo = STAT_TYPE_MAP[typeId] || { name: `Unknown (${typeId})`, nameTr: `Bilinmiyor (${typeId})` };

                result.push({
                    type: typeId,
                    home: homeValue,
                    away: awayValue,
                    name: typeInfo.name,
                    nameTr: typeInfo.nameTr,
                    source: 'detailed' as const
                });
            }
        }

        return result;
    }

    /**
     * Save combined match statistics to database (statistics JSONB column)
     * Stores the full combined stats (basic + detailed + half-time) for later retrieval
     * CRITICAL: This saves stats permanently so they survive after match ends
     */
    async saveCombinedStatsToDatabase(matchId: string, stats: CombinedMatchStats, halfTimeStats?: HalfTimeStats): Promise<void> {
        const client = await pool.connect();
        try {
            // Check if statistics column exists
            const columnCheck = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'ts_matches' 
                AND column_name = 'statistics'
            `);
            
            if (columnCheck.rows.length === 0) {
                logger.warn(`[CombinedStats] statistics column does not exist, skipping save for ${matchId}`);
                return;
            }

            // Get existing statistics first (to preserve half-time data if not provided)
            const existingResult = await client.query(`
                SELECT statistics FROM ts_matches WHERE external_id = $1
            `, [matchId]);
            
            const existingStats = existingResult.rows[0]?.statistics || {};

            // Prepare statistics data to save (merge with existing)
            const statisticsData = {
                match_id: stats.matchId,
                basic_stats: stats.basicStats,
                detailed_stats: stats.detailedStats,
                all_stats: stats.allStats,
                // Preserve or update half-time stats
                half_time_stats: halfTimeStats || stats.halfTimeStats || existingStats.half_time_stats || null,
                incidents: stats.incidents,
                score: stats.score,
                last_updated: stats.lastUpdated,
                saved_at: Date.now(),
            };

            // Update statistics column
            await client.query(`
                UPDATE ts_matches
                SET statistics = $1::jsonb,
                    updated_at = NOW()
                WHERE external_id = $2
            `, [JSON.stringify(statisticsData), matchId]);

            logger.info(`[CombinedStats] Saved combined stats to database for match: ${matchId} (half-time: ${!!statisticsData.half_time_stats})`);
        } catch (error: any) {
            logger.error(`[CombinedStats] Error saving stats to database for ${matchId}:`, error);
            // Don't throw - this is a background operation
        } finally {
            client.release();
        }
    }

    /**
     * Save half-time stats separately (called from half-stats endpoint)
     */
    async saveHalfTimeStatsToDatabase(matchId: string, halfTimeStats: HalfTimeStats): Promise<void> {
        const client = await pool.connect();
        try {
            // Get existing statistics first
            const existingResult = await client.query(`
                SELECT statistics FROM ts_matches WHERE external_id = $1
            `, [matchId]);
            
            const existingStats = existingResult.rows[0]?.statistics || {};

            // Update only half_time_stats field
            const statisticsData = {
                ...existingStats,
                half_time_stats: halfTimeStats,
                last_updated: Date.now(),
                saved_at: Date.now(),
            };

            // Update statistics column
            await client.query(`
                UPDATE ts_matches
                SET statistics = $1::jsonb,
                    updated_at = NOW()
                WHERE external_id = $2
            `, [JSON.stringify(statisticsData), matchId]);

            logger.info(`[CombinedStats] Saved half-time stats to database for match: ${matchId}`);
        } catch (error: any) {
            logger.error(`[CombinedStats] Error saving half-time stats to database for ${matchId}:`, error);
        } finally {
            client.release();
        }
    }

    /**
     * Get combined match statistics from database (statistics JSONB column)
     * Returns null if not found or invalid
     */
    async getCombinedStatsFromDatabase(matchId: string): Promise<CombinedMatchStats | null> {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT statistics
                FROM ts_matches
                WHERE external_id = $1
                  AND statistics IS NOT NULL
            `, [matchId]);

            if (result.rows.length === 0 || !result.rows[0].statistics) {
                return null;
            }

            const statsData = result.rows[0].statistics;

            // Validate structure
            if (!statsData.all_stats || !Array.isArray(statsData.all_stats)) {
                logger.warn(`[CombinedStats] Invalid statistics structure in DB for ${matchId}`);
                return null;
            }

            return {
                matchId: statsData.match_id || matchId,
                basicStats: statsData.basic_stats || [],
                detailedStats: statsData.detailed_stats || [],
                allStats: statsData.all_stats,
                halfTimeStats: statsData.half_time_stats || undefined,
                incidents: statsData.incidents || [],
                score: statsData.score || null,
                lastUpdated: statsData.last_updated || Date.now(),
            };
        } catch (error: any) {
            logger.error(`[CombinedStats] Error reading stats from database for ${matchId}:`, error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Get half-time stats from database
     */
    async getHalfTimeStatsFromDatabase(matchId: string): Promise<HalfTimeStats | null> {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT statistics->'half_time_stats' as half_time_stats
                FROM ts_matches
                WHERE external_id = $1
                  AND statistics->'half_time_stats' IS NOT NULL
            `, [matchId]);

            if (result.rows.length === 0 || !result.rows[0].half_time_stats) {
                return null;
            }

            return result.rows[0].half_time_stats;
        } catch (error: any) {
            logger.error(`[CombinedStats] Error reading half-time stats from database for ${matchId}:`, error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Check if match is finished (status_id = 8)
     */
    async isMatchFinished(matchId: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT status_id FROM ts_matches WHERE external_id = $1
            `, [matchId]);
            
            return result.rows[0]?.status_id === 8;
        } catch (error: any) {
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Save first half stats to database (called when match reaches HALF_TIME status)
     * This is the snapshot of stats at halftime - used to calculate 2nd half stats
     */
    async saveFirstHalfStats(matchId: string, stats: CombinedStatItem[]): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query(`
                UPDATE ts_matches
                SET first_half_stats = $1::jsonb,
                    updated_at = NOW()
                WHERE external_id = $2
            `, [JSON.stringify(stats), matchId]);

            logger.info(`[CombinedStats] ✅ Saved first half stats for match: ${matchId} (${stats.length} stats)`);
        } catch (error: any) {
            logger.error(`[CombinedStats] Error saving first half stats for ${matchId}:`, error);
        } finally {
            client.release();
        }
    }

    /**
     * Get first half stats from database
     */
    async getFirstHalfStats(matchId: string): Promise<CombinedStatItem[] | null> {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT first_half_stats
                FROM ts_matches
                WHERE external_id = $1
                  AND first_half_stats IS NOT NULL
            `, [matchId]);

            if (result.rows.length === 0 || !result.rows[0].first_half_stats) {
                return null;
            }

            return result.rows[0].first_half_stats;
        } catch (error: any) {
            logger.error(`[CombinedStats] Error reading first half stats for ${matchId}:`, error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Check if first half stats already saved
     */
    async hasFirstHalfStats(matchId: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT first_half_stats IS NOT NULL as has_stats
                FROM ts_matches
                WHERE external_id = $1
            `, [matchId]);

            return result.rows[0]?.has_stats === true;
        } catch (error: any) {
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Get second half stats from database
     * Returns the statistics_second_half column if it exists
     */
    async getSecondHalfStats(matchId: string): Promise<CombinedStatItem[] | null> {
        const client = await pool.connect();
        try {
            // Check if column exists
            const colCheck = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'ts_matches'
                  AND column_name = 'statistics_second_half'
            `);

            if (colCheck.rows.length === 0) {
                // Column doesn't exist yet
                return null;
            }

            const result = await client.query(`
                SELECT statistics_second_half
                FROM ts_matches
                WHERE external_id = $1
                  AND statistics_second_half IS NOT NULL
            `, [matchId]);

            if (result.rows.length === 0 || !result.rows[0].statistics_second_half) {
                return null;
            }

            return result.rows[0].statistics_second_half;
        } catch (error: any) {
            logger.error(`[CombinedStats] Error reading second half stats for ${matchId}:`, error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Get match status from database
     */
    async getMatchStatus(matchId: string): Promise<number | null> {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT status_id FROM ts_matches WHERE external_id = $1
            `, [matchId]);
            
            return result.rows[0]?.status_id ?? null;
        } catch (error: any) {
            return null;
        } finally {
            client.release();
        }
    }
}
