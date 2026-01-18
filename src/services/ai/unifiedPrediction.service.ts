
/**
 * Unified Prediction Service
 * 
 * Single source of truth for all prediction data.
 * Serves: /admin/predictions, /ai-predictions, /admin/bots, /admin/bots/[botName]
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { getMatchesDetailLive, calculateMatchMinute } from './aiPredictionsLiveData.service';

export interface PredictionFilter {
    status?: 'all' | 'pending' | 'matched' | 'won' | 'lost';
    bot?: string;
    date?: string; // YYYY-MM-DD
    access?: 'all' | 'vip' | 'free';
    page?: number;
    limit?: number;
}

export interface UnifiedPrediction {
    id: string;
    external_id: string;
    canonical_bot_name: string;
    league_name: string;
    home_team_name: string;
    away_team_name: string;
    home_team_logo: string | null;
    away_team_logo: string | null;
    score_at_prediction: string;
    minute_at_prediction: number;
    // Phase 2: New prediction columns
    prediction: string;               // "IY 0.5 ÜST", "MS 2.5 ÜST"
    prediction_threshold: number;     // 0.5, 1.5, 2.5
    match_id: string | null;
    match_time: number | null;
    match_status: number;
    result: 'pending' | 'won' | 'lost' | 'cancelled';
    final_score: string | null;
    result_reason: string | null;     // "instant_win_iy", "halftime_settlement"
    source: string;                   // "external", "manual"
    access_type: 'VIP' | 'FREE';
    created_at: string;
    resulted_at: string | null;
    // Live fields joined from ts_matches
    home_score_display?: number;
    away_score_display?: number;
    live_match_status?: number;
    live_match_minute?: number;
    // Enhanced Data from Joins
    country_name?: string;
    country_logo?: string;
    competition_logo?: string;
}


export interface PredictionStats {
    total: number;
    pending: number;
    matched: number;
    won: number;
    lost: number;
    winRate: string;
}

export interface BotStat {
    name: string;
    displayName: string;
    total: number;
    pending: number;
    won: number;
    lost: number;
    winRate: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface UnifiedPredictionResponse {
    predictions: UnifiedPrediction[];
    stats: PredictionStats;
    bots: BotStat[];
    pagination: Pagination;
}

class UnifiedPredictionService {

    /**
     * Get predictions with unified filtering
     */
    async getPredictions(filter: PredictionFilter = {}): Promise<UnifiedPredictionResponse> {
        const {
            status = 'all',
            bot,
            date,
            access = 'all',
            page = 1,
            limit = 50
        } = filter;

        const offset = (page - 1) * limit;

        // Build WHERE clause
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        // Status filter
        if (status === 'pending') {
            conditions.push(`result = 'pending'`);
        } else if (status === 'matched') {
            conditions.push(`match_id IS NOT NULL`);
        } else if (status === 'won') {
            conditions.push(`result = 'won'`);
        } else if (status === 'lost') {
            conditions.push(`result = 'lost'`);
        }

        // Bot filter
        if (bot) {
            conditions.push(`canonical_bot_name ILIKE $${paramIndex}`);
            params.push(`%${bot}%`);
            paramIndex++;
        }

        // Date filter
        if (date) {
            conditions.push(`DATE(created_at) = $${paramIndex}`);
            params.push(date);
            paramIndex++;
        }

        // Access filter
        if (access === 'vip') {
            conditions.push(`access_type = 'VIP'`);
        } else if (access === 'free') {
            conditions.push(`access_type = 'FREE'`);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Main query - NO TheSports data (isolated from ts_matches)
        // Only use ai_predictions table - static prediction data only
        const query = `
      SELECT
        p.id, p.external_id, p.canonical_bot_name,
        p.league_name, p.home_team_name, p.away_team_name,
        p.home_team_logo, p.away_team_logo,
        p.score_at_prediction, p.minute_at_prediction,
        p.prediction, p.prediction_threshold,
        p.match_id, p.match_time, p.match_status,
        p.access_type, p.created_at, p.resulted_at,
        p.result, p.final_score, p.result_reason, p.source,
        -- Static score from prediction time (will be overwritten by live data if available)
        COALESCE(NULLIF(SPLIT_PART(p.score_at_prediction, '-', 1), '')::INTEGER, 0) as home_score_display,
        COALESCE(NULLIF(SPLIT_PART(p.score_at_prediction, '-', 2), '')::INTEGER, 0) as away_score_display
      FROM ai_predictions p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        params.push(limit, offset);

        // Count query
        const countQuery = `SELECT COUNT(*) as total FROM ai_predictions p ${whereClause}`;
        const countParams = params.slice(0, -2); // Remove limit and offset

        // Stats query (global, not filtered)
        const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN match_id IS NOT NULL THEN 1 END) as matched,
        COUNT(CASE WHEN result = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN result = 'lost' THEN 1 END) as lost
      FROM ai_predictions
    `;

        // Bot stats query
        const botStatsQuery = `
      SELECT 
        canonical_bot_name as name,
        COUNT(*) as total,
        COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN result = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN result = 'lost' THEN 1 END) as lost
      FROM ai_predictions
      WHERE canonical_bot_name IS NOT NULL
      GROUP BY canonical_bot_name
      ORDER BY total DESC
    `;

        try {
            const [predictionsResult, countResult, statsResult, botStatsResult] = await Promise.all([
                pool.query(query, params),
                pool.query(countQuery, countParams),
                pool.query(statsQuery),
                pool.query(botStatsQuery)
            ]);

            const total = parseInt(countResult.rows[0]?.total || '0');
            const statsRow = statsResult.rows[0];

            const stats: PredictionStats = {
                total: parseInt(statsRow?.total || '0'),
                pending: parseInt(statsRow?.pending || '0'),
                matched: parseInt(statsRow?.matched || '0'),
                won: parseInt(statsRow?.won || '0'),
                lost: parseInt(statsRow?.lost || '0'),
                winRate: this.calculateWinRate(
                    parseInt(statsRow?.won || '0'),
                    parseInt(statsRow?.lost || '0')
                )
            };

            const bots: BotStat[] = botStatsResult.rows.map(row => ({
                name: row.name,
                displayName: row.name,
                total: parseInt(row.total || '0'),
                pending: parseInt(row.pending || '0'),
                won: parseInt(row.won || '0'),
                lost: parseInt(row.lost || '0'),
                winRate: this.calculateWinRate(
                    parseInt(row.won || '0'),
                    parseInt(row.lost || '0')
                )
            }));

            // Fetch live data from TheSports API detail_live (30s cache, 5s timeout)
            // CRITICAL: Non-blocking - if API fails, predictions continue with static data
            // OPTIMIZATION: Only fetch if we have pending predictions (max 50 to prevent overload)
            // SKIP: If no pending predictions, skip entirely to speed up response
            const predictions = predictionsResult.rows;

            // OPTIMIZATION: Skip live data fetch if no pending predictions
            const pendingPredictions = predictions.filter((p: any) => p.result === 'pending');

            if (pendingPredictions.length === 0) {
                logger.debug('[UnifiedPredictionService] No pending predictions, skipping live data fetch');
                return {
                    predictions,
                    stats,
                    bots,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                };
            }

            const matchIds = pendingPredictions
                .filter((p: any) => p.match_id) // Only those with match_id
                .map((p: any) => p.match_id)
                .slice(0, 50); // Limit to prevent API overload

            if (matchIds.length > 0) {
                try {
                    const liveMatches = await getMatchesDetailLive(matchIds);

                    // Merge live data into predictions
                    let mergedCount = 0;
                    for (const prediction of predictions) {
                        const liveMatch = liveMatches.get(prediction.match_id);
                        if (liveMatch) {
                            // Calculate minute using kickoff timestamps
                            const calculatedMinute = calculateMatchMinute(
                                liveMatch.status_id,
                                liveMatch.first_half_kickoff_ts,
                                liveMatch.second_half_kickoff_ts
                            );

                            // Update with live data
                            prediction.home_score_display = liveMatch.home_score_display;
                            prediction.away_score_display = liveMatch.away_score_display;
                            prediction.live_match_status = liveMatch.status_id;
                            prediction.live_match_minute = calculatedMinute ?? liveMatch.minute;

                            mergedCount++;
                        }
                    }

                    if (mergedCount > 0) {
                        logger.info(`[UnifiedPredictionService] Successfully merged live data for ${mergedCount} predictions`);
                    }
                } catch (error) {
                    // Fallback to static data if live fetch fails
                    logger.warn('[UnifiedPredictionService] Live data fetch failed, using static data:', error);
                }
            }

            return {
                predictions,
                stats,
                bots,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('[UnifiedPredictionService] getPredictions error:', error);
            throw error;
        }
    }

    /**
     * Get bot detail with predictions
     */
    async getBotDetail(botName: string, page: number = 1, limit: number = 50): Promise<{
        bot: BotStat;
        predictions: UnifiedPrediction[];
        pagination: Pagination;
    }> {
        return this.getPredictions({ bot: botName, page, limit }).then(result => {
            const bot = result.bots.find(b =>
                b.name.toLowerCase().includes(botName.toLowerCase())
            ) || {
                name: botName,
                displayName: botName,
                total: result.pagination.total,
                pending: 0,
                won: 0,
                lost: 0,
                winRate: 'N/A'
            };

            return {
                bot,
                predictions: result.predictions,
                pagination: result.pagination
            };
        });
    }

    /**
     * Calculate win rate
     */
    private calculateWinRate(won: number, lost: number): string {
        const total = won + lost;
        if (total === 0) return 'N/A';
        return ((won / total) * 100).toFixed(1) + '%';
    }

    /**
     * Update prediction result (called when match ends)
     */
    async updatePredictionResult(
        predictionId: string,
        result: 'won' | 'lost' | 'cancelled',
        finalScore?: string
    ): Promise<void> {
        try {
            await pool.query(`
        UPDATE ai_predictions
        SET 
          result = $1,
          final_score = $2,
          resulted_at = NOW(),
          processed = true
        WHERE id = $3
      `, [result, finalScore, predictionId]);

            logger.info(`[UnifiedPredictionService] Updated prediction ${predictionId} to ${result}`);
        } catch (error) {
            logger.error('[UnifiedPredictionService] updatePredictionResult error:', error);
            throw error;
        }
    }

    /**
     * Match prediction to a match
     */
    async matchPrediction(
        predictionId: string,
        matchId: string,
        matchUuid: string | null,
        confidence: number,
        homeTeamId?: string,
        awayTeamId?: string
    ): Promise<void> {
        try {
            // Get match details for enrichment
            const matchResult = await pool.query(`
        SELECT m.match_time, m.status_id,
               th.logo_url as home_logo, ta.logo_url as away_logo
        FROM ts_matches m
        LEFT JOIN ts_teams th ON m.home_team_id = th.external_id
        LEFT JOIN ts_teams ta ON m.away_team_id = ta.external_id
        WHERE m.external_id = $1
      `, [matchId]);

            const match = matchResult.rows[0];

            await pool.query(`
        UPDATE ai_predictions
        SET 
          match_id = $1,
          match_uuid = $2,
          confidence = $3,
          home_team_id = $4,
          away_team_id = $5,
          match_time = $6,
          match_status = $7,
          home_team_logo = $8,
          away_team_logo = $9
        WHERE id = $10
      `, [
                matchId,
                matchUuid,
                confidence,
                homeTeamId,
                awayTeamId,
                match?.match_time || null,
                match?.status_id || 1,
                match?.home_logo || null,
                match?.away_logo || null,
                predictionId
            ]);

            logger.info(`[UnifiedPredictionService] Matched prediction ${predictionId} to match ${matchId}`);
        } catch (error) {
            logger.error('[UnifiedPredictionService] matchPrediction error:', error);
            throw error;
        }
    }

    /**
     * Process real-time match event to result predictions
     *
     * Phase 2: This method is now DEPRECATED - use predictionSettlementService instead
     * The settlement service handles period-aware logic (IY vs MS) properly.
     */
    async processMatchEvent(event: any): Promise<void> {
        // DEPRECATED: Settlement is now handled by predictionSettlementService
        // This method is kept for backward compatibility but logs a warning
        logger.warn('[UnifiedPredictionService] processMatchEvent is DEPRECATED - use predictionSettlementService');

        const { type, matchId, statusId } = event;
        if (!matchId) return;

        // Only log for monitoring - actual settlement handled elsewhere
        if (type === 'MATCH_STATE_CHANGE' && statusId === 8) {
            logger.debug(`[UnifiedPredictionService] Match ${matchId} ended - settlement handled by predictionSettlementService`);
        }
    }

    /**
     * Check prediction win - Phase 2: Uses prediction_threshold column directly
     */
    private checkPredictionWin(prediction: string, threshold: number, totalGoals: number): boolean {
        // Simple threshold check - if prediction contains "ÜST" (over)
        if (prediction.toUpperCase().includes('ÜST') || prediction.toLowerCase().includes('over')) {
            return totalGoals > threshold;
        }
        // For "ALT" (under)
        if (prediction.toUpperCase().includes('ALT') || prediction.toLowerCase().includes('under')) {
            return totalGoals < threshold;
        }
        // Default to threshold comparison
        return totalGoals > threshold;
    }
}

export const unifiedPredictionService = new UnifiedPredictionService();
