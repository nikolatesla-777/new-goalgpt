/**
 * Proactive Match Status Check Worker
 * 
 * CRITICAL FIX: Normal akış çalışmadığı için proaktif kontrol
 * 
 * Sorun:
 * - /data/update çalışmıyor (IP whitelist)
 * - /match/recent/list boş dönüyor (bazı maçlar "recent" değil)
 * - WebSocket bazı maçlar için mesaj göndermiyor
 * 
 * Çözüm:
 * - Bugünkü tüm maçları periyodik olarak kontrol et
 * - match_time geçmiş + status hala NOT_STARTED olanları tespit et
 * - /match/detail_live ile güncel durumu çek ve DB'yi güncelle
 * 
 * Bu, normal akışın çalışmadığı durumlar için "proaktif" bir mekanizma
 */

import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class ProactiveMatchStatusCheckWorker {
  private matchDetailLiveService: MatchDetailLiveService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(matchDetailLiveService: MatchDetailLiveService) {
    this.matchDetailLiveService = matchDetailLiveService;
  }

  /**
   * Check today's matches that should be live but status is still NOT_STARTED
   */
  async checkTodayMatches(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[ProactiveCheck] Already running, skipping');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    let client = null;

    try {
      const nowTs = Math.floor(Date.now() / 1000);
      
      // TSİ-based today start (UTC-3 hours)
      const TSI_OFFSET_SECONDS = 3 * 3600;
      const nowDate = new Date(nowTs * 1000);
      const year = nowDate.getUTCFullYear();
      const month = nowDate.getUTCMonth();
      const day = nowDate.getUTCDate();
      const todayStartTSI = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
      const todayEndTSI = todayStartTSI + 86400; // 24 hours later

      // Find matches that:
      // 1. Are today (TSİ-based)
      // 2. match_time has passed
      // 3. status is still NOT_STARTED (1)
      client = await pool.connect();
      try {
        const query = `
          SELECT 
            external_id,
            match_time,
            status_id,
            provider_update_time,
            last_event_ts
          FROM ts_matches
          WHERE match_time >= $1
            AND match_time < $2
            AND match_time <= $3
            AND status_id = 1
          ORDER BY match_time ASC
          LIMIT 100
        `;

        const result = await client.query(query, [todayStartTSI, todayEndTSI, nowTs]);
        const matches = result.rows;

        if (matches.length === 0) {
          logger.debug('[ProactiveCheck] No matches to check');
          return;
        }

        logger.info(`[ProactiveCheck] Found ${matches.length} matches that should be live`);

        let checkedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const match of matches) {
          try {
            checkedCount++;
            const minutesAgo = Math.floor((nowTs - match.match_time) / 60);

            logEvent('info', 'proactive.check.start', {
              match_id: match.external_id,
              match_time: match.match_time,
              minutes_ago: minutesAgo,
            });

            // CRITICAL FIX: Try detail_live first, then diary as fallback
            let reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(
              match.external_id,
              null
            );

            // If detail_live failed, try diary fallback
            if (reconcileResult.rowCount === 0) {
              try {
                // Extract date from match_time
                const matchDate = new Date(match.match_time * 1000);
                const dateStr = `${matchDate.getUTCFullYear()}${String(matchDate.getUTCMonth() + 1).padStart(2, '0')}${String(matchDate.getUTCDate()).padStart(2, '0')}`;
                
                const { MatchDiaryService } = await import('../services/thesports/match/matchDiary.service');
                const { TheSportsClient } = await import('../services/thesports/client/thesports-client');
                const client = (this.matchDetailLiveService as any).client;
                const diaryService = new MatchDiaryService(client);
                const diaryResponse = await diaryService.getMatchDiary({ date: dateStr, forceRefresh: true } as any);
                const diaryMatch = (diaryResponse.results || []).find((m: any) => 
                  String(m.id || m.external_id || m.match_id) === match.external_id
                );
                
                if (diaryMatch) {
                  const diaryStatusId = diaryMatch.status_id ?? diaryMatch.status ?? null;
                  const diaryHomeScore = diaryMatch.home_score ?? null;
                  const diaryAwayScore = diaryMatch.away_score ?? null;
                  const diaryMinute = diaryMatch.minute !== null && diaryMatch.minute !== undefined ? Number(diaryMatch.minute) : null;
                  
                  // CRITICAL: Update if status changed OR score/minute changed (even if status still 1)
                  const dbClient = await pool.connect();
                  try {
                    const existingResult = await dbClient.query(
                      `SELECT provider_update_time, status_id, home_score_regular, away_score_regular, minute FROM ts_matches WHERE external_id = $1`,
                      [match.external_id]
                    );
                    
                    if (existingResult.rows.length > 0) {
                      const existing = existingResult.rows[0];
                      const ingestionTs = Math.floor(Date.now() / 1000);
                      
                      // Update if:
                      // 1. Status changed (diaryStatusId != 1 and != existing.status_id)
                      // 2. Score changed (even if status still 1)
                      // 3. Minute changed (even if status still 1)
                      const statusChanged = diaryStatusId !== null && diaryStatusId !== 1 && diaryStatusId !== existing.status_id;
                      const scoreChanged = (diaryHomeScore !== null && diaryHomeScore !== existing.home_score_regular) ||
                                         (diaryAwayScore !== null && diaryAwayScore !== existing.away_score_regular);
                      const minuteChanged = diaryMinute !== null && diaryMinute !== existing.minute;
                      
                      if (statusChanged || scoreChanged || minuteChanged) {
                        const updateQuery = `
                          UPDATE ts_matches
                          SET 
                            status_id = COALESCE($1, status_id),
                            home_score_regular = COALESCE($2, home_score_regular),
                            away_score_regular = COALESCE($3, away_score_regular),
                            minute = COALESCE($4, minute),
                            provider_update_time = GREATEST(COALESCE(provider_update_time, 0)::BIGINT, $5::BIGINT),
                            last_event_ts = $6::BIGINT,
                            updated_at = NOW()
                          WHERE external_id = $7
                            AND (
                              status_id = 1 
                              OR provider_update_time IS NULL 
                              OR provider_update_time < $5
                              OR home_score_regular IS DISTINCT FROM $2
                              OR away_score_regular IS DISTINCT FROM $3
                              OR minute IS DISTINCT FROM $4
                            )
                        `;
                        const updateResult = await dbClient.query(updateQuery, [
                          diaryStatusId,
                          diaryHomeScore,
                          diaryAwayScore,
                          diaryMinute,
                          ingestionTs,
                          ingestionTs,
                          match.external_id,
                        ]);
                        
                        if (updateResult.rowCount > 0) {
                          reconcileResult = { updated: true, rowCount: updateResult.rowCount, statusId: diaryStatusId, score: null };
                        }
                      }
                    }
                  } finally {
                    dbClient.release();
                  }
                }
              } catch (diaryError: any) {
                logger.debug(`[ProactiveCheck] Diary fallback failed for ${match.external_id}:`, diaryError.message);
              }
            }

            if (reconcileResult.rowCount > 0) {
              updatedCount++;
              logEvent('info', 'proactive.check.success', {
                match_id: match.external_id,
                minutes_ago: minutesAgo,
                row_count: reconcileResult.rowCount,
                source: reconcileResult.rowCount > 0 ? 'detail_live_or_diary' : 'none',
              });
            } else {
              logEvent('info', 'proactive.check.no_update', {
                match_id: match.external_id,
                minutes_ago: minutesAgo,
                reason: 'no_update_from_detail_live_or_diary',
              });
            }

            // Throttle: 200ms between API calls
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error: any) {
            errorCount++;
            logger.error(`[ProactiveCheck] Error checking match ${match.external_id}:`, error);
            logEvent('error', 'proactive.check.error', {
              match_id: match.external_id,
              error_message: error.message || 'Unknown error',
            });
          }
        }

        const duration = Date.now() - startedAt;
        logger.info(
          `[ProactiveCheck] Completed: ${checkedCount} checked, ${updatedCount} updated, ${errorCount} errors (${duration}ms)`
        );

        logEvent('info', 'proactive.check.summary', {
          checked_count: checkedCount,
          updated_count: updatedCount,
          error_count: errorCount,
          duration_ms: duration,
        });
      } finally {
        if (client) {
          client.release();
        }
      }
    } catch (error: any) {
      logger.error('[ProactiveCheck] Fatal error:', error);
      logEvent('error', 'proactive.check.fatal', {
        error_message: error.message || 'Unknown error',
        error_stack: error.stack,
      });
    } finally {
      // CRITICAL FIX: Always reset isRunning flag, even if error occurred
      this.isRunning = false;
      logger.debug('[ProactiveCheck] Reset isRunning flag');
    }
  }

  /**
   * Start the worker
   * Runs every 20 seconds to proactively check today's matches (more aggressive)
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('[ProactiveCheck] Already started');
      return;
    }

    // CRITICAL FIX: Run every 20 seconds (more aggressive for real-time updates)
    this.intervalId = setInterval(() => {
      this.checkTodayMatches().catch(err => {
        logger.error('[ProactiveCheck] Interval error:', err);
      });
    }, 20000); // 20 seconds (was 30)

    // Run immediately on start
    setTimeout(() => {
      this.checkTodayMatches().catch(err => {
        logger.error('[ProactiveCheck] Initial run error:', err);
      });
    }, 5000); // Wait 5 seconds after startup

    logger.info('[ProactiveCheck] Worker started (20s interval)');
    logEvent('info', 'worker.started', {
      worker: 'ProactiveMatchStatusCheckWorker',
      interval_sec: 20,
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[ProactiveCheck] Worker stopped');
    }
  }
}

