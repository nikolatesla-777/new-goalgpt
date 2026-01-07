/**
 * Prediction Settlement Service
 *
 * TEK MERKEZİ SONUÇLANDIRMA SERVİSİ
 * Tüm tahmin sonuçlandırma logic'i buradan yönetilir.
 *
 * KURALLAR:
 * - IY (İlk Yarı) tahminleri: minute <= 45 → Devre arasında (status=3) HT skoru ile sonuçlanır
 * - MS (Maç Sonu) tahminleri: minute > 45 → Maç sonunda (status=8) final skoru ile sonuçlanır
 * - Instant Win: Gol anında threshold aşıldıysa anında WON işaretlenir
 *
 * ÖZELLİKLER:
 * - Deduplication: Aynı event 5 saniye içinde tekrar işlenmez
 * - Database Lock: SELECT ... FOR UPDATE ile race condition önlenir
 * - Period-Aware: IY/MS tahminleri ayrı ayrı sonuçlandırılır
 */

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { logEvent } from '../../utils/obsLogger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SettlementEvent {
  matchId: string;
  eventType: 'goal' | 'halftime' | 'fulltime' | 'score_change';
  homeScore: number;
  awayScore: number;
  htHome?: number;
  htAway?: number;
  minute?: number;
  statusId?: number;
  timestamp: number;
}

export interface SettlementResult {
  settled: number;
  winners: number;
  losers: number;
  skipped?: boolean;
  reason?: string;
}

interface PendingPrediction {
  id: string;
  minute_at_prediction: number;
  score_at_prediction: string;
}

// ============================================================================
// PREDICTION SETTLEMENT SERVICE
// ============================================================================

class PredictionSettlementService {
  private recentSettlements: Map<string, number> = new Map();
  private readonly DEDUP_WINDOW_MS = 5000; // 5 saniye deduplication penceresi
  private readonly CACHE_CLEANUP_INTERVAL_MS = 60000; // 1 dakikada bir cache temizliği

  constructor() {
    // Periyodik olarak eski cache entry'lerini temizle
    setInterval(() => this.cleanupCache(), this.CACHE_CLEANUP_INTERVAL_MS);
  }

  // ==========================================================================
  // ANA GİRİŞ NOKTASI
  // ==========================================================================

  /**
   * Ana event işleyici - Tüm settlement'lar buradan geçer
   */
  async processEvent(event: SettlementEvent): Promise<SettlementResult> {
    const startTime = Date.now();

    try {
      // 1. Validation
      if (!event.matchId) {
        logger.warn('[Settlement] Event rejected: missing matchId');
        return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'missing_match_id' };
      }

      // 2. Deduplication check
      if (this.isDuplicate(event)) {
        logger.debug(`[Settlement] Duplicate event skipped: ${event.matchId}:${event.eventType}`);
        return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'duplicate' };
      }

      // 3. Route to appropriate handler
      let result: SettlementResult;

