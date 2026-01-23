"use strict";
/**
 * Match Detail Sync Service
 *
 * Syncs match detail data to dedicated tables for Match Detail page.
 * Part of Database-First architecture for 10-100x faster responses.
 *
 * Tables synced:
 * - ts_match_stats: Real-time statistics
 * - ts_match_incidents: Goals, cards, substitutions
 * - ts_match_lineups: Starting XI and subs
 * - ts_match_trend: Minute-by-minute data
 * - ts_h2h_cache: Head-to-head cache
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchDetailSyncService = exports.MatchDetailSyncService = void 0;
const connection_1 = require("../../../database/connection");
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
// TheSports stat type mapping
const STAT_TYPE_MAP = {
    2: 'corners',
    3: 'yellow_cards',
    4: 'red_cards',
    5: 'free_kicks',
    6: 'goal_kicks',
    7: 'throw_ins',
    8: 'offsides',
    9: 'fouls',
    10: 'saves',
    21: 'shots_on_target',
    22: 'shots_off_target',
    23: 'attacks',
    24: 'dangerous_attacks',
    25: 'possession',
    26: 'passes',
    27: 'pass_accuracy',
    28: 'crosses',
    29: 'interceptions',
    30: 'tackles',
    37: 'blocked_shots',
};
// TheSports incident type mapping
const INCIDENT_TYPE_MAP = {
    1: 'goal',
    2: 'penalty_goal',
    3: 'own_goal',
    4: 'penalty_miss',
    5: 'yellow_card',
    6: 'red_card',
    7: 'substitution',
    8: 'second_yellow',
    9: 'var',
    10: 'penalty_awarded',
};
class MatchDetailSyncService {
    /**
     * Sync all match detail data for a specific match
     * Called every 30 seconds for live matches
     */
    async syncMatchDetail(matchId) {
        const result = { stats: 0, incidents: 0, lineups: 0, trend: 0 };
        try {
            // Fetch detail_live from TheSports API
            const detailLive = await TheSportsAPIManager_1.theSportsAPI.get('/match/detail_live', {
                match_id: matchId,
            });
            if (!detailLive?.results) {
                logger_1.logger.warn(`[MatchDetailSync] No detail_live data for ${matchId}`);
                return result;
            }
            // Find match data in results
            const matchData = Array.isArray(detailLive.results)
                ? detailLive.results.find((m) => String(m?.id) === String(matchId)) || detailLive.results[0]
                : detailLive.results;
            if (!matchData) {
                logger_1.logger.warn(`[MatchDetailSync] Match ${matchId} not found in detail_live results`);
                return result;
            }
            // Sync stats
            if (matchData.stats && Array.isArray(matchData.stats)) {
                result.stats = await this.syncStats(matchId, matchData.stats);
            }
            // Sync incidents
            if (matchData.incidents && Array.isArray(matchData.incidents)) {
                result.incidents = await this.syncIncidents(matchId, matchData.incidents);
            }
            logger_1.logger.debug(`[MatchDetailSync] Synced match ${matchId}: ${result.stats} stats, ${result.incidents} incidents`);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`[MatchDetailSync] Error syncing match ${matchId}:`, error);
            return result;
        }
    }
    /**
     * Sync stats to ts_match_stats table
     */
    async syncStats(matchId, stats) {
        if (!stats || stats.length === 0)
            return 0;
        const client = await connection_1.pool.connect();
        try {
            let synced = 0;
            for (const stat of stats) {
                const statType = STAT_TYPE_MAP[stat.type] || `type_${stat.type}`;
                const homeValue = stat.home ?? null;
                const awayValue = stat.away ?? null;
                await client.query(`
          INSERT INTO ts_match_stats (match_id, stat_type, home_value, away_value, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (match_id, stat_type, COALESCE(minute, -1))
          DO UPDATE SET
            home_value = EXCLUDED.home_value,
            away_value = EXCLUDED.away_value,
            updated_at = NOW()
        `, [matchId, statType, homeValue, awayValue]);
                synced++;
            }
            return synced;
        }
        catch (error) {
            logger_1.logger.error(`[MatchDetailSync] Error syncing stats for ${matchId}:`, error);
            return 0;
        }
        finally {
            client.release();
        }
    }
    /**
     * Sync incidents to ts_match_incidents table
     */
    async syncIncidents(matchId, incidents) {
        if (!incidents || incidents.length === 0)
            return 0;
        const client = await connection_1.pool.connect();
        try {
            let synced = 0;
            for (const incident of incidents) {
                const incidentType = INCIDENT_TYPE_MAP[incident.type] || `type_${incident.type}`;
                const minute = incident.time ?? incident.minute ?? 0;
                const addedTime = incident.added_time ?? null;
                const team = incident.position === 1 ? 'home' : 'away';
                // Parse player info based on incident type
                let playerId = incident.player_id ?? null;
                let playerName = incident.player_name ?? null;
                let assistPlayerId = incident.assist_id ?? null;
                let assistPlayerName = incident.assist_name ?? null;
                let inPlayerId = null;
                let inPlayerName = null;
                let outPlayerId = null;
                let outPlayerName = null;
                let reason = incident.reason ?? null;
                // For substitutions, parse in/out players
                if (incidentType === 'substitution') {
                    inPlayerId = incident.in_player_id ?? incident.player_id ?? null;
                    inPlayerName = incident.in_player_name ?? incident.player_name ?? null;
                    outPlayerId = incident.out_player_id ?? null;
                    outPlayerName = incident.out_player_name ?? null;
                    playerId = null;
                    playerName = null;
                }
                await client.query(`
          INSERT INTO ts_match_incidents (
            match_id, incident_type, minute, added_time, team,
            player_id, player_name, assist_player_id, assist_player_name,
            in_player_id, in_player_name, out_player_id, out_player_name,
            reason, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (match_id, incident_type, minute, COALESCE(player_id, ''), COALESCE(added_time, 0))
          DO UPDATE SET
            player_name = COALESCE(EXCLUDED.player_name, ts_match_incidents.player_name),
            assist_player_name = COALESCE(EXCLUDED.assist_player_name, ts_match_incidents.assist_player_name),
            reason = COALESCE(EXCLUDED.reason, ts_match_incidents.reason)
        `, [
                    matchId, incidentType, minute, addedTime, team,
                    playerId, playerName, assistPlayerId, assistPlayerName,
                    inPlayerId, inPlayerName, outPlayerId, outPlayerName,
                    reason
                ]);
                synced++;
            }
            return synced;
        }
        catch (error) {
            logger_1.logger.error(`[MatchDetailSync] Error syncing incidents for ${matchId}:`, error);
            return 0;
        }
        finally {
            client.release();
        }
    }
    /**
     * Sync lineup to ts_match_lineups table
     */
    async syncLineups(matchId) {
        try {
            const lineupData = await TheSportsAPIManager_1.theSportsAPI.get('/match/lineup', {
                match_id: matchId,
            });
            if (!lineupData?.results) {
                logger_1.logger.debug(`[MatchDetailSync] No lineup data for ${matchId}`);
                return 0;
            }
            const results = lineupData.results;
            const client = await connection_1.pool.connect();
            let synced = 0;
            try {
                // Sync home lineup
                if (results.home && Array.isArray(results.home)) {
                    for (const player of results.home) {
                        await this.upsertLineupPlayer(client, matchId, 'home', player, results.home_formation, true);
                        synced++;
                    }
                }
                // Sync away lineup
                if (results.away && Array.isArray(results.away)) {
                    for (const player of results.away) {
                        await this.upsertLineupPlayer(client, matchId, 'away', player, results.away_formation, true);
                        synced++;
                    }
                }
                // Sync home subs
                if (results.home_subs && Array.isArray(results.home_subs)) {
                    for (const player of results.home_subs) {
                        await this.upsertLineupPlayer(client, matchId, 'home', player, results.home_formation, false);
                        synced++;
                    }
                }
                // Sync away subs
                if (results.away_subs && Array.isArray(results.away_subs)) {
                    for (const player of results.away_subs) {
                        await this.upsertLineupPlayer(client, matchId, 'away', player, results.away_formation, false);
                        synced++;
                    }
                }
                return synced;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            logger_1.logger.error(`[MatchDetailSync] Error syncing lineups for ${matchId}:`, error);
            return 0;
        }
    }
    async upsertLineupPlayer(client, matchId, team, player, formation, isStarter) {
        const playerId = player.id ?? player.player_id ?? null;
        if (!playerId)
            return;
        await client.query(`
      INSERT INTO ts_match_lineups (
        match_id, team, formation, player_id, player_name,
        shirt_number, position, is_starter, x_position, y_position,
        rating, is_captain, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (match_id, team, player_id)
      DO UPDATE SET
        formation = COALESCE(EXCLUDED.formation, ts_match_lineups.formation),
        player_name = COALESCE(EXCLUDED.player_name, ts_match_lineups.player_name),
        shirt_number = COALESCE(EXCLUDED.shirt_number, ts_match_lineups.shirt_number),
        position = COALESCE(EXCLUDED.position, ts_match_lineups.position),
        x_position = COALESCE(EXCLUDED.x_position, ts_match_lineups.x_position),
        y_position = COALESCE(EXCLUDED.y_position, ts_match_lineups.y_position),
        rating = COALESCE(EXCLUDED.rating, ts_match_lineups.rating),
        is_captain = COALESCE(EXCLUDED.is_captain, ts_match_lineups.is_captain),
        updated_at = NOW()
    `, [
            matchId, team, formation,
            playerId,
            player.name ?? player.player_name ?? null,
            player.shirt_number ?? player.number ?? null,
            player.position ?? null,
            isStarter,
            player.x ?? null,
            player.y ?? null,
            player.rating ?? null,
            player.captain ?? false
        ]);
    }
    /**
     * Sync trend data to ts_match_trend table
     */
    async syncTrend(matchId) {
        try {
            const trendData = await TheSportsAPIManager_1.theSportsAPI.get('/match/live/trend', {
                match_id: matchId,
            });
            if (!trendData?.results || !Array.isArray(trendData.results)) {
                logger_1.logger.debug(`[MatchDetailSync] No trend data for ${matchId}`);
                return 0;
            }
            const client = await connection_1.pool.connect();
            let synced = 0;
            try {
                for (const trend of trendData.results) {
                    const minute = trend.minute ?? trend.time ?? 0;
                    await client.query(`
            INSERT INTO ts_match_trend (
              match_id, minute,
              home_possession, away_possession,
              home_attacks, away_attacks,
              home_dangerous_attacks, away_dangerous_attacks,
              home_shots, away_shots,
              home_shots_on_target, away_shots_on_target,
              home_corners, away_corners,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            ON CONFLICT (match_id, minute)
            DO UPDATE SET
              home_possession = COALESCE(EXCLUDED.home_possession, ts_match_trend.home_possession),
              away_possession = COALESCE(EXCLUDED.away_possession, ts_match_trend.away_possession),
              home_attacks = COALESCE(EXCLUDED.home_attacks, ts_match_trend.home_attacks),
              away_attacks = COALESCE(EXCLUDED.away_attacks, ts_match_trend.away_attacks),
              home_dangerous_attacks = COALESCE(EXCLUDED.home_dangerous_attacks, ts_match_trend.home_dangerous_attacks),
              away_dangerous_attacks = COALESCE(EXCLUDED.away_dangerous_attacks, ts_match_trend.away_dangerous_attacks),
              home_shots = COALESCE(EXCLUDED.home_shots, ts_match_trend.home_shots),
              away_shots = COALESCE(EXCLUDED.away_shots, ts_match_trend.away_shots),
              home_shots_on_target = COALESCE(EXCLUDED.home_shots_on_target, ts_match_trend.home_shots_on_target),
              away_shots_on_target = COALESCE(EXCLUDED.away_shots_on_target, ts_match_trend.away_shots_on_target),
              home_corners = COALESCE(EXCLUDED.home_corners, ts_match_trend.home_corners),
              away_corners = COALESCE(EXCLUDED.away_corners, ts_match_trend.away_corners)
          `, [
                        matchId, minute,
                        trend.home_possession ?? null,
                        trend.away_possession ?? null,
                        trend.home_attacks ?? null,
                        trend.away_attacks ?? null,
                        trend.home_dangerous_attacks ?? null,
                        trend.away_dangerous_attacks ?? null,
                        trend.home_shots ?? null,
                        trend.away_shots ?? null,
                        trend.home_shots_on_target ?? null,
                        trend.away_shots_on_target ?? null,
                        trend.home_corners ?? null,
                        trend.away_corners ?? null
                    ]);
                    synced++;
                }
                return synced;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            logger_1.logger.error(`[MatchDetailSync] Error syncing trend for ${matchId}:`, error);
            return 0;
        }
    }
    /**
     * Get stats from ts_match_stats table
     */
    async getStats(matchId) {
        const result = await connection_1.pool.query(`
      SELECT match_id, stat_type, home_value, away_value, minute
      FROM ts_match_stats
      WHERE match_id = $1
      ORDER BY stat_type
    `, [matchId]);
        return result.rows;
    }
    /**
     * Get incidents from ts_match_incidents table
     */
    async getIncidents(matchId) {
        const result = await connection_1.pool.query(`
      SELECT *
      FROM ts_match_incidents
      WHERE match_id = $1
      ORDER BY minute ASC, added_time ASC NULLS FIRST
    `, [matchId]);
        return result.rows;
    }
    /**
     * Get lineups from ts_match_lineups table
     */
    async getLineups(matchId) {
        const result = await connection_1.pool.query(`
      SELECT *
      FROM ts_match_lineups
      WHERE match_id = $1
      ORDER BY is_starter DESC, position
    `, [matchId]);
        const home = result.rows.filter(r => r.team === 'home');
        const away = result.rows.filter(r => r.team === 'away');
        return {
            home,
            away,
            home_formation: home[0]?.formation ?? null,
            away_formation: away[0]?.formation ?? null,
        };
    }
    /**
     * Get trend data from ts_match_trend table
     */
    async getTrend(matchId) {
        const result = await connection_1.pool.query(`
      SELECT *
      FROM ts_match_trend
      WHERE match_id = $1
      ORDER BY minute ASC
    `, [matchId]);
        return result.rows;
    }
}
exports.MatchDetailSyncService = MatchDetailSyncService;
// Singleton export
exports.matchDetailSyncService = new MatchDetailSyncService();
