/**
 * Match Stats Repository
 *
 * Database operations for ts_match_stats table.
 * Provides upsert functionality for match statistics.
 *
 * Used by:
 * - DataSync workers (background save)
 * - Controllers (read for API response)
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export interface MatchStats {
    match_id: string;
    // Live stats (from detail_live)
    home_corner?: number;
    away_corner?: number;
    home_yellow_cards?: number;
    away_yellow_cards?: number;
    home_red_cards?: number;
    away_red_cards?: number;
    home_shots?: number;
    away_shots?: number;
    home_shots_on_target?: number;
    away_shots_on_target?: number;
    home_possession?: number;
    away_possession?: number;
    home_dangerous_attacks?: number;
    away_dangerous_attacks?: number;
    home_attacks?: number;
    away_attacks?: number;
    // Team stats (from team_stats)
    home_passes?: number;
    away_passes?: number;
    home_accurate_passes?: number;
    away_accurate_passes?: number;
    home_tackles?: number;
    away_tackles?: number;
    home_interceptions?: number;
    away_interceptions?: number;
    home_fouls?: number;
    away_fouls?: number;
    home_offsides?: number;
    away_offsides?: number;
    home_saves?: number;
    away_saves?: number;
    // Half-time stats
    first_half_stats?: Record<string, any>;
    second_half_stats?: Record<string, any>;
}

export class MatchStatsRepository {
    /**
     * Upsert match stats to database
     * Uses ON CONFLICT to update if exists
     */
    async upsertStats(stats: MatchStats): Promise<boolean> {
        const client = await pool.connect();
        try {
            const query = `
        INSERT INTO ts_match_stats (
          match_id,
          home_corner, away_corner,
          home_yellow_cards, away_yellow_cards,
          home_red_cards, away_red_cards,
          home_shots, away_shots,
          home_shots_on_target, away_shots_on_target,
          home_possession, away_possession,
          home_dangerous_attacks, away_dangerous_attacks,
          home_attacks, away_attacks,
          home_passes, away_passes,
          home_accurate_passes, away_accurate_passes,
          home_tackles, away_tackles,
          home_interceptions, away_interceptions,
          home_fouls, away_fouls,
          home_offsides, away_offsides,
          home_saves, away_saves,
          first_half_stats, second_half_stats,
          last_updated_at
        ) VALUES (
          $1,
          COALESCE($2, 0), COALESCE($3, 0),
          COALESCE($4, 0), COALESCE($5, 0),
          COALESCE($6, 0), COALESCE($7, 0),
          COALESCE($8, 0), COALESCE($9, 0),
          COALESCE($10, 0), COALESCE($11, 0),
          COALESCE($12, 50), COALESCE($13, 50),
          COALESCE($14, 0), COALESCE($15, 0),
          COALESCE($16, 0), COALESCE($17, 0),
          COALESCE($18, 0), COALESCE($19, 0),
          COALESCE($20, 0), COALESCE($21, 0),
          COALESCE($22, 0), COALESCE($23, 0),
          COALESCE($24, 0), COALESCE($25, 0),
          COALESCE($26, 0), COALESCE($27, 0),
          COALESCE($28, 0), COALESCE($29, 0),
          COALESCE($30, 0), COALESCE($31, 0),
          $32::jsonb, $33::jsonb,
          NOW()
        )
        ON CONFLICT (match_id) DO UPDATE SET
          home_corner = COALESCE(EXCLUDED.home_corner, ts_match_stats.home_corner),
          away_corner = COALESCE(EXCLUDED.away_corner, ts_match_stats.away_corner),
          home_yellow_cards = COALESCE(EXCLUDED.home_yellow_cards, ts_match_stats.home_yellow_cards),
          away_yellow_cards = COALESCE(EXCLUDED.away_yellow_cards, ts_match_stats.away_yellow_cards),
          home_red_cards = COALESCE(EXCLUDED.home_red_cards, ts_match_stats.home_red_cards),
          away_red_cards = COALESCE(EXCLUDED.away_red_cards, ts_match_stats.away_red_cards),
          home_shots = COALESCE(EXCLUDED.home_shots, ts_match_stats.home_shots),
          away_shots = COALESCE(EXCLUDED.away_shots, ts_match_stats.away_shots),
          home_shots_on_target = COALESCE(EXCLUDED.home_shots_on_target, ts_match_stats.home_shots_on_target),
          away_shots_on_target = COALESCE(EXCLUDED.away_shots_on_target, ts_match_stats.away_shots_on_target),
          home_possession = COALESCE(EXCLUDED.home_possession, ts_match_stats.home_possession),
          away_possession = COALESCE(EXCLUDED.away_possession, ts_match_stats.away_possession),
          home_dangerous_attacks = COALESCE(EXCLUDED.home_dangerous_attacks, ts_match_stats.home_dangerous_attacks),
          away_dangerous_attacks = COALESCE(EXCLUDED.away_dangerous_attacks, ts_match_stats.away_dangerous_attacks),
          home_attacks = COALESCE(EXCLUDED.home_attacks, ts_match_stats.home_attacks),
          away_attacks = COALESCE(EXCLUDED.away_attacks, ts_match_stats.away_attacks),
          home_passes = COALESCE(EXCLUDED.home_passes, ts_match_stats.home_passes),
          away_passes = COALESCE(EXCLUDED.away_passes, ts_match_stats.away_passes),
          home_accurate_passes = COALESCE(EXCLUDED.home_accurate_passes, ts_match_stats.home_accurate_passes),
          away_accurate_passes = COALESCE(EXCLUDED.away_accurate_passes, ts_match_stats.away_accurate_passes),
          home_tackles = COALESCE(EXCLUDED.home_tackles, ts_match_stats.home_tackles),
          away_tackles = COALESCE(EXCLUDED.away_tackles, ts_match_stats.away_tackles),
          home_interceptions = COALESCE(EXCLUDED.home_interceptions, ts_match_stats.home_interceptions),
          away_interceptions = COALESCE(EXCLUDED.away_interceptions, ts_match_stats.away_interceptions),
          home_fouls = COALESCE(EXCLUDED.home_fouls, ts_match_stats.home_fouls),
          away_fouls = COALESCE(EXCLUDED.away_fouls, ts_match_stats.away_fouls),
          home_offsides = COALESCE(EXCLUDED.home_offsides, ts_match_stats.home_offsides),
          away_offsides = COALESCE(EXCLUDED.away_offsides, ts_match_stats.away_offsides),
          home_saves = COALESCE(EXCLUDED.home_saves, ts_match_stats.home_saves),
          away_saves = COALESCE(EXCLUDED.away_saves, ts_match_stats.away_saves),
          first_half_stats = COALESCE(EXCLUDED.first_half_stats, ts_match_stats.first_half_stats),
          second_half_stats = COALESCE(EXCLUDED.second_half_stats, ts_match_stats.second_half_stats),
          last_updated_at = NOW()
      `;

            const values = [
                stats.match_id,
                stats.home_corner, stats.away_corner,
                stats.home_yellow_cards, stats.away_yellow_cards,
                stats.home_red_cards, stats.away_red_cards,
                stats.home_shots, stats.away_shots,
                stats.home_shots_on_target, stats.away_shots_on_target,
                stats.home_possession, stats.away_possession,
                stats.home_dangerous_attacks, stats.away_dangerous_attacks,
                stats.home_attacks, stats.away_attacks,
                stats.home_passes, stats.away_passes,
                stats.home_accurate_passes, stats.away_accurate_passes,
                stats.home_tackles, stats.away_tackles,
                stats.home_interceptions, stats.away_interceptions,
                stats.home_fouls, stats.away_fouls,
                stats.home_offsides, stats.away_offsides,
                stats.home_saves, stats.away_saves,
                stats.first_half_stats ? JSON.stringify(stats.first_half_stats) : null,
                stats.second_half_stats ? JSON.stringify(stats.second_half_stats) : null,
            ];

            await client.query(query, values);
            logger.debug(`[MatchStatsRepo] Upserted stats for match ${stats.match_id}`);
            return true;
        } catch (error: any) {
            logger.error(`[MatchStatsRepo] Error upserting stats for ${stats.match_id}:`, error.message);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Get match stats from database
     */
    async getStats(matchId: string): Promise<MatchStats | null> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM ts_match_stats WHERE match_id = $1',
                [matchId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0] as MatchStats;
        } catch (error: any) {
            logger.error(`[MatchStatsRepo] Error getting stats for ${matchId}:`, error.message);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Parse stats from detail_live API response
     * Extracts stats array and converts to MatchStats object
     */
    parseStatsFromDetailLive(matchData: any): Partial<MatchStats> {
        const stats: Partial<MatchStats> = {};

        // Parse stats array: [[home_vals...], [away_vals...]]
        // Index mapping from TheSports API:
        // 0: Corner, 1: Yellow Card, 2: Red Card, 3: Shots Total
        // 4: Shots On Target, 5: Attacks, 6: Dangerous Attacks,
        // 7: Possession, 8: Passes, 9: Accurate Passes, 10: Fouls, 11: Offsides
        if (Array.isArray(matchData.stats) && matchData.stats.length >= 2) {
            const homeStats = matchData.stats[0] || [];
            const awayStats = matchData.stats[1] || [];

            stats.home_corner = homeStats[0] ?? undefined;
            stats.away_corner = awayStats[0] ?? undefined;
            stats.home_yellow_cards = homeStats[1] ?? undefined;
            stats.away_yellow_cards = awayStats[1] ?? undefined;
            stats.home_red_cards = homeStats[2] ?? undefined;
            stats.away_red_cards = awayStats[2] ?? undefined;
            stats.home_shots = homeStats[3] ?? undefined;
            stats.away_shots = awayStats[3] ?? undefined;
            stats.home_shots_on_target = homeStats[4] ?? undefined;
            stats.away_shots_on_target = awayStats[4] ?? undefined;
            stats.home_attacks = homeStats[5] ?? undefined;
            stats.away_attacks = awayStats[5] ?? undefined;
            stats.home_dangerous_attacks = homeStats[6] ?? undefined;
            stats.away_dangerous_attacks = awayStats[6] ?? undefined;
            stats.home_possession = homeStats[7] ?? undefined;
            stats.away_possession = awayStats[7] ?? undefined;
        }

        return stats;
    }
}

// Singleton export
export const matchStatsRepository = new MatchStatsRepository();
