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
    36: { name: 'Clearances', nameTr: 'Uzaklaştırma' },
    38: { name: 'Interceptions', nameTr: 'Top Çalma' },
    39: { name: 'Tackles', nameTr: 'Müdahale' },
    40: { name: 'Total Passes', nameTr: 'Toplam Pas' },
    41: { name: 'Accurate Passes', nameTr: 'İsabetli Pas' },
    42: { name: 'Key Passes', nameTr: 'Kilit Pas' },
    43: { name: 'Crosses', nameTr: 'Orta' },
    44: { name: 'Accurate Crosses', nameTr: 'İsabetli Orta' },
    45: { name: 'Long Balls', nameTr: 'Uzun Pas' },
    46: { name: 'Accurate Long Balls', nameTr: 'İsabetli Uzun Pas' },
    51: { name: 'Fouls', nameTr: 'Faul' },
    52: { name: 'Saves', nameTr: 'Kurtarış' },
    69: { name: 'Hit Woodwork', nameTr: 'Direkten Dönen' },
    83: { name: 'Total Shots', nameTr: 'Toplam Şut' }
};

export interface CombinedStatItem {
    type: number;
    home: number;
    away: number;
    name: string;
    nameTr: string;
    source: 'basic' | 'detailed';
}

export interface CombinedMatchStats {
    matchId: string;
    basicStats: CombinedStatItem[];
    detailedStats: CombinedStatItem[];
    allStats: CombinedStatItem[];
    incidents: any[];
    score: any[] | null;
    lastUpdated: number;
}

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

        if (liveStatsResult.status === 'fulfilled' && liveStatsResult.value) {
            const liveData = liveStatsResult.value;
            incidents = liveData.incidents || [];
            score = liveData.score || null;

            if (Array.isArray(liveData.stats)) {
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
            }

            logger.info(`Live stats for ${matchId}: ${basicStats.length} basic stats, ${incidents.length} incidents`);
        } else if (liveStatsResult.status === 'rejected') {
            logger.warn(`Failed to fetch live stats for ${matchId}: ${liveStatsResult.reason}`);
        }

        // Process team stats (detailed stats)
        let detailedStats: CombinedStatItem[] = [];

        if (teamStatsResult.status === 'fulfilled' && teamStatsResult.value) {
            const teamData = teamStatsResult.value;
            const results = (teamData as any).results || [];

            if (Array.isArray(results) && results.length > 0) {
                // Find the specific match data
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

            logger.info(`Team stats for ${matchId}: ${detailedStats.length} detailed stats`);
        } else if (teamStatsResult.status === 'rejected') {
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

        logger.info(`Combined stats for ${matchId}: ${allStats.length} total stats (${basicStats.length} basic + ${uniqueDetailedStats.length} unique detailed)`);

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
}