      switch (event.eventType) {
        case 'goal':
        case 'score_change':
          result = await this.handleGoal(event);
          break;
        case 'halftime':
          result = await this.handleHalftime(event);
          break;
        case 'fulltime':
          result = await this.handleFulltime(event);
          break;
        default:
          logger.warn(`[Settlement] Unknown event type: ${event.eventType}`);
          return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'unknown_event_type' };
      }

      // 4. Log result
      const duration = Date.now() - startTime;
      if (result.settled > 0) {
        logEvent('info', 'settlement.processed', {
          match_id: event.matchId,
          event_type: event.eventType,
          settled: result.settled,
          winners: result.winners,
          losers: result.losers,
          duration_ms: duration,
        });
      }

      return result;

    } catch (error: any) {
      logger.error(`[Settlement] Error processing event for ${event.matchId}:`, error);
      logEvent('error', 'settlement.error', {
        match_id: event.matchId,
        event_type: event.eventType,
        error_message: error.message,
      });
      return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'error' };
    }
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Gol olayı handler - Instant Win kontrolü
   *
   * Sadece threshold aşıldıysa WON işaretler (LOST işaretlemez!)
   * IY tahminleri: Sadece 1. yarıda atılan gollerde kontrol edilir
   * MS tahminleri: Her gol sonrası kontrol edilir
   */
  private async handleGoal(event: SettlementEvent): Promise<SettlementResult> {
    const client = await pool.connect();
    let settled = 0;

    try {
      await client.query('BEGIN');

      // FOR UPDATE ile lock al - race condition önlenir
      const pending = await client.query<PendingPrediction>(`
        SELECT id, minute_at_prediction, score_at_prediction
        FROM ai_predictions
        WHERE match_id = $1 AND result = 'pending'
        FOR UPDATE
      `, [event.matchId]);

      if (pending.rows.length === 0) {
        await client.query('COMMIT');
        return { settled: 0, winners: 0, losers: 0 };
      }

      const totalGoals = event.homeScore + event.awayScore;
      const currentMinute = event.minute ?? 90; // Default to 90 if minute not provided

      for (const row of pending.rows) {
        const period = row.minute_at_prediction <= 45 ? 'IY' : 'MS';
        const threshold = this.calculateThreshold(row.score_at_prediction);

        // Instant win kontrolü - threshold aşıldı mı?
        if (totalGoals > threshold) {
          // IY tahminleri için: Sadece 1. yarıda gol atılmışsa kontrol et
          // (2. yarıda atılan goller IY tahminini etkilemez)
          if (period === 'IY') {
            if (currentMinute <= 45) {
              await this.markWon(client, row.id, 'instant_win_iy');
              settled++;
              logger.info(`[Settlement] INSTANT WIN (IY): ${row.id} - ${totalGoals} goals > ${threshold} threshold`);
            }
            // else: 2. yarıda gol, IY tahmini için instant win yok
          }
          // MS tahminleri için: Her gol sonrası kontrol et
          else if (period === 'MS') {
            await this.markWon(client, row.id, 'instant_win_ms');
            settled++;
            logger.info(`[Settlement] INSTANT WIN (MS): ${row.id} - ${totalGoals} goals > ${threshold} threshold`);
          }
        }
      }

      await client.query('COMMIT');

      // Stats view'ları güncelle
      if (settled > 0) {
        this.refreshStatsAsync();
      }

      return { settled, winners: settled, losers: 0 };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Devre arası handler - IY tahminlerini sonuçlandır
   *
   * Status 3 (HALF_TIME) geldiğinde çağrılır
   * Sadece minute <= 45 olan tahminleri sonuçlandırır
   */
  private async handleHalftime(event: SettlementEvent): Promise<SettlementResult> {
    const client = await pool.connect();
    let winners = 0, losers = 0;

    try {
      await client.query('BEGIN');

      // Sadece IY tahminlerini al (minute <= 45)
      const pending = await client.query<PendingPrediction>(`
        SELECT id, minute_at_prediction, score_at_prediction
        FROM ai_predictions
        WHERE match_id = $1
          AND result = 'pending'
          AND minute_at_prediction <= 45
        FOR UPDATE
      `, [event.matchId]);

      if (pending.rows.length === 0) {
        await client.query('COMMIT');
        logger.debug(`[Settlement] HT: No pending IY predictions for ${event.matchId}`);
        return { settled: 0, winners: 0, losers: 0 };
      }

      const htTotal = event.homeScore + event.awayScore;
      logger.info(`[Settlement] HT Settlement for ${event.matchId}: HT Score ${event.homeScore}-${event.awayScore}, ${pending.rows.length} IY predictions`);

      for (const row of pending.rows) {
        const threshold = this.calculateThreshold(row.score_at_prediction);

        if (htTotal > threshold) {
          await this.markWon(client, row.id, 'halftime_settlement');
          winners++;
          logger.info(`[Settlement] HT WON: ${row.id} - HT ${htTotal} > ${threshold}`);
        } else {
          await this.markLost(client, row.id, 'halftime_settlement');
          losers++;
          logger.info(`[Settlement] HT LOST: ${row.id} - HT ${htTotal} <= ${threshold}`);
        }
      }

      await client.query('COMMIT');

      // Stats view'ları güncelle
      if (winners + losers > 0) {
        this.refreshStatsAsync();
      }

      return { settled: winners + losers, winners, losers };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Maç sonu handler - MS tahminlerini sonuçlandır
   *
   * Status 8 (END) geldiğinde çağrılır
   * Sadece minute > 45 olan tahminleri sonuçlandırır
   */
  private async handleFulltime(event: SettlementEvent): Promise<SettlementResult> {
    const client = await pool.connect();
    let winners = 0, losers = 0;

    try {
      await client.query('BEGIN');

      // Sadece MS tahminlerini al (minute > 45)
      const pending = await client.query<PendingPrediction>(`
        SELECT id, minute_at_prediction, score_at_prediction
        FROM ai_predictions
        WHERE match_id = $1
          AND result = 'pending'
          AND minute_at_prediction > 45
        FOR UPDATE
      `, [event.matchId]);

      if (pending.rows.length === 0) {
        await client.query('COMMIT');
        logger.debug(`[Settlement] FT: No pending MS predictions for ${event.matchId}`);
        return { settled: 0, winners: 0, losers: 0 };
      }

      const finalTotal = event.homeScore + event.awayScore;
      logger.info(`[Settlement] FT Settlement for ${event.matchId}: Final Score ${event.homeScore}-${event.awayScore}, ${pending.rows.length} MS predictions`);

      for (const row of pending.rows) {
        const threshold = this.calculateThreshold(row.score_at_prediction);

        if (finalTotal > threshold) {
          await this.markWon(client, row.id, 'fulltime_settlement');
          winners++;
          logger.info(`[Settlement] FT WON: ${row.id} - Final ${finalTotal} > ${threshold}`);
        } else {
          await this.markLost(client, row.id, 'fulltime_settlement');
          losers++;
          logger.info(`[Settlement] FT LOST: ${row.id} - Final ${finalTotal} <= ${threshold}`);
        }
      }

      await client.query('COMMIT');

      // Stats view'ları güncelle
      if (winners + losers > 0) {
        this.refreshStatsAsync();
      }

      return { settled: winners + losers, winners, losers };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Threshold hesapla (Over X.5 logic)
   * "0-0" → 0.5
   * "1-1" → 2.5
   * "2-0" → 2.5
   */
  private calculateThreshold(scoreAtPrediction: string): number {
    const parts = scoreAtPrediction.split('-');
    const predHome = parseInt(parts[0]?.trim() || '0', 10) || 0;
    const predAway = parseInt(parts[1]?.trim() || '0', 10) || 0;
    return predHome + predAway + 0.5;
  }

  /**
   * Tahmini WON olarak işaretle
   */
  private async markWon(client: any, predictionId: string, reason: string): Promise<void> {
    await client.query(`
      UPDATE ai_predictions
      SET result = 'won', resulted_at = NOW()
      WHERE id = $1 AND result = 'pending'
    `, [predictionId]);

    logEvent('info', 'settlement.won', {
      prediction_id: predictionId,
      reason,
    });
  }

  /**
   * Tahmini LOST olarak işaretle
   */
  private async markLost(client: any, predictionId: string, reason: string): Promise<void> {
    await client.query(`
      UPDATE ai_predictions
      SET result = 'lost', resulted_at = NOW()
      WHERE id = $1 AND result = 'pending'
    `, [predictionId]);

    logEvent('info', 'settlement.lost', {
      prediction_id: predictionId,
      reason,
    });
  }

  /**
   * Deduplication kontrolü
   * Aynı matchId:eventType kombinasyonu 5 saniye içinde tekrar gelirse skip et
   */
  private isDuplicate(event: SettlementEvent): boolean {
    const key = `${event.matchId}:${event.eventType}`;
    const lastTime = this.recentSettlements.get(key);

    if (lastTime && (Date.now() - lastTime) < this.DEDUP_WINDOW_MS) {
      return true;
    }

    this.recentSettlements.set(key, Date.now());
    return false;
  }

  /**
   * Cache temizliği - Eski entry'leri sil
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expireTime = this.DEDUP_WINDOW_MS * 2; // 10 saniyeden eski olanları sil

    for (const [key, timestamp] of this.recentSettlements.entries()) {
      if (now - timestamp > expireTime) {
        this.recentSettlements.delete(key);
      }
    }
  }

  /**
   * Stats view'ları async olarak güncelle (blocking değil)
   */
  private refreshStatsAsync(): void {
    pool.query('SELECT refresh_prediction_stats()')
      .then(() => logger.debug('[Settlement] Stats views refreshed'))
      .catch(err => logger.warn('[Settlement] Stats refresh failed:', err.message));
  }

  // ==========================================================================
  // BACKWARD COMPATIBILITY
  // ==========================================================================

  /**
   * Legacy settleInstantWin wrapper
   * @deprecated Use processEvent instead
   */
  async settleInstantWin(
    matchExternalId: string,
    homeScore: number,
    awayScore: number,
    minute?: number,
    statusId?: number
  ): Promise<void> {
    logger.debug(`[Settlement] Legacy settleInstantWin called for ${matchExternalId}`);

    await this.processEvent({
      matchId: matchExternalId,
      eventType: 'goal',
      homeScore,
      awayScore,
      minute,
      statusId,
      timestamp: Date.now(),
    });
  }

  /**
   * Legacy settleMatchPredictions wrapper
   * @deprecated Use processEvent instead
   */
  async settleMatchPredictions(
    matchExternalId: string,
    homeScore?: number,
    awayScore?: number,
    htHome?: number,
    htAway?: number
  ): Promise<{ settled: number; winners: number; losers: number }> {
    logger.debug(`[Settlement] Legacy settleMatchPredictions called for ${matchExternalId}`);

    // Skorlar verilmediyse database'den al
    let finalHome = homeScore;
    let finalAway = awayScore;
    let halfTimeHome = htHome;
    let halfTimeAway = htAway;

    if (finalHome === undefined || finalAway === undefined) {
      const matchResult = await pool.query(`
        SELECT
          home_score_display, away_score_display,
          (home_scores->>1)::INTEGER as home_score_half,
          (away_scores->>1)::INTEGER as away_score_half,
          status_id
        FROM ts_matches
        WHERE external_id = $1
      `, [matchExternalId]);

      if (matchResult.rows.length > 0) {
        const match = matchResult.rows[0];
        finalHome = match.home_score_display ?? 0;
        finalAway = match.away_score_display ?? 0;
        halfTimeHome = halfTimeHome ?? match.home_score_half ?? null;
        halfTimeAway = halfTimeAway ?? match.away_score_half ?? null;
      } else {
        logger.warn(`[Settlement] No match found for ${matchExternalId}`);
        return { settled: 0, winners: 0, losers: 0 };
      }
    }

    // Fulltime settlement işle
    const result = await this.processEvent({
      matchId: matchExternalId,
      eventType: 'fulltime',
      homeScore: finalHome!,
      awayScore: finalAway!,
      htHome: halfTimeHome,
      htAway: halfTimeAway,
      timestamp: Date.now(),
    });

    return {
      settled: result.settled,
      winners: result.winners,
      losers: result.losers,
    };
  }
}

// Singleton export
export const predictionSettlementService = new PredictionSettlementService();
