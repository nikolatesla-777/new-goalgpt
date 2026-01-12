
/**
 * Match Detail Live Service
 * 
 * Handles business logic for /match/detail_live endpoint
 */

import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';
import { CircuitOpenError } from '../../../utils/circuitBreaker';
import { MatchDetailLiveResponse, MatchDetailLiveParams } from '../../../types/thesports/match';
import { pool } from '../../../database/connection';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { getWithCacheFallback } from '../../../utils/cache/cache-fallback.util';

export class MatchDetailLiveService {
  private client = theSportsAPI;
  constructor() {
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

    // Normal cached fetch
    return getWithCacheFallback(
      cacheKey,
      async () => {
        logger.info(`Fetching match detail live: ${match_id}`);
        // Phase 4-2: Single circuit layer - circuit breaker is in TheSportsClient
        try {
          const response = await this.client.get<MatchDetailLiveResponse>(
            '/match/detail_live',
            { match_id }
          );

          // CRITICAL FIX: If API returns empty results for specific ID, try fallback to GLOBAL live list
          // This handles cases where API ID filtering is broken but match is in the global feed
          const isResultEmpty = !response || !response.results ||
            (Array.isArray(response.results) && response.results.length === 0) ||
            (typeof response.results === 'object' && Object.keys(response.results).length === 0);

          if (isResultEmpty) {
            logger.warn(`[DetailLive] Direct fetch for ${match_id} returned empty. Falling back to global live list search.`);
            const globalList = await this.getAllLiveStats();
            const foundInGlobal = globalList.find((m: any) =>
              String(m?.id || '') === String(match_id) ||
              String(m?.match_id || '') === String(match_id)
            );

            if (foundInGlobal) {
              logger.info(`[DetailLive] Found match ${match_id} in global live list fallback!`);
              // Wrap in expected response structure
              return { results: [foundInGlobal] } as unknown as MatchDetailLiveResponse;
            }
          }

          return response;
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
        ttl: CacheTTL.TenSeconds, // Live data, ultra-short cache for real-time scores
        staleTtl: CacheTTL.Minute, // Serve stale data if API fails
      }
    );
  }

  /**
   * Get match detail (non-live) - used as fallback when match is not in detail_live
   * This endpoint returns data for finished matches (status 8)
   */
  async getMatchDetail(matchId: string): Promise<any> {
    try {
      // Direct call to /match/detail
      const response = await this.client.get<any>('/match/detail', { match_id: matchId });
      return response;
    } catch (error: any) {
      logger.warn(`[MatchDetailLive] Failed to fetch /match/detail for ${matchId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get ALL live match stats (no match_id parameter)
   * Returns stats, incidents, score for all currently live matches
   * Cached for 30 seconds
   */
  async getAllLiveStats(): Promise<any[]> {
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:detail_live:all`;

    // Try cache first
    const cached = await getWithCacheFallback(
      cacheKey,
      async () => {
        logger.info('Fetching ALL live match details (no match_id param)');
        // Call detail_live WITHOUT match_id to get all live matches
        const response = await this.client.get<any>('/match/detail_live');
        return response?.results || [];
      },
      {
        ttl: CacheTTL.TenSeconds, // Ultra-short cache for real-time scores
        staleTtl: CacheTTL.Minute,
      }
    );

    return cached || [];
  }

  /**
   * Get specific match stats by filtering from all live matches
   * This is more reliable than passing match_id to detail_live endpoint
   */
  async getMatchStatsFromLive(matchId: string): Promise<{
    id: string;
    stats: Array<{ type: number; home: number; away: number }>;
    incidents: any[];
    score: any[] | null;
  } | null> {
    const allLiveMatches = await this.getAllLiveStats();

    // Find the specific match
    const matchData = allLiveMatches.find((m: any) => m.id === matchId);

    if (matchData) {
      logger.info(`Found stats for match ${matchId}: ${matchData.stats?.length || 0} stats, ${matchData.incidents?.length || 0} incidents`);
      return {
        id: matchData.id,
        stats: matchData.stats || [],
        incidents: matchData.incidents || [],
        score: matchData.score || null,
      };
    }

    logger.warn(`Match ${matchId} not found in live data (may not be currently live)`);
    return null;
  }

  public extractLiveFields(resp: any, matchId?: string): {
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
          // CRITICAL FIX: Check multiple possible ID fields (id, match_id, external_id)
          const found = r.find((item: any) =>
            String(item?.id || '') === String(matchId) ||
            String(item?.match_id || '') === String(matchId) ||
            String(item?.external_id || '') === String(matchId)
          );
          if (found) {
            logger.debug(`[DetailLive] matched detail_live by id match_id=${matchId} (len=${r.length})`);
            return found;
          }
          // CRITICAL: If matchId is not found in the array, return null instead of r[0]
          logger.warn(`[DetailLive] match_id=${matchId} not found in detail_live results (len=${r.length}). Checked: id, match_id, external_id`);
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
            // CRITICAL FIX: Check multiple possible ID fields (id, match_id, external_id)
            const found = v.find((item: any) =>
              String(item?.id || '') === String(matchId) ||
              String(item?.match_id || '') === String(matchId) ||
              String(item?.external_id || '') === String(matchId)
            );
            if (found) {
              logger.debug(`[DetailLive] matched detail_live by id match_id=${matchId} (len=${v.length}, key=${keys[0]})`);
              return found;
            }
            // CRITICAL: If matchId is not found in the array, return null instead of v[0]
            logger.warn(`[DetailLive] match_id=${matchId} not found in detail_live results (len=${v.length}, key=${keys[0]}). Checked: id, match_id, external_id`);
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
            // CRITICAL FIX: Check multiple possible ID fields (id, match_id, external_id)
            const found = v.find((item: any) =>
              String(item?.id || '') === String(matchId) ||
              String(item?.match_id || '') === String(matchId) ||
              String(item?.external_id || '') === String(matchId)
            );
            if (found) {
              logger.debug(`[DetailLive] matched detail_live by id match_id=${matchId} (len=${v.length}, key=1)`);
              return found;
            }
            // CRITICAL: If matchId is not found in the array, return null instead of v[0]
            logger.warn(`[DetailLive] match_id=${matchId} not found in detail_live results (len=${v.length}, key=1). Checked: id, match_id, external_id`);
            return null;
          }
          return null;
        }
        return v;
      }

      return r;
    };

