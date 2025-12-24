/**
 * Match Detail Live Service
 * 
 * Handles business logic for /match/detail_live endpoint
 */

import { TheSportsClient } from '../client/thesports-client';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';
import { CircuitOpenError } from '../../../utils/circuitBreaker';
import { MatchDetailLiveResponse, MatchDetailLiveParams } from '../../../types/thesports/match';
import { pool } from '../../../database/connection';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { getWithCacheFallback } from '../../../utils/cache/cache-fallback.util';

export class MatchDetailLiveService {
  constructor(private client: TheSportsClient) {
    // Phase 4-2: Single circuit layer - circuit breaker is in TheSportsClient, not here
  }

  // Cached schema capability for reconcile (avoid information_schema queries on every call)
  private reconcileSchemaChecked = false;
  private hasIncidentsColumn = false;
  private hasStatisticsColumn = false;
  private hasNewScoreColumns = false;
  private hasLiveKickoffTimeColumn = false;
  private minuteColumnName: 'minute' | 'match_minute' | null = null;

  /**
   * Get match detail live with cache fallback
   */
  async getMatchDetailLive(
    params: MatchDetailLiveParams,
    options: { forceRefresh?: boolean } = {}
  ): Promise<MatchDetailLiveResponse> {
    const { match_id } = params;
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:detail_live:${match_id}`;
    if (options.forceRefresh) {
      logger.info(`Force-refresh match detail live: ${match_id}`);
      // Phase 4-2: Single circuit layer - circuit breaker is in TheSportsClient
      try {
        return await this.client.get<MatchDetailLiveResponse>('/match/detail_live', { match_id });
      } catch (circuitError: any) {
        // Phase 4-2: Circuit breaker is OPEN - return "no usable data" (typed error check)
        if (circuitError instanceof CircuitOpenError) {
          logEvent('warn', 'provider.circuit.skip', {
            provider: 'thesports-http',
            endpoint: '/match/detail_live',
            match_id,
          });
          return { results: [] } as unknown as MatchDetailLiveResponse; // Return empty results
        }
        throw circuitError;
      }
    }
    return getWithCacheFallback(
      cacheKey,
      async () => {
        logger.info(`Fetching match detail live: ${match_id}`);
        // Phase 4-2: Single circuit layer - circuit breaker is in TheSportsClient
        try {
          return await this.client.get<MatchDetailLiveResponse>(
            '/match/detail_live',
            { match_id }
          );
        } catch (circuitError: any) {
          // Phase 4-2: Circuit breaker is OPEN - return "no usable data" (typed error check)
          if (circuitError instanceof CircuitOpenError) {
            logEvent('warn', 'provider.circuit.skip', {
              provider: 'thesports-http',
              endpoint: '/match/detail_live',
              match_id,
            });
            return { results: [] } as unknown as MatchDetailLiveResponse; // Return empty results
          }
          throw circuitError;
        }
      },
      {
        ttl: CacheTTL.Minute, // Live data, short cache
        staleTtl: CacheTTL.FiveMinutes, // Serve stale data if API fails
      }
    );
  }

  private extractLiveFields(resp: any, matchId?: string): {
    statusId: number | null;
    homeScoreDisplay: number | null;
    awayScoreDisplay: number | null;
    incidents: any[] | null;
    statistics: any[] | null;
    liveKickoffTime: number | null;
    updateTime: number | null;
    minute: number | null; // CRITICAL FIX: Extract minute from provider
  } {
    // TheSports /match/detail_live payloads can vary by plan/version.
    // We do not assume a single rigid shape; we attempt best-effort extraction.
    // CRITICAL: If response is an array, find the element matching matchId
    // DO NOT fallback to first array element (prevents writing wrong match data)
    const container = resp?.results ?? resp?.result ?? resp?.data ?? resp;

    const unwrapResults = (r: any) => {
      if (!r || typeof r !== 'object') return r;

      if (Array.isArray(r)) {
        if (matchId) {
          const found = r.find((item: any) => item?.id === matchId || item?.match_id === matchId);
          if (found) {
            logger.debug(`[DetailLive] matched detail_live by id match_id=${matchId} (len=${r.length})`);
            return found;
          }
          // CRITICAL: If matchId is not found in the array, return null instead of r[0]
          logger.warn(`[DetailLive] match_id=${matchId} not found in detail_live results (len=${r.length})`);
          return null;
        }
        return null;
      }

      if (matchId && r[matchId]) return r[matchId];

      const keys = Object.keys(r);
      if (keys.length === 1) {
        const v = (r as any)[keys[0]];
        if (Array.isArray(v)) {
          if (matchId) {
            const found = v.find((item: any) => item?.id === matchId || item?.match_id === matchId);
            if (found) {
              logger.debug(`[DetailLive] matched detail_live by id match_id=${matchId} (len=${v.length}, key=${keys[0]})`);
              return found;
            }
            // CRITICAL: If matchId is not found in the array, return null instead of v[0]
            logger.warn(`[DetailLive] match_id=${matchId} not found in detail_live results (len=${v.length}, key=${keys[0]})`);
            return null;
          }
          return null;
        }
        return v;
      }

      if (r['1']) {
        const v = r['1'];
        if (Array.isArray(v)) {
          if (matchId) {
            const found = v.find((item: any) => item?.id === matchId || item?.match_id === matchId);
            if (found) {
              logger.debug(`[DetailLive] matched detail_live by id match_id=${matchId} (len=${v.length}, key=1)`);
              return found;
            }
            // CRITICAL: If matchId is not found in the array, return null instead of v[0]
            logger.warn(`[DetailLive] match_id=${matchId} not found in detail_live results (len=${v.length}, key=1)`);
            return null;
          }
          return null;
        }
        return v;
      }

      return r;
    };

    const root = unwrapResults(container);

    const statusId =
      (typeof root?.status_id === 'number' ? root.status_id : null) ??
      (typeof root?.status === 'number' ? root.status : null) ??
      (typeof root?.match?.status_id === 'number' ? root.match.status_id : null) ??
      (typeof root?.match?.status === 'number' ? root.match.status : null) ??
      null;

    // Best-effort score extraction. Prefer explicit display scores if present.
    const homeScoreDisplay =
      (typeof root?.home_score === 'number' ? root.home_score : null) ??
      (typeof root?.home_score_display === 'number' ? root.home_score_display : null) ??
      (typeof root?.score?.home === 'number' ? root.score.home : null) ??
      (typeof root?.match?.home_score === 'number' ? root.match.home_score : null) ??
      null;

    const awayScoreDisplay =
      (typeof root?.away_score === 'number' ? root.away_score : null) ??
      (typeof root?.away_score_display === 'number' ? root.away_score_display : null) ??
      (typeof root?.score?.away === 'number' ? root.score.away : null) ??
      (typeof root?.match?.away_score === 'number' ? root.match.away_score : null) ??
      null;

    // Incidents/stats may be arrays or nested in different keys.
    const incidents =
      (Array.isArray(root?.incidents) ? root.incidents : null) ??
      (Array.isArray(root?.events) ? root.events : null) ??
      (Array.isArray(root?.match_incidents) ? root.match_incidents : null) ??
      null;

    const statistics =
      (Array.isArray(root?.statistics) ? root.statistics : null) ??
      (Array.isArray(root?.stats) ? root.stats : null) ??
      (Array.isArray(root?.technical_statistics) ? root.technical_statistics : null) ??
      null;

    // Provider-supplied live kickoff time (epoch seconds). Do NOT derive from local time.
    const liveKickoffTimeRaw =
      (typeof root?.live_kickoff_time === 'number' ? root.live_kickoff_time : null) ??
      (typeof root?.liveKickoffTime === 'number' ? root.liveKickoffTime : null) ??
      (typeof root?.match?.live_kickoff_time === 'number' ? root.match.live_kickoff_time : null) ??
      (typeof root?.match?.liveKickoffTime === 'number' ? root.match.liveKickoffTime : null) ??
      null;

    const liveKickoffTime =
      typeof liveKickoffTimeRaw === 'number' && Number.isFinite(liveKickoffTimeRaw) && liveKickoffTimeRaw > 0
        ? liveKickoffTimeRaw
        : null;

    // Extract provider update_time if available
    const updateTimeRaw =
      (typeof root?.update_time === 'number' ? root.update_time : null) ??
      (typeof root?.updateTime === 'number' ? root.updateTime : null) ??
      (typeof root?.updated_at === 'number' ? root.updated_at : null) ??
      (typeof root?.match?.update_time === 'number' ? root.match.update_time : null) ??
      null;

    const updateTime =
      typeof updateTimeRaw === 'number' && Number.isFinite(updateTimeRaw) && updateTimeRaw > 0
        ? updateTimeRaw
        : null;

    return { statusId, homeScoreDisplay, awayScoreDisplay, incidents, statistics, liveKickoffTime, updateTime };
  }

  /**
   * Detect schema capabilities once per process to keep reconcile fast.
   */
  private async ensureReconcileSchema(client: any): Promise<void> {
    if (this.reconcileSchemaChecked) return;

    const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
        AND column_name IN (
          'incidents',
          'statistics',
          'home_score_regular',
          'away_score_regular',
          'home_score_display',
          'away_score_display',
          'live_kickoff_time',
          'minute',
          'match_minute'
        )
    `);

