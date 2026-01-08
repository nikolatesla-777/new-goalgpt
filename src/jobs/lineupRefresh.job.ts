/**
 * Lineup Refresh Job
 * 
 * Refreshes lineups for matches starting in the next hour.
 * Official lineups are typically confirmed 1 hour before kickoff.
 * This job runs every 15 minutes to catch lineup updates.
 */

import * as cron from 'node-cron';
import { theSportsAPI } from '../core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { MatchLineupService } from '../services/thesports/match/matchLineup.service';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

export class LineupRefreshJob {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private matchLineupService: MatchLineupService;
  private client = theSportsAPI; // Phase 3A: Use singleton

  private static readonly CRON_TIMEZONE = 'Europe/Istanbul';

  constructor() {
    this.matchLineupService = new MatchLineupService(this.client);
  }

  /**
   * Get matches starting in the next 60-90 minutes that need lineup refresh
   */
  private async getUpcomingMatches(): Promise<Array<{ match_id: string; match_time: number; home_team: string; away_team: string }>> {
    const client = await pool.connect();
    try {
      // Get current time in seconds
      const nowSeconds = Math.floor(Date.now() / 1000);
      // Window: 30 minutes to 90 minutes from now
      const windowStart = nowSeconds + 30 * 60;  // 30 minutes from now
      const windowEnd = nowSeconds + 90 * 60;    // 90 minutes from now

      const result = await client.query(`
        SELECT 
          m.external_id as match_id,
          m.match_time,
          ht.name as home_team,
          at.name as away_team
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        WHERE m.status_id = 1  -- NOT_STARTED only
          AND m.match_time >= $1
          AND m.match_time <= $2
        ORDER BY m.match_time ASC
      `, [windowStart, windowEnd]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Refresh lineup for a single match
   */
  private async refreshMatchLineup(matchId: string): Promise<boolean> {
    try {
      const response = await this.matchLineupService.getMatchLineup({ match_id: matchId });
      const results = (response as any).results || {};

      if (!results || Object.keys(results).length === 0) {
        logger.debug(`[LineupRefresh] No lineup data for match ${matchId}`);
        return false;
      }

      const homeFormation = results.home_formation || results.home?.formation || null;
      const awayFormation = results.away_formation || results.away?.formation || null;
      const homeLineup = results.home_lineup || results.home?.lineup || [];
      const awayLineup = results.away_lineup || results.away?.lineup || [];
      const homeSubs = results.home_subs || results.home?.subs || [];
      const awaySubs = results.away_subs || results.away?.subs || [];
      const confirmed = results.confirmed || (homeLineup.length > 0 && awayLineup.length > 0);

      const client = await pool.connect();
      try {
        await client.query(`
          INSERT INTO ts_match_lineups (
            match_id, home_formation, away_formation,
            home_lineup, away_lineup, home_subs, away_subs,
            confirmed, raw_response, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (match_id) DO UPDATE SET
            home_formation = EXCLUDED.home_formation,
            away_formation = EXCLUDED.away_formation,
            home_lineup = EXCLUDED.home_lineup,
            away_lineup = EXCLUDED.away_lineup,
            home_subs = EXCLUDED.home_subs,
            away_subs = EXCLUDED.away_subs,
            confirmed = EXCLUDED.confirmed,
            raw_response = EXCLUDED.raw_response,
            updated_at = NOW()
        `, [
          matchId,
          homeFormation,
          awayFormation,
          JSON.stringify(homeLineup),
          JSON.stringify(awayLineup),
          JSON.stringify(homeSubs),
          JSON.stringify(awaySubs),
          confirmed,
          JSON.stringify(response)
        ]);

        return confirmed || false;
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.warn(`[LineupRefresh] Failed to refresh lineup for match ${matchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Run lineup refresh for all upcoming matches
   */
  async runRefresh(): Promise<{ total: number; confirmed: number; updated: number; errors: number }> {
    if (this.isRunning) {
      logger.warn('[LineupRefresh] Already running, skipping...');
      return { total: 0, confirmed: 0, updated: 0, errors: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const matches = await this.getUpcomingMatches();

      if (matches.length === 0) {
        logger.debug('[LineupRefresh] No upcoming matches in the 30-90 minute window');
        return { total: 0, confirmed: 0, updated: 0, errors: 0 };
      }

      logger.info(`🔄 [LineupRefresh] Checking lineups for ${matches.length} matches starting in 30-90 minutes...`);

      let confirmed = 0;
      let updated = 0;
      let errors = 0;

      for (const match of matches) {
        try {
          const isConfirmed = await this.refreshMatchLineup(match.match_id);
          updated++;
          if (isConfirmed) {
            confirmed++;
            logger.info(`✅ [LineupRefresh] Confirmed lineup: ${match.home_team} vs ${match.away_team}`);
          }
        } catch (error: any) {
          errors++;
          logger.warn(`[LineupRefresh] Error for ${match.match_id}: ${error.message}`);
        }

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ [LineupRefresh] Completed in ${duration}ms: ${matches.length} matches, ${confirmed} confirmed, ${updated} updated, ${errors} errors`);

      return { total: matches.length, confirmed, updated, errors };
    } catch (error: any) {
      logger.error('[LineupRefresh] Job failed:', error.message);
      return { total: 0, confirmed: 0, updated: 0, errors: 1 };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the job
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('[LineupRefresh] Job already started');
      return;
    }

    // Run every 15 minutes
    this.cronJob = cron.schedule(
      '*/15 * * * *',
      async () => {
        await this.runRefresh();
      },
      { timezone: LineupRefreshJob.CRON_TIMEZONE }
    );

    logger.info('📋 [LineupRefresh] Job started:');
    logger.info('   ⏰ Schedule: Every 15 minutes');
    logger.info('   🎯 Target: Matches starting in 30-90 minutes');
    logger.info('   🕒 Timezone: Europe/Istanbul');

    // Run immediately on start
    setTimeout(() => {
      this.runRefresh();
    }, 10000); // 10 seconds after server start
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    logger.info('[LineupRefresh] Job stopped');
  }
}