    const root = unwrapResults(container);

    // CRITICAL FIX: Handle score array format: [match_id, status_id, home_scores[], away_scores[], update_time, ...]
    let statusId: number | null = null;
    if (Array.isArray(root?.score) && root.score.length >= 2 && typeof root.score[1] === 'number') {
      statusId = root.score[1];
      logger.debug(`[DetailLive] Extracted status_id=${statusId} from score array format`);
    } else {
      statusId =
        (typeof root?.status_id === 'number' ? root.status_id : null) ??
        (typeof root?.status === 'number' ? root.status : null) ??
        (typeof root?.match?.status_id === 'number' ? root.match.status_id : null) ??
        (typeof root?.match?.status === 'number' ? root.match.status : null) ??
        null;
    }

    // Best-effort score extraction. Prefer explicit display scores if present.
    // CRITICAL FIX: Handle score array format: [match_id, status_id, home_scores[], away_scores[], update_time, ...]
    let homeScoreDisplay: number | null = null;
    let awayScoreDisplay: number | null = null;

    if (Array.isArray(root?.score) && root.score.length >= 4) {
      // score[2] = home_scores array, score[3] = away_scores array
      // Index 0 of score array is regular score
      const homeScores = Array.isArray(root.score[2]) ? root.score[2] : null;
      const awayScores = Array.isArray(root.score[3]) ? root.score[3] : null;
      homeScoreDisplay = homeScores && homeScores.length > 0 && typeof homeScores[0] === 'number' ? homeScores[0] : null;
      awayScoreDisplay = awayScores && awayScores.length > 0 && typeof awayScores[0] === 'number' ? awayScores[0] : null;
      if (homeScoreDisplay !== null || awayScoreDisplay !== null) {
        logger.debug(`[DetailLive] Extracted scores from score array format: ${homeScoreDisplay}-${awayScoreDisplay}`);
      }
    }

    if (homeScoreDisplay === null || isNaN(homeScoreDisplay)) {
      homeScoreDisplay =
        (typeof root?.home_score === 'number' && !isNaN(root.home_score) ? root.home_score : null) ??
        (typeof root?.home_score_display === 'number' && !isNaN(root.home_score_display) ? root.home_score_display : null) ??
        (typeof root?.score?.home === 'number' && !isNaN(root.score.home) ? root.score.home : null) ??
        (typeof root?.match?.home_score === 'number' && !isNaN(root.match.home_score) ? root.match.home_score : null) ??
        null;
    }

    if (awayScoreDisplay === null || isNaN(awayScoreDisplay)) {
      awayScoreDisplay =
        (typeof root?.away_score === 'number' && !isNaN(root.away_score) ? root.away_score : null) ??
        (typeof root?.away_score_display === 'number' && !isNaN(root.away_score_display) ? root.away_score_display : null) ??
        (typeof root?.score?.away === 'number' && !isNaN(root.score.away) ? root.score.away : null) ??
        (typeof root?.match?.away_score === 'number' && !isNaN(root.match.away_score) ? root.match.away_score : null) ??
        null;
    }

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

    // Extract provider update_time if available (NOT in score array - only in root object)
    // Score array format: [match_id, status_id, home_scores[], away_scores[], kick_off_timestamp, "Compatible ignore"]
    // update_time is NOT in score array, extract from root object fields
    // CRITICAL FIX: TheSports API uses 'tlive' field for real-time update timestamp
    let updateTimeRaw: number | null = null;
    updateTimeRaw =
      (typeof root?.tlive === 'number' ? root.tlive : null) ??
      (typeof root?.update_time === 'number' ? root.update_time : null) ??
      (typeof root?.updateTime === 'number' ? root.updateTime : null) ??
      (typeof root?.updated_at === 'number' ? root.updated_at : null) ??
      (typeof root?.match?.update_time === 'number' ? root.match.update_time : null) ??
      (typeof root?.match?.tlive === 'number' ? root.match.tlive : null) ??
      null;

    // Provider-supplied "Kick-off timestamp" (epoch seconds)
    // According to TheSports docs: "Kick-off timestamp" changes in real-time based on match status:
    // - Status FIRST_HALF (2): first half kick-off time
    // - Status SECOND_HALF (4): second half kick-off time
    // This is in score array at index 4, or in root object as live_kickoff_time
    let liveKickoffTimeRaw: number | null = null;
    if (Array.isArray(root?.score) && root.score.length >= 5 && typeof root.score[4] === 'number') {
      // Score array index 4 is "Kick-off timestamp" according to TheSports docs
      liveKickoffTimeRaw = root.score[4];
      logger.debug(`[DetailLive] Extracted kick-off timestamp=${liveKickoffTimeRaw} from score array format (index 4)`);
    } else {
      // Fallback to root object fields
      liveKickoffTimeRaw =
        (typeof root?.live_kickoff_time === 'number' ? root.live_kickoff_time : null) ??
        (typeof root?.liveKickoffTime === 'number' ? root.liveKickoffTime : null) ??
        (typeof root?.match?.live_kickoff_time === 'number' ? root.match.live_kickoff_time : null) ??
        (typeof root?.match?.liveKickoffTime === 'number' ? root.match.liveKickoffTime : null) ??
        null;
    }