    const cols = new Set<string>(res.rows.map((r: any) => r.column_name));

    this.hasIncidentsColumn = cols.has('incidents');
    this.hasStatisticsColumn = cols.has('statistics');

    // "New score columns" are considered present if regular score columns exist.
    this.hasNewScoreColumns = cols.has('home_score_regular') && cols.has('away_score_regular');
    this.hasLiveKickoffTimeColumn = cols.has('live_kickoff_time');

    // Some schemas store live minute as `minute` or `match_minute` (we clear it during HT/FT reconciles)
    this.minuteColumnName = cols.has('minute')
      ? 'minute'
      : cols.has('match_minute')
        ? 'match_minute'
        : null;

    this.reconcileSchemaChecked = true;

    logger.info(
      `📐 [DetailLive] Reconcile schema: incidents=${this.hasIncidentsColumn}, statistics=${this.hasStatisticsColumn}, newScoreColumns=${this.hasNewScoreColumns}, liveKickoff=${this.hasLiveKickoffTimeColumn}, minuteCol=${this.minuteColumnName ?? 'none'}`
    );
  }
  /**
   * Reconcile LIVE state into DB (authoritative fallback when WS misses transitions like HT/FT).
   * IMPORTANT:
   * - external_id is TheSports match id (string)
   * - match_time must remain immutable (fixture time) and is NOT touched here
   * - live_kickoff_time is only persisted if the provider explicitly supplies a kickoff epoch (we never derive it)
   */
  async reconcileMatchToDatabase(
    match_id: string,
    providerUpdateTimeOverride: number | null = null
  ): Promise<{
    updated: boolean;
    rowCount: number;
    statusId: number | null;
    score: string | null;
    providerUpdateTime?: number | null; // Phase 5-S: For watchdog proof logs
  }> {
    const t0 = Date.now();
    logEvent('info', 'detail_live.reconcile.start', {
      match_id,
      provider_update_time: providerUpdateTimeOverride !== null ? providerUpdateTimeOverride : undefined,
    });
    
    const resp = await this.getMatchDetailLive({ match_id }, { forceRefresh: true });
    const live = this.extractLiveFields(resp, match_id);

    // Optimistic locking check (dual timestamp system)
    const ingestionTs = Math.floor(Date.now() / 1000);
    // Use override from data/update if provided, otherwise use detail_live updateTime
    const incomingProviderUpdateTime = providerUpdateTimeOverride !== null
      ? providerUpdateTimeOverride
      : live.updateTime;

    // CRITICAL: If match_id not found in array response AND no providerUpdateTimeOverride,
    // we cannot update (no data source)
    if (live.statusId === null && live.homeScoreDisplay === null && live.awayScoreDisplay === null) {
      // If we have providerUpdateTimeOverride from data/update, we can still do a minimal update
      // (just provider_update_time and last_event_ts) to track that we processed this update
      if (providerUpdateTimeOverride !== null) {
        logger.info(
          `[DetailLive] No usable data for ${match_id} but providerUpdateTimeOverride provided, ` +
          `performing minimal update (provider_update_time + last_event_ts only)`
        );
        // Continue to minimal update path below
      } else {
        logEvent('warn', 'detail_live.reconcile.no_data', {
          match_id,
          reason: 'match not found in response array',
        });
        return { updated: false, rowCount: 0, statusId: null, score: null, providerUpdateTime: null };
      }
    }

    const client = await pool.connect();
    try {
      await this.ensureReconcileSchema(client);

      // Read existing timestamps and status for transition detection
      const existingResult = await client.query(
        `SELECT provider_update_time, last_event_ts, status_id, match_time,
         first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts 
         FROM ts_matches WHERE external_id = $1`,
        [match_id]
      );

      if (existingResult.rows.length === 0) {
        logger.warn(`Match ${match_id} not found in DB during reconcile`);
        return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
      }

      const existing = existingResult.rows[0];
      const existingProviderTime = existing.provider_update_time;
      const existingEventTime = existing.last_event_ts;
      const existingStatusId = existing.status_id;

      // Check freshness (idempotent guard)
      if (incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined) {
        // Provider supplied update_time
        if (existingProviderTime !== null && incomingProviderUpdateTime <= existingProviderTime) {
          logger.debug(
            `Skipping stale update for ${match_id} (provider time: ${incomingProviderUpdateTime} <= ${existingProviderTime})`
          );
          return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
        }
      } else {
        // No provider update_time, use event time comparison
        if (existingEventTime !== null && ingestionTs <= existingEventTime + 5) {
          logger.debug(
            `Skipping stale update for ${match_id} (event time: ${ingestionTs} <= ${existingEventTime + 5})`
          );
          return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
        }
      }

      // Calculate provider_update_time to write (max of existing and incoming)
      const providerTimeToWrite =
        incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined
          ? Math.max(existingProviderTime || 0, incomingProviderUpdateTime)
          : null;

      const setParts: string[] = [
        'updated_at = NOW()',
        `provider_update_time = CASE 
          WHEN $1::BIGINT IS NOT NULL THEN GREATEST(COALESCE(provider_update_time, 0)::BIGINT, $1::BIGINT)
          ELSE provider_update_time
        END`,
        `last_event_ts = $2::BIGINT`,
      ];
      const values: any[] = [providerTimeToWrite, ingestionTs];
      let i = 3;

      // If we have live data, update status and scores
      // If we only have providerUpdateTimeOverride (no live data), skip status/score updates
      const hasLiveData = live.statusId !== null || live.homeScoreDisplay !== null || live.awayScoreDisplay !== null;

      // Status update (only if we have live data)
      if (hasLiveData && live.statusId !== null) {
        setParts.push(`status_id = $${i++}`);
        values.push(live.statusId);
      }

      // Kickoff timestamp write-once (status transition based)
      // Use liveKickoffTime from provider if available, else use ingestion time as fallback
      const kickoffTimeToUse = live.liveKickoffTime !== null ? live.liveKickoffTime : ingestionTs;
      
      if (hasLiveData && live.statusId !== null) {
        // CRITICAL FIX: Set first_half_kickoff_ts for status 2, 3, 4, 5, 7 if NULL
        // This ensures minute engine can calculate minutes even if transition was missed
        if ((live.statusId === 2 || live.statusId === 3 || live.statusId === 4 || live.statusId === 5 || live.statusId === 7) && existing.first_half_kickoff_ts === null) {
          // Try to get match_time from existing record as fallback
          const existingMatchTimeResult = await client.query(
            `SELECT match_time FROM ts_matches WHERE external_id = $1`,
            [match_id]
          );
          const matchTime = existingMatchTimeResult.rows[0]?.match_time || kickoffTimeToUse;
          const finalKickoffTime = live.liveKickoffTime !== null ? live.liveKickoffTime : matchTime;
          
          setParts.push(`first_half_kickoff_ts = $${i++}`);
          values.push(finalKickoffTime);
          const source = live.liveKickoffTime !== null ? 'liveKickoff' : (matchTime !== kickoffTimeToUse ? 'match_time' : 'now');
          logger.info(`[KickoffTS] set first_half_kickoff_ts=${finalKickoffTime} match_id=${match_id} source=${source} status=${live.statusId}`);
        } else if (live.statusId === 2 && (existingStatusId === null || existingStatusId === 1)) {
          // Original transition logic (for logging)
          if (existing.first_half_kickoff_ts === null) {
            // Already handled above, but keep for backward compatibility
            logger.debug(`[KickoffTS] skip (already set) first_half_kickoff_ts match_id=${match_id}`);
          }
        }
        
        // Status 4 (SECOND_HALF): Set second_half_kickoff_ts if transitioning from HT
        if (live.statusId === 4 && existingStatusId === 3) {
          if (existing.second_half_kickoff_ts === null) {
            setParts.push(`second_half_kickoff_ts = $${i++}`);
            values.push(kickoffTimeToUse);
            const source = live.liveKickoffTime !== null ? 'liveKickoff' : 'now';
            logger.info(`[KickoffTS] set second_half_kickoff_ts=${kickoffTimeToUse} match_id=${match_id} source=${source}`);
          } else {
            logger.debug(`[KickoffTS] skip (already set) second_half_kickoff_ts match_id=${match_id}`);
          }
        }
        
        // Status 5 (OVERTIME): Set overtime_kickoff_ts if transitioning from SECOND_HALF
        if (live.statusId === 5 && existingStatusId === 4) {
          if (existing.overtime_kickoff_ts === null) {
            setParts.push(`overtime_kickoff_ts = $${i++}`);
            values.push(kickoffTimeToUse);
            const source = live.liveKickoffTime !== null ? 'liveKickoff' : 'now';
            logger.info(`[KickoffTS] set overtime_kickoff_ts=${kickoffTimeToUse} match_id=${match_id} source=${source}`);
          } else {
            logger.debug(`[KickoffTS] skip (already set) overtime_kickoff_ts match_id=${match_id}`);
          }
        }
      }

      // Persist provider-supplied live kickoff time once (never overwrite) - legacy column
      if (this.hasLiveKickoffTimeColumn && live.liveKickoffTime !== null) {
        setParts.push(`live_kickoff_time = COALESCE(live_kickoff_time, $${i++})`);
        values.push(live.liveKickoffTime);
      }

      // CRITICAL FIX: Update minute from provider if available (provider-authoritative)
      // Provider's minute value takes precedence over calculated minute
      if (this.minuteColumnName && live.minute !== null) {
        // Provider says minute = X, use it (even during HT if provider says so)
        setParts.push(`${this.minuteColumnName} = $${i++}`);
        values.push(live.minute);
        logger.debug(`[DetailLive] Setting minute=${live.minute} from provider for match_id=${match_id}`);
      } else if (this.minuteColumnName) {
        // IMPORTANT: During halftime (and some terminal states), we must NOT show a running minute.
        // If we persist minute values during HT, UI can display weird values (e.g., "HT 06:00").
        // We clear minute only if the schema has a minute column AND provider didn't supply a minute.
        const isHalfTime = live.statusId === 3; // TheSports commonly uses 3 = HALF_TIME
        const isFinished = live.statusId === 8 || live.statusId === 9; // defensive (varies by plan); no harm if not used
        if (isHalfTime || isFinished) {
          setParts.push(`${this.minuteColumnName} = NULL`);
        }
      }

      // Canonical score update (independent of status)
      if (this.hasNewScoreColumns) {
        if (live.homeScoreDisplay !== null) {
          setParts.push(`home_score_regular = $${i++}`);
          values.push(live.homeScoreDisplay);

          setParts.push(`home_score_display = $${i++}`);
          values.push(live.homeScoreDisplay);
        }
        if (live.awayScoreDisplay !== null) {
          setParts.push(`away_score_regular = $${i++}`);
          values.push(live.awayScoreDisplay);

          setParts.push(`away_score_display = $${i++}`);
          values.push(live.awayScoreDisplay);
        }
      }

      if (live.homeScoreDisplay !== null) {
        setParts.push(`home_scores = ARRAY[$${i++}]`);
        values.push(live.homeScoreDisplay);
      }

      if (live.awayScoreDisplay !== null) {
        setParts.push(`away_scores = ARRAY[$${i++}]`);
        values.push(live.awayScoreDisplay);
      }

      if (this.hasIncidentsColumn && live.incidents !== null) {
        setParts.push(`incidents = $${i++}::jsonb`);
        values.push(JSON.stringify(live.incidents));
      }

      if (this.hasStatisticsColumn && live.statistics !== null) {
        setParts.push(`statistics = $${i++}::jsonb`);
        values.push(JSON.stringify(live.statistics));
      }

      // Nothing to update besides updated_at
      if (setParts.length === 1) {
        return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
      }

      const query = `
        UPDATE ts_matches
        SET ${setParts.join(', ')}
        WHERE external_id = $${i}
      `;
      values.push(String(match_id));

      const res = await client.query(query, values);

      const affected = res.rowCount ?? 0;

      if (affected === 0) {
        logger.warn(
          `⚠️ [DetailLive] UPDATE affected 0 rows: matchId=${match_id}, ` +
          `status=${live.statusId}, score=${live.homeScoreDisplay}-${live.awayScoreDisplay}. ` +
          `Match not found in DB or external_id mismatch.`
        );
        return {
          updated: false,
          rowCount: 0,
          statusId: live.statusId,
          score:
            live.homeScoreDisplay !== null && live.awayScoreDisplay !== null
              ? `${live.homeScoreDisplay}-${live.awayScoreDisplay}`
              : null,
        };
      }

      const duration = Date.now() - t0;
      logEvent('info', 'detail_live.reconcile.done', {
        match_id,
        duration_ms: duration,
        rowCount: affected,
        status_id: live.statusId,
      });

      // Phase 5-S: Read provider_update_time from updated row for watchdog proof logs
      const updatedRowResult = await client.query(
        'SELECT provider_update_time FROM ts_matches WHERE external_id = $1',
        [match_id]
      );
      const providerUpdateTime = updatedRowResult.rows[0]?.provider_update_time 
        ? Number(updatedRowResult.rows[0].provider_update_time) 
        : null;

      return {
        updated: true,
        rowCount: affected,
        statusId: live.statusId,
        score:
          live.homeScoreDisplay !== null && live.awayScoreDisplay !== null
            ? `${live.homeScoreDisplay}-${live.awayScoreDisplay}`
            : null,
        providerUpdateTime: providerUpdateTime, // Phase 5-S: For watchdog proof logs
      };
    } finally {
      client.release();
    }
  }
}