    const liveKickoffTime =
      typeof liveKickoffTimeRaw === 'number' && Number.isFinite(liveKickoffTimeRaw) && liveKickoffTimeRaw > 0
        ? liveKickoffTimeRaw
        : null;

    const updateTime =
      typeof updateTimeRaw === 'number' && Number.isFinite(updateTimeRaw) && updateTimeRaw > 0
        ? updateTimeRaw
        : null;

    // DEBUG: Log if update_time is missing (critical for provider_update_time tracking)
    if (updateTime === null && matchId) {
      const tliveInfo = root?.tlive !== undefined
        ? `tlive=${JSON.stringify(root.tlive)} (type: ${typeof root.tlive})`
        : 'tlive=undefined';
      logger.warn(`[DetailLive] update_time NOT FOUND for match ${matchId}. ${tliveInfo}. Checked fields: tlive, update_time, updateTime, updated_at, match.update_time. Root keys: ${Object.keys(root || {}).join(', ')}`);
    }

    // Extract minute from provider (WebSocket/detail_live source)
    const minuteRaw =
      (typeof root?.minute === 'number' ? root.minute : null) ??
      (typeof root?.match_minute === 'number' ? root.match_minute : null) ??
      (typeof root?.match?.minute === 'number' ? root.match.minute : null) ??
      (typeof root?.match?.match_minute === 'number' ? root.match.match_minute : null) ??
      null;

    const minute =
      typeof minuteRaw === 'number' && Number.isFinite(minuteRaw) && !isNaN(minuteRaw) && minuteRaw >= 0
        ? minuteRaw
        : null;

    return { statusId, homeScoreDisplay, awayScoreDisplay, incidents, statistics, liveKickoffTime, updateTime, minute };
  }

  /**
   * Calculate minute from kickoff timestamps (fallback when provider doesn't supply minute)
   * Uses same logic as MatchMinuteService.calculateMinute()
   */
  private calculateMinuteFromKickoffs(
    statusId: number | null,
    firstHalfKickoffTs: number | null,
    secondHalfKickoffTs: number | null,
    overtimeKickoffTs: number | null,
    existingMinute: number | null,
    nowTs: number
  ): number | null {
    if (statusId === null) return null;

    // Status 2 (FIRST_HALF)
    if (statusId === 2) {
      if (firstHalfKickoffTs === null) return null;
      const calculated = Math.floor((nowTs - firstHalfKickoffTs) / 60) + 1;
      return Math.min(calculated, 45); // Clamp max 45
    }

    // Status 3 (HALF_TIME) - frozen at 45
    if (statusId === 3) {
      return 45; // Always 45, never NULL
    }

    // Status 4 (SECOND_HALF)
    if (statusId === 4) {
      if (secondHalfKickoffTs === null) {
        // CRITICAL FIX: If second_half_kickoff_ts is NULL but first_half_kickoff_ts exists,
        // estimate second half start time (typically 15 minutes after first half ends)
        // First half = 45 minutes, half-time break = 15 minutes, so second half starts ~60 minutes after first half kickoff
        if (firstHalfKickoffTs !== null) {
          const estimatedSecondHalfStart = firstHalfKickoffTs + (45 * 60) + (15 * 60); // 45 min first half + 15 min break
          const calculated = 45 + Math.floor((nowTs - estimatedSecondHalfStart) / 60) + 1;
          return Math.max(calculated, 46); // Clamp min 46
        }
        return null;
      }
      const calculated = 45 + Math.floor((nowTs - secondHalfKickoffTs) / 60) + 1;
      return Math.max(calculated, 46); // Clamp min 46
    }

    // Status 5 (OVERTIME)
    if (statusId === 5) {
      if (overtimeKickoffTs === null) return null;
      return 90 + Math.floor((nowTs - overtimeKickoffTs) / 60) + 1;
    }

    // Status 7 (PENALTY) - retain existing minute
    if (statusId === 7) {
      return existingMinute; // Retain last computed value, never NULL if exists
    }

    // Status 8 (END), 9 (DELAY), 10 (INTERRUPT) - retain existing minute
    if (statusId === 8 || statusId === 9 || statusId === 10) {
      return existingMinute; // Retain last computed value, never NULL if exists
    }

    // Unknown status or status 1 (NOT_STARTED) - return null
    return null;
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

    // CRITICAL FIX: Log when END status is detected but not extracted
    const results = (resp as any).results || (resp as any).result_list;
    if (results && Array.isArray(results)) {
      const foundMatch = (results as any[]).find((m: any) =>
        String(m?.id || m?.match_id) === String(match_id)
      );
      if (foundMatch) {
        const providerStatus = Array.isArray(foundMatch.score) ? foundMatch.score[1] : foundMatch.status_id;
        if (providerStatus === 8 && live.statusId !== 8) {
          logger.warn(
            `[DetailLive] CRITICAL: Provider says END (8) for ${match_id} but extractLiveFields returned statusId=${live.statusId}. ` +
            `Forcing status extraction from score array.`
          );
          // Force extract status from score array if available
          if (Array.isArray(foundMatch.score) && foundMatch.score.length >= 2) {
            live.statusId = foundMatch.score[1];
            live.homeScoreDisplay = Array.isArray(foundMatch.score[2]) ? foundMatch.score[2][0] : live.homeScoreDisplay;
            live.awayScoreDisplay = Array.isArray(foundMatch.score[3]) ? foundMatch.score[3][0] : live.awayScoreDisplay;
            logger.info(`[DetailLive] Fixed extraction: statusId=${live.statusId}, score=${live.homeScoreDisplay}-${live.awayScoreDisplay}`);
          }
        }
      }
    }

    // Optimistic locking check (dual timestamp system)
    const ingestionTs = Math.floor(Date.now() / 1000);
    // Use override from data/update if provided, otherwise use detail_live updateTime
    const incomingProviderUpdateTime = providerUpdateTimeOverride !== null
      ? providerUpdateTimeOverride
      : live.updateTime;

    // CRITICAL: If match_id not found in array response AND no providerUpdateTimeOverride,
    // we need to check if match should be transitioned to END
    // BUT: If root is null but response has results, log full response for debugging
    const client = await pool.connect();
    try {
      await this.ensureReconcileSchema(client);

      // Read existing timestamps and status for transition detection
      // CRITICAL FIX: Only query 'minute' column since 'match_minute' doesn't exist in schema
      // The ensureReconcileSchema() already detected which column exists (this.minuteColumnName)
      const minuteColumn = this.minuteColumnName || 'minute';
      const existingResult = await client.query(
        `SELECT provider_update_time, last_event_ts, status_id, match_time,
         first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts,
         ${minuteColumn} as minute
         FROM ts_matches WHERE external_id = $1`,
        [match_id]
      );

      if (existingResult.rows.length === 0) {
        // CRITICAL FIX: Auto-insert missing live match
        // If match exists in API response but not in DB, insert it immediately to fix "missing live matches" issue
        const results = (resp as any).results || (resp as any).result_list;
        let apiMatch: any = null;

        if (results && Array.isArray(results)) {
          apiMatch = results.find((m: any) =>
            String(m?.id || m?.match_id) === String(match_id)
          );
        }

        // ===== ENHANCED METADATA RESOLUTION FOR MINOR LEAGUES =====
        // Minor leagues (India, Indonesia, etc.) don't return home_team/away_team/competition objects.
        // We need to extract IDs from the score array and look them up in our database.

        let homeTeamId: string | null = null;
        let awayTeamId: string | null = null;
        let competitionId: string | null = null;
        let matchTime: number = Math.floor(Date.now() / 1000);
        let statusId: number = live.statusId || 1;

        if (apiMatch) {
          // Try to get IDs from various sources
          homeTeamId = apiMatch.home_team?.id || apiMatch.home_team_id || null;
          awayTeamId = apiMatch.away_team?.id || apiMatch.away_team_id || null;
          competitionId = apiMatch.competition?.id || apiMatch.competition_id || null;
          matchTime = apiMatch.match_time || matchTime;
          statusId = live.statusId || apiMatch.status_id || (Array.isArray(apiMatch.score) ? apiMatch.score[1] : 1);
        }

        // If still missing metadata, try fetching from /match/detail
        if (!homeTeamId || !awayTeamId || !competitionId) {
          logger.info(`[DetailLive] Match ${match_id} missing metadata (home=${homeTeamId}, away=${awayTeamId}, comp=${competitionId}). Fetching from /match/detail...`);
          try {
            const detailResp = await this.getMatchDetail(match_id);
            const detailMatch = (detailResp as any)?.results || detailResp;

            if (detailMatch) {
              homeTeamId = homeTeamId || detailMatch.home_team?.id || detailMatch.home_team_id;
              awayTeamId = awayTeamId || detailMatch.away_team?.id || detailMatch.away_team_id;
              competitionId = competitionId || detailMatch.competition?.id || detailMatch.competition_id;
              matchTime = detailMatch.match_time || matchTime;
              logger.info(`[DetailLive] Got metadata from /match/detail: home=${homeTeamId}, away=${awayTeamId}, comp=${competitionId}`);
            }
          } catch (fetchErr: any) {
            logger.warn(`[DetailLive] Failed to fetch /match/detail for ${match_id}: ${fetchErr.message}`);
          }
        }

        // Validate we have minimum required data for insert
        if (homeTeamId && awayTeamId) {
          logger.info(`[DetailLive] Match ${match_id} not found in DB. Auto-inserting with home=${homeTeamId}, away=${awayTeamId}, comp=${competitionId}...`);

          try {
            // Use simplified INSERT that matches actual ts_matches schema
            // Note: ts_matches does NOT have home_team_name/away_team_name columns
            const insertRes = await client.query(`
               INSERT INTO ts_matches (
                 external_id, home_team_id, away_team_id, competition_id, 
                 match_time, status_id, 
                 home_score_regular, away_score_regular,
                 created_at, updated_at
               ) VALUES (
                 $1, $2, $3, $4, 
                 $5, $6,
                 $7, $8,
                 NOW(), NOW()
               )
               ON CONFLICT (external_id) DO UPDATE SET 
                 status_id = EXCLUDED.status_id,
                 home_score_regular = EXCLUDED.home_score_regular,
                 away_score_regular = EXCLUDED.away_score_regular,
                 updated_at = NOW()
               RETURNING external_id
             `, [
              match_id,
              homeTeamId,
              awayTeamId,
              competitionId || null, // Competition can be null for obscure leagues
              matchTime,
              statusId,
              live.homeScoreDisplay ?? 0,
              live.awayScoreDisplay ?? 0
            ]);

            if (insertRes.rowCount != null && insertRes.rowCount > 0) {
              logger.info(`[DetailLive] ✅ Successfully auto-inserted match ${match_id} (home=${homeTeamId}, away=${awayTeamId})`);
              return { updated: true, rowCount: 1, statusId: statusId, score: null, providerUpdateTime: null };
            }
          } catch (err: any) {
            // Log detailed error for debugging
            logger.error(`[DetailLive] Failed to auto-insert match ${match_id}: ${err.message}. Home=${homeTeamId}, Away=${awayTeamId}, Comp=${competitionId}`);
            return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
          }
        } else {
          logger.warn(`[DetailLive] Match ${match_id} not found in DB, and could not resolve team IDs (home=${homeTeamId}, away=${awayTeamId}). Skipping auto-insert.`);
        }
        // ===== END ENHANCED METADATA RESOLUTION =====

        return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
      }

      const existing = existingResult.rows[0];
      const existingStatusId = existing.status_id;
      const matchTime = existing.match_time;
      const nowTs = Math.floor(Date.now() / 1000);

      // CRITICAL FIX: If provider didn't return match data AND match is currently LIVE status,
      // check if enough time has passed to safely transition to END
      if (live.statusId === null && live.homeScoreDisplay === null && live.awayScoreDisplay === null) {
        // Log full response structure for debugging
        const results = (resp as any).results || (resp as any).result_list;
        if (results) {
          logger.warn(
            `[DetailLive] Match ${match_id} not found in detail_live response. ` +
            `Response structure: results type=${Array.isArray(results) ? 'array' : typeof results}, ` +
            `length=${Array.isArray(results) ? results.length : 'N/A'}, ` +
            `keys=${results && typeof results === 'object' ? Object.keys(results).join(',') : 'N/A'}`
          );
        }

        // If we have providerUpdateTimeOverride from data/update, we can still do a minimal update
        // (just provider_update_time and last_event_ts) to track that we processed this update
        if (providerUpdateTimeOverride !== null) {
          logger.info(
            `[DetailLive] No usable data for ${match_id} but providerUpdateTimeOverride provided, ` +
            `performing minimal update (provider_update_time + last_event_ts only)`
          );
          // Continue to minimal update path below
        } else if ([2, 3, 4, 5, 7].includes(existingStatusId) && matchTime !== null) {
          // CRITICAL FIX: Match is LIVE in DB but provider didn't return it
          // This likely means match has finished. Check if enough time has passed (150 minutes)
          // Standard match: 90 minutes + 15 min HT = 105 minutes, with overtime: up to 120 minutes
          // Safety margin: 150 minutes (2.5 hours) from match_time
          const minTimeForEnd = matchTime + (150 * 60); // 150 minutes in seconds

          if (nowTs >= minTimeForEnd) {
            // Match time is old enough (>150 min), safe to transition to END
            logger.info(
              `[DetailLive] Match ${match_id} not found in provider response and match_time (${matchTime}) ` +
              `is ${Math.floor((nowTs - matchTime) / 60)} minutes ago (>150 min). ` +
              `Transitioning from status ${existingStatusId} to END (8).`
            );

            const updateResult = await client.query(
              `UPDATE ts_matches 
               SET status_id = 8, updated_at = NOW(), last_event_ts = $1::BIGINT,
                   ${minuteColumn} = NULL
               WHERE external_id = $2 AND status_id IN (2, 3, 4, 5, 7)`,
              [nowTs, match_id]
            );

            if (updateResult.rowCount && updateResult.rowCount > 0) {
              logEvent('info', 'detail_live.reconcile.done', {
                match_id,
                duration_ms: Date.now() - t0,
                rowCount: updateResult.rowCount,
                status_id: 8,
                reason: 'finished_not_in_provider_response',
              });
              return { updated: true, rowCount: updateResult.rowCount, statusId: 8, score: null, providerUpdateTime: null };
            }
          } else {
            // Match time is not old enough, don't transition to END yet
            logger.info(
              `[DetailLive] Match ${match_id} not found in provider response but match_time (${matchTime}) ` +
              `is only ${Math.floor((nowTs - matchTime) / 60)} minutes ago (<150 min). ` +
              `Not transitioning to END yet. Will retry later.`
            );
            logEvent('warn', 'detail_live.reconcile.no_data', {
              match_id,
              reason: 'match not found in response array - too recent to mark as finished',
              existing_status: existingStatusId,
              minutes_since_match_time: Math.floor((nowTs - matchTime) / 60),
            });
            return { updated: false, rowCount: 0, statusId: null, score: null, providerUpdateTime: null };
          }
        } else {
          // Match is not LIVE or match_time is null - cannot transition to END
          logEvent('warn', 'detail_live.reconcile.no_data', {
            match_id,
            reason: 'match not found in response array',
            existing_status: existingStatusId,
          });
          return { updated: false, rowCount: 0, statusId: null, score: null, providerUpdateTime: null };
        }
      }

      // Continue with normal reconciliation flow below
      // Note: existing, existingStatusId, matchTime, nowTs are already defined above

      // CRITICAL FIX: Convert to numbers to avoid string concatenation bug
      // PostgreSQL BIGINT can be returned as string depending on node-postgres config
      const existingProviderTime = existing.provider_update_time !== null ? Number(existing.provider_update_time) : null;
      let existingEventTime = existing.last_event_ts !== null ? Number(existing.last_event_ts) : null;

      // CRITICAL FIX: Validate timestamps to detect corrupted values
      // Valid Unix timestamp range: 1700000000 to current time + 1 day
      const MAX_VALID_TS = ingestionTs + (24 * 60 * 60); // Current time + 1 day
      const MIN_VALID_TS = 1700000000; // ~2023

      if (existingEventTime !== null && (existingEventTime > MAX_VALID_TS || existingEventTime < MIN_VALID_TS)) {
        logger.warn(
          `[DetailLive] CORRUPTED last_event_ts detected for ${match_id}: ${existingEventTime} ` +
          `(valid range: ${MIN_VALID_TS} - ${MAX_VALID_TS}). Treating as NULL.`
        );
        existingEventTime = null;
      }

      if (existingProviderTime !== null && (existingProviderTime > MAX_VALID_TS || existingProviderTime < MIN_VALID_TS)) {
        logger.warn(
          `[DetailLive] CORRUPTED provider_update_time detected for ${match_id}: ${existingProviderTime} ` +
          `(valid range: ${MIN_VALID_TS} - ${MAX_VALID_TS}). Ignoring for freshness check.`
        );
      }

      // CRITICAL FIX: Allow status transitions even if timestamps suggest stale data
      // Status transitions (e.g., 1→2, 2→3, 3→4) are critical and should always be applied
      const isStatusTransition = live.statusId !== null && live.statusId !== existingStatusId;

      // EXPANDED CRITICAL TRANSITION LOGIC:
      // If we missed a transition (e.g., 1→2), we should still allow 1→3, 1→4, etc.
      // Any transition FROM NOT_STARTED to any LIVE status is critical
      const LIVE_STATUSES = [2, 3, 4, 5, 7]; // FIRST_HALF, HALF_TIME, SECOND_HALF, OVERTIME, PENALTY
      const isCriticalTransition =
        // NOT_STARTED → ANY LIVE STATUS (handles missed transitions)
        (existingStatusId === 1 && LIVE_STATUSES.includes(live.statusId as number)) ||
        // Standard forward transitions
        (existingStatusId === 2 && live.statusId === 3) || // FIRST_HALF → HALF_TIME
        (existingStatusId === 3 && live.statusId === 4) || // HALF_TIME → SECOND_HALF
        (existingStatusId === 4 && live.statusId === 5) || // SECOND_HALF → OVERTIME
        (existingStatusId === 5 && live.statusId === 7) || // OVERTIME → PENALTY
        // Any LIVE → END (final transition)
        (LIVE_STATUSES.includes(existingStatusId) && live.statusId === 8) ||
        // NOT_STARTED → END (match finished without us seeing it live)
        (existingStatusId === 1 && live.statusId === 8);

      // Check freshness (idempotent guard) - but allow critical status transitions
      if (!isCriticalTransition) {
        if (incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined) {
          // Provider supplied update_time - validate before comparing
          const validExistingProviderTime = (existingProviderTime !== null &&
            existingProviderTime >= MIN_VALID_TS && existingProviderTime <= MAX_VALID_TS)
            ? existingProviderTime : null;

          if (validExistingProviderTime !== null && incomingProviderUpdateTime <= validExistingProviderTime) {
            logger.debug(
              `Skipping stale update for ${match_id} (provider time: ${incomingProviderUpdateTime} <= ${validExistingProviderTime})`
            );
            return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
          }
        } else {
          // No provider update_time, use event time comparison (existingEventTime already validated above)
          if (existingEventTime !== null && ingestionTs <= existingEventTime + 5) {
            logger.debug(
              `Skipping stale update for ${match_id} (event time: ${ingestionTs} <= ${existingEventTime + 5})`
            );
            return { updated: false, rowCount: 0, statusId: live.statusId, score: null, providerUpdateTime: null };
          }
        }
      } else {
        // Log critical transition with more detail
        const transitionType = existingStatusId === 1 ? 'MATCH_START' :
          live.statusId === 8 ? 'MATCH_END' : 'STATUS_CHANGE';
        logger.info(
          `[DetailLive] ⚡ CRITICAL TRANSITION (${transitionType}) for ${match_id}: ` +
          `status ${existingStatusId} → ${live.statusId}, score ${live.homeScoreDisplay}-${live.awayScoreDisplay}. ` +
          `Bypassing timestamp check (existingEventTime=${existingEventTime}, existingProviderTime=${existingProviderTime}).`
        );

        // CRITICAL: Save first half stats when transitioning to HALF_TIME
        if (existingStatusId === 2 && live.statusId === 3) {
          logger.info(`[DetailLive] ⚽ HALF_TIME TRANSITION! Saving first half stats for ${match_id}`);
          this.saveFirstHalfStatsOnHalftime(match_id).catch(err => {
            logger.error(`[DetailLive] Failed to save first half stats for ${match_id}:`, err);
          });
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

      // CRITICAL FIX: Track which kickoff timestamps we're setting in this update
      // This allows minute calculation to use the NEW values, not just existing ones
      let firstHalfKickoffToUse = existing.first_half_kickoff_ts;
      let secondHalfKickoffToUse = existing.second_half_kickoff_ts;
      let overtimeKickoffToUse = existing.overtime_kickoff_ts;

      if (hasLiveData && live.statusId !== null) {
        // CRITICAL FIX: Set first_half_kickoff_ts for status 2, 3, 4, 5, 7 if NULL
        // This ensures minute engine can calculate minutes even if transition was missed
        if ((live.statusId === 2 || live.statusId === 3 || live.statusId === 4 || live.statusId === 5 || live.statusId === 7) && existing.first_half_kickoff_ts === null) {
          // CRITICAL FIX: Priority order for first_half_kickoff_ts:
          // 1. live.liveKickoffTime (provider's actual kickoff time from score[4])
          // 2. ingestionTs (current time - maç şu an canlı, bu zamanı kullan)
          // 3. match_time (fallback - planlanan başlangıç zamanı, gerçek başlangıç değil)
          // IMPORTANT: If match is already live (status 2), use ingestionTs, not match_time
          // match_time is the scheduled start time, not the actual start time
          let finalKickoffTime: number;
          let source: string;

          if (live.liveKickoffTime !== null) {
            finalKickoffTime = live.liveKickoffTime;
            source = 'liveKickoff';
          } else if (live.statusId === 2) {
            // Match is currently in FIRST_HALF - use ingestionTs (current time) as best estimate
            // This ensures minute calculation works even if provider doesn't send kickoff time
            finalKickoffTime = ingestionTs;
            source = 'ingestionTs_live';
          } else {
            // For status 3, 4, 5, 7 - match already started, use match_time as fallback
            const existingMatchTimeResult = await client.query(
              `SELECT match_time FROM ts_matches WHERE external_id = $1`,
              [match_id]
            );
            const matchTime = existingMatchTimeResult.rows[0]?.match_time || ingestionTs;
            finalKickoffTime = matchTime;
            source = 'match_time_fallback';
          }

          setParts.push(`first_half_kickoff_ts = $${i++}`);
          values.push(finalKickoffTime);
          firstHalfKickoffToUse = finalKickoffTime; // Track the new value for minute calculation
          logger.info(`[KickoffTS] set first_half_kickoff_ts=${finalKickoffTime} match_id=${match_id} source=${source} status=${live.statusId}`);
        } else if (live.statusId === 2 && (existingStatusId === null || existingStatusId === 1)) {
          // Original transition logic (for logging)
          if (existing.first_half_kickoff_ts === null) {
            // Already handled above, but keep for backward compatibility
            logger.debug(`[KickoffTS] skip (already set) first_half_kickoff_ts match_id=${match_id}`);
          }
        }

        // Status 4 (SECOND_HALF): ALWAYS set second_half_kickoff_ts from provider
        // CRITICAL: TheSports API sends NEW kickoff timestamp for second half in score[4]
        // This value is DIFFERENT from first half - it's the actual second half start time
        // We MUST update it every time for accurate minute calculation
        if (hasLiveData && live.statusId === 4 && live.liveKickoffTime !== null) {
          // Provider sent second half kickoff time - use it
          setParts.push(`second_half_kickoff_ts = $${i++}`);
          values.push(live.liveKickoffTime);
          secondHalfKickoffToUse = live.liveKickoffTime;
          logger.info(`[KickoffTS] set second_half_kickoff_ts=${live.liveKickoffTime} match_id=${match_id} source=provider_score_array status=${live.statusId}`);
        } else if (live.statusId === 4 && existing.second_half_kickoff_ts === null) {
          // Provider didn't send kickoff time, estimate from first half if available
          let secondHalfKickoffValue = kickoffTimeToUse;
          if (existing.first_half_kickoff_ts !== null) {
            // Estimate: first half kickoff + 60 minutes (45 min first half + 15 min break)
            secondHalfKickoffValue = existing.first_half_kickoff_ts + (60 * 60);
            logger.info(`[KickoffTS] Estimating second_half_kickoff_ts=${secondHalfKickoffValue} from first_half_kickoff_ts=${existing.first_half_kickoff_ts} for match_id=${match_id}`);
          }
          setParts.push(`second_half_kickoff_ts = $${i++}`);
          values.push(secondHalfKickoffValue);
          secondHalfKickoffToUse = secondHalfKickoffValue;
          logger.info(`[KickoffTS] set second_half_kickoff_ts=${secondHalfKickoffValue} match_id=${match_id} source=estimated existing_status=${existingStatusId}`);
        }

        // Status 5 (OVERTIME): Set overtime_kickoff_ts if NULL
        // CRITICAL FIX: Don't check existingStatusId - provider says OVERTIME, set it
        // If we missed SECOND_HALF transition, we still need to set overtime_kickoff_ts
        if (live.statusId === 5 && existing.overtime_kickoff_ts === null) {
          setParts.push(`overtime_kickoff_ts = $${i++}`);
          values.push(kickoffTimeToUse);
          overtimeKickoffToUse = kickoffTimeToUse; // Track the new value
          const source = live.liveKickoffTime !== null ? 'liveKickoff' : 'now';
          logger.info(`[KickoffTS] set overtime_kickoff_ts=${kickoffTimeToUse} match_id=${match_id} source=${source} existing_status=${existingStatusId}`);
        } else if (live.statusId === 5 && existing.overtime_kickoff_ts !== null) {
          logger.debug(`[KickoffTS] skip (already set) overtime_kickoff_ts match_id=${match_id}`);
        }
      }

      // Persist provider-supplied live kickoff time once (never overwrite) - legacy column
      if (this.hasLiveKickoffTimeColumn && live.liveKickoffTime !== null) {
        setParts.push(`live_kickoff_time = COALESCE(live_kickoff_time, $${i++})`);
        values.push(live.liveKickoffTime);
      }

      // CRITICAL FIX: Update minute from provider if available (provider-authoritative)
      // Provider's minute value takes precedence over calculated minute
      // If provider doesn't supply minute, calculate from kickoff timestamps (fallback)
      if (this.minuteColumnName) {
        if (live.minute !== null) {
          // Provider says minute = X, use it (even during HT if provider says so)
          setParts.push(`${this.minuteColumnName} = $${i++}`);
          values.push(live.minute);
          logger.debug(`[DetailLive] Setting minute=${live.minute} from provider for match_id=${match_id}`);
        } else {
          // Provider didn't supply minute - calculate from kickoff timestamps if available
          // CRITICAL FIX: Use the NEW kickoff timestamps we're setting in this update (tracked above)
          // BUT: If firstHalfKickoffToUse is still NULL and status is 2, use ingestionTs as fallback
          let effectiveFirstHalfKickoff = firstHalfKickoffToUse;
          if (effectiveFirstHalfKickoff === null && live.statusId === 2) {
            // Match is in FIRST_HALF but first_half_kickoff_ts is NULL - use ingestionTs as best estimate
            effectiveFirstHalfKickoff = ingestionTs;
            logger.warn(`[DetailLive] first_half_kickoff_ts is NULL for status 2 match ${match_id}, using ingestionTs=${ingestionTs} for minute calculation`);
          }

          const calculatedMinute = this.calculateMinuteFromKickoffs(
            live.statusId,
            effectiveFirstHalfKickoff,  // Use new value if we just set it, otherwise existing, or ingestionTs fallback
            secondHalfKickoffToUse,  // Use new value if we just set it, otherwise existing
            overtimeKickoffToUse,    // Use new value if we just set it, otherwise existing
            existing.minute,
            ingestionTs
          );

          if (calculatedMinute !== null) {
            setParts.push(`${this.minuteColumnName} = $${i++}`);
            values.push(calculatedMinute);
            logger.info(`[DetailLive] Setting calculated minute=${calculatedMinute} from kickoff_ts for match_id=${match_id} status=${live.statusId} (first_half_ts=${effectiveFirstHalfKickoff}, second_half_ts=${secondHalfKickoffToUse})`);
          } else {
            // IMPORTANT: During halftime (and some terminal states), we must NOT show a running minute.
            // If we persist minute values during HT, UI can display weird values (e.g., "HT 06:00").
            // We clear minute only if the schema has a minute column AND provider didn't supply a minute.
            const isHalfTime = live.statusId === 3; // TheSports commonly uses 3 = HALF_TIME
            const isFinished = live.statusId === 8 || live.statusId === 9; // defensive (varies by plan); no harm if not used
            if (isHalfTime || isFinished) {
              setParts.push(`${this.minuteColumnName} = NULL`);
            } else {
              // CRITICAL: If we can't calculate minute but match is live, log warning
              logger.warn(`[DetailLive] Cannot calculate minute for match_id=${match_id} status=${live.statusId} - kickoff timestamps missing (first_half=${effectiveFirstHalfKickoff}, second_half=${secondHalfKickoffToUse})`);
            }
          }
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

      // CRITICAL FIX: Update only index 0 of home_scores/away_scores, preserve other indices
      // home_scores format: [current, ht, ot, penalty, corner, ...]
      // We should only update index 0 (current score), not overwrite entire array
      if (live.homeScoreDisplay !== null) {
        // Use jsonb_set to update only index 0, preserving other values (HT, OT, etc.)
        setParts.push(`home_scores = jsonb_set(COALESCE(home_scores, '[0,0,0,0,0,0,0]'::jsonb), '{0}', $${i++}::jsonb)`);
        values.push(JSON.stringify(live.homeScoreDisplay));
      }

      // CRITICAL FIX: Same for away_scores
      if (live.awayScoreDisplay !== null) {
        setParts.push(`away_scores = jsonb_set(COALESCE(away_scores, '[0,0,0,0,0,0,0]'::jsonb), '{0}', $${i++}::jsonb)`);
        values.push(JSON.stringify(live.awayScoreDisplay));
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

  /**
   * Save first half stats when match transitions to HALF_TIME
   * This is called automatically by the DataUpdateWorker when a match reaches halftime
   */
  private async saveFirstHalfStatsOnHalftime(matchId: string): Promise<void> {
    try {
      // Import CombinedStatsService dynamically to avoid circular dependency
      const { CombinedStatsService } = await import('./combinedStats.service');
      const combinedStatsService = new CombinedStatsService();

      // Check if first_half_stats already exists
      const hasStats = await combinedStatsService.hasFirstHalfStats(matchId);
      if (hasStats) {
        logger.debug(`[DetailLive] First half stats already saved for ${matchId}, skipping`);
        return;
      }

      // Fetch current stats from API
      const result = await combinedStatsService.getCombinedMatchStats(matchId);

      if (result && result.allStats && result.allStats.length > 0) {
        await combinedStatsService.saveFirstHalfStats(matchId, result.allStats);
        logger.info(`[DetailLive] ✅ Saved first half stats for ${matchId} (${result.allStats.length} stats)`);
      } else {
        logger.warn(`[DetailLive] No stats available to save for ${matchId} at halftime`);
      }
    } catch (error: any) {
      logger.error(`[DetailLive] Error saving first half stats for ${matchId}:`, error);
    }
  }
}
