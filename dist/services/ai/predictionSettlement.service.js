"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictionSettlementService = void 0;
exports.setOnPredictionSettled = setOnPredictionSettled;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const obsLogger_1 = require("../../utils/obsLogger");
// Callback for WebSocket broadcast (set by server.ts)
let onPredictionSettled = null;
function setOnPredictionSettled(callback) {
    onPredictionSettled = callback;
}
// ============================================================================
// PREDICTION SETTLEMENT SERVICE
// ============================================================================
class PredictionSettlementService {
    constructor() {
        this.recentSettlements = new Map();
        this.DEDUP_WINDOW_MS = 5000; // 5 saniye deduplication penceresi
        this.CACHE_CLEANUP_INTERVAL_MS = 60000; // 1 dakikada bir cache temizliği
        // Periyodik olarak eski cache entry'lerini temizle
        setInterval(() => this.cleanupCache(), this.CACHE_CLEANUP_INTERVAL_MS);
    }
    // ==========================================================================
    // ANA GİRİŞ NOKTASI
    // ==========================================================================
    /**
     * Ana event işleyici - Tüm settlement'lar buradan geçer
     */
    async processEvent(event) {
        const startTime = Date.now();
        try {
            // 1. Validation
            if (!event.matchId) {
                logger_1.logger.warn('[Settlement] Event rejected: missing matchId');
                return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'missing_match_id' };
            }
            // 2. Deduplication check
            if (this.isDuplicate(event)) {
                logger_1.logger.debug(`[Settlement] Duplicate event skipped: ${event.matchId}:${event.eventType}`);
                return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'duplicate' };
            }
            // 3. Route to appropriate handler
            let result;
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
                    logger_1.logger.warn(`[Settlement] Unknown event type: ${event.eventType}`);
                    return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'unknown_event_type' };
            }
            // 4. Log result
            const duration = Date.now() - startTime;
            if (result.settled > 0) {
                (0, obsLogger_1.logEvent)('info', 'settlement.processed', {
                    match_id: event.matchId,
                    event_type: event.eventType,
                    settled: result.settled,
                    winners: result.winners,
                    losers: result.losers,
                    duration_ms: duration,
                });
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error(`[Settlement] Error processing event for ${event.matchId}:`, error);
            (0, obsLogger_1.logEvent)('error', 'settlement.error', {
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
    async handleGoal(event) {
        const client = await connection_1.pool.connect();
        let settled = 0;
        try {
            await client.query('BEGIN');
            // FOR UPDATE ile lock al - race condition önlenir
            // Phase 2: prediction_threshold kolonunu direkt kullan
            const pending = await client.query(`
        SELECT id, minute_at_prediction, score_at_prediction,
               prediction, prediction_threshold,
               canonical_bot_name, home_team_name, away_team_name
        FROM ai_predictions
        WHERE match_id = $1 AND result = 'pending'
        FOR UPDATE
      `, [event.matchId]);
            if (pending.rows.length === 0) {
                await client.query('COMMIT');
                return { settled: 0, winners: 0, losers: 0 };
            }
            const totalGoals = event.homeScore + event.awayScore;
            const currentMinute = event.minute ?? 90;
            const currentScore = `${event.homeScore}-${event.awayScore}`;
            for (const row of pending.rows) {
                const period = row.minute_at_prediction <= 45 ? 'IY' : 'MS';
                // Phase 2: prediction_threshold kolonunu kullan (hesaplama yok!)
                const threshold = row.prediction_threshold;
                // Instant win kontrolü - threshold aşıldı mı?
                if (totalGoals > threshold) {
                    // IY tahminleri için: Sadece 1. yarıda gol atılmışsa kontrol et
                    if (period === 'IY') {
                        if (currentMinute <= 45) {
                            // INSTANT WIN: final_score'u kaydetme - maç bittiğinde güncellenecek
                            await this.markWon(client, row.id, 'instant_win_iy', undefined);
                            settled++;
                            logger_1.logger.info(`[Settlement] INSTANT WIN (IY): ${row.id} - ${totalGoals} goals > ${threshold} threshold (score at win: ${currentScore})`);
                            // Phase 3: WebSocket broadcast
                            this.broadcastSettlement({
                                predictionId: row.id,
                                matchId: event.matchId,
                                botName: row.canonical_bot_name,
                                prediction: row.prediction,
                                result: 'won',
                                resultReason: 'instant_win_iy',
                                homeTeam: row.home_team_name,
                                awayTeam: row.away_team_name,
                                finalScore: currentScore, // UI için geçici skor
                                timestamp: Date.now(),
                            });
                        }
                    }
                    // MS tahminleri için: Her gol sonrası kontrol et
                    else if (period === 'MS') {
                        // INSTANT WIN: final_score'u kaydetme - maç bittiğinde güncellenecek
                        await this.markWon(client, row.id, 'instant_win_ms', undefined);
                        settled++;
                        logger_1.logger.info(`[Settlement] INSTANT WIN (MS): ${row.id} - ${totalGoals} goals > ${threshold} threshold (score at win: ${currentScore})`);
                        // Phase 3: WebSocket broadcast
                        this.broadcastSettlement({
                            predictionId: row.id,
                            matchId: event.matchId,
                            botName: row.canonical_bot_name,
                            prediction: row.prediction,
                            result: 'won',
                            resultReason: 'instant_win_ms',
                            homeTeam: row.home_team_name,
                            awayTeam: row.away_team_name,
                            finalScore: currentScore, // UI için geçici skor
                            timestamp: Date.now(),
                        });
                    }
                }
            }
            await client.query('COMMIT');
            // Stats view'ları güncelle
            if (settled > 0) {
                this.refreshStatsAsync();
            }
            return { settled, winners: settled, losers: 0 };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Devre arası handler - IY tahminlerini sonuçlandır
     *
     * Status 3 (HALF_TIME) geldiğinde çağrılır
     * Sadece minute <= 45 olan tahminleri sonuçlandırır
     *
     * BUGFIX (2026-01-20): Verify match status from DB before settling
     * This prevents false settlements from stale/incorrect status data
     */
    async handleHalftime(event) {
        const client = await connection_1.pool.connect();
        let winners = 0, losers = 0;
        try {
            await client.query('BEGIN');
            // BUGFIX: Verify match is actually at halftime before settling
            const matchCheck = await client.query(`
        SELECT status_id FROM ts_matches WHERE external_id = $1
      `, [event.matchId]);
            if (matchCheck.rows.length > 0) {
                const actualStatus = matchCheck.rows[0].status_id;
                // Only allow halftime settlement if match is at status 3 or later
                // Status 3 = HT, 4 = 2nd half, 5 = OT, 7 = Penalties, 8 = Ended
                if (actualStatus !== null && actualStatus < 3) {
                    await client.query('COMMIT');
                    logger_1.logger.warn(`[Settlement] HT: Match ${event.matchId} is NOT at halftime (status=${actualStatus}). Skipping settlement.`);
                    return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'match_not_at_halftime' };
                }
            }
            // Sadece IY tahminlerini al (minute <= 45)
            // Phase 2: prediction_threshold kolonunu direkt kullan
            const pending = await client.query(`
        SELECT id, minute_at_prediction, score_at_prediction,
               prediction, prediction_threshold,
               canonical_bot_name, home_team_name, away_team_name
        FROM ai_predictions
        WHERE match_id = $1
          AND result = 'pending'
          AND minute_at_prediction <= 45
        FOR UPDATE
      `, [event.matchId]);
            if (pending.rows.length === 0) {
                await client.query('COMMIT');
                logger_1.logger.debug(`[Settlement] HT: No pending IY predictions for ${event.matchId}`);
                return { settled: 0, winners: 0, losers: 0 };
            }
            const htTotal = event.homeScore + event.awayScore;
            const htScore = `${event.homeScore}-${event.awayScore}`;
            logger_1.logger.info(`[Settlement] HT Settlement for ${event.matchId}: HT Score ${htScore}, ${pending.rows.length} IY predictions`);
            for (const row of pending.rows) {
                // Phase 2: prediction_threshold kolonunu kullan
                const threshold = row.prediction_threshold;
                if (htTotal > threshold) {
                    await this.markWon(client, row.id, 'halftime_settlement', htScore);
                    winners++;
                    logger_1.logger.info(`[Settlement] HT WON: ${row.id} - HT ${htTotal} > ${threshold}`);
                    // Phase 3: WebSocket broadcast
                    this.broadcastSettlement({
                        predictionId: row.id,
                        matchId: event.matchId,
                        botName: row.canonical_bot_name,
                        prediction: row.prediction,
                        result: 'won',
                        resultReason: 'halftime_settlement',
                        homeTeam: row.home_team_name,
                        awayTeam: row.away_team_name,
                        finalScore: htScore,
                        timestamp: Date.now(),
                    });
                }
                else {
                    await this.markLost(client, row.id, 'halftime_threshold_not_met', htScore);
                    losers++;
                    logger_1.logger.info(`[Settlement] HT LOST: ${row.id} - HT ${htTotal} <= ${threshold}`);
                    // Phase 3: WebSocket broadcast
                    this.broadcastSettlement({
                        predictionId: row.id,
                        matchId: event.matchId,
                        botName: row.canonical_bot_name,
                        prediction: row.prediction,
                        result: 'lost',
                        resultReason: 'halftime_threshold_not_met',
                        homeTeam: row.home_team_name,
                        awayTeam: row.away_team_name,
                        finalScore: htScore,
                        timestamp: Date.now(),
                    });
                }
            }
            await client.query('COMMIT');
            // Stats view'ları güncelle
            if (winners + losers > 0) {
                this.refreshStatsAsync();
            }
            return { settled: winners + losers, winners, losers };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Maç sonu handler - MS tahminlerini sonuçlandır
     *
     * Status 8 (END) geldiğinde çağrılır
     * Sadece minute > 45 olan tahminleri sonuçlandırır
     *
     * BUGFIX (2026-01-20): Verify match status from DB before settling
     */
    async handleFulltime(event) {
        const client = await connection_1.pool.connect();
        let winners = 0, losers = 0;
        try {
            await client.query('BEGIN');
            // BUGFIX: Verify match has actually ended before settling
            const matchCheck = await client.query(`
        SELECT status_id FROM ts_matches WHERE external_id = $1
      `, [event.matchId]);
            if (matchCheck.rows.length > 0) {
                const actualStatus = matchCheck.rows[0].status_id;
                // Only allow fulltime settlement if match is at status 8 (ended)
                if (actualStatus !== null && actualStatus !== 8) {
                    await client.query('COMMIT');
                    logger_1.logger.warn(`[Settlement] FT: Match ${event.matchId} has NOT ended (status=${actualStatus}). Skipping settlement.`);
                    return { settled: 0, winners: 0, losers: 0, skipped: true, reason: 'match_not_ended' };
                }
            }
            // Veritabanından gerçek final skorunu al (COALESCE ile NULL kontrolü)
            // home_scores JSON dizisi: [0]=current, [4]=regular time score
            // Önce display, sonra JSON array, sonra event'ten gelen skor
            const matchResult = await client.query(`
        SELECT
          COALESCE(
            home_score_display, 
            (home_scores->>0)::INTEGER,
            $2
          ) as home_final,
          COALESCE(
            away_score_display, 
            (away_scores->>0)::INTEGER,
            $3
          ) as away_final
        FROM ts_matches
        WHERE external_id = $1
      `, [event.matchId, event.homeScore, event.awayScore]);
            // Veritabanından skor alınamazsa event'ten gelen skoru kullan
            let homeScore = event.homeScore;
            let awayScore = event.awayScore;
            if (matchResult.rows.length > 0) {
                homeScore = matchResult.rows[0].home_final ?? event.homeScore;
                awayScore = matchResult.rows[0].away_final ?? event.awayScore;
            }
            // Sadece MS tahminlerini al (minute > 45)
            // Phase 2: prediction_threshold kolonunu direkt kullan
            const pending = await client.query(`
        SELECT id, minute_at_prediction, score_at_prediction,
               prediction, prediction_threshold,
               canonical_bot_name, home_team_name, away_team_name
        FROM ai_predictions
        WHERE match_id = $1
          AND result = 'pending'
          AND minute_at_prediction > 45
        FOR UPDATE
      `, [event.matchId]);
            if (pending.rows.length === 0) {
                await client.query('COMMIT');
                logger_1.logger.debug(`[Settlement] FT: No pending MS predictions for ${event.matchId}`);
                return { settled: 0, winners: 0, losers: 0 };
            }
            const finalTotal = homeScore + awayScore;
            const finalScore = `${homeScore}-${awayScore}`;
            logger_1.logger.info(`[Settlement] FT Settlement for ${event.matchId}: Final Score ${finalScore} (from DB), ${pending.rows.length} MS predictions`);
            for (const row of pending.rows) {
                // Phase 2: prediction_threshold kolonunu kullan
                const threshold = row.prediction_threshold;
                if (finalTotal > threshold) {
                    await this.markWon(client, row.id, 'fulltime_settlement', finalScore);
                    winners++;
                    logger_1.logger.info(`[Settlement] FT WON: ${row.id} - Final ${finalTotal} > ${threshold}`);
                    // Phase 3: WebSocket broadcast
                    this.broadcastSettlement({
                        predictionId: row.id,
                        matchId: event.matchId,
                        botName: row.canonical_bot_name,
                        prediction: row.prediction,
                        result: 'won',
                        resultReason: 'fulltime_settlement',
                        homeTeam: row.home_team_name,
                        awayTeam: row.away_team_name,
                        finalScore: finalScore,
                        timestamp: Date.now(),
                    });
                }
                else {
                    await this.markLost(client, row.id, 'fulltime_threshold_not_met', finalScore);
                    losers++;
                    logger_1.logger.info(`[Settlement] FT LOST: ${row.id} - Final ${finalTotal} <= ${threshold}`);
                    // Phase 3: WebSocket broadcast
                    this.broadcastSettlement({
                        predictionId: row.id,
                        matchId: event.matchId,
                        botName: row.canonical_bot_name,
                        prediction: row.prediction,
                        result: 'lost',
                        resultReason: 'fulltime_threshold_not_met',
                        homeTeam: row.home_team_name,
                        awayTeam: row.away_team_name,
                        finalScore: finalScore,
                        timestamp: Date.now(),
                    });
                }
            }
            // Maç bittiğinde TÜM tahminlerin (instant win dahil) final_score'unu güncelle
            await this.updateAllFinalScores(client, event.matchId, finalScore);
            await client.query('COMMIT');
            // Stats view'ları güncelle
            if (winners + losers > 0) {
                this.refreshStatsAsync();
            }
            return { settled: winners + losers, winners, losers };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Maç bittiğinde tüm tahminlerin final_score'unu güncelle
     * Bu, instant win ile kazanmış tahminlerin gerçek final skorunu almasını sağlar
     */
    async updateAllFinalScores(client, matchId, finalScore) {
        const result = await client.query(`
      UPDATE ai_predictions
      SET final_score = $2,
          updated_at = NOW()
      WHERE match_id = $1
        AND result IN ('won', 'lost')
        AND (final_score IS NULL OR final_score != $2)
    `, [matchId, finalScore]);
        if (result.rowCount > 0) {
            logger_1.logger.info(`[Settlement] Updated final_score to ${finalScore} for ${result.rowCount} predictions of match ${matchId}`);
        }
    }
    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================
    /**
     * Threshold hesapla (Over X.5 logic) - LEGACY, artık prediction_threshold kullanılıyor
     * "0-0" → 0.5
     * "1-1" → 2.5
     * "2-0" → 2.5
     */
    calculateThreshold(scoreAtPrediction) {
        const parts = scoreAtPrediction.split('-');
        const predHome = parseInt(parts[0]?.trim() || '0', 10) || 0;
        const predAway = parseInt(parts[1]?.trim() || '0', 10) || 0;
        return predHome + predAway + 0.5;
    }
    /**
     * Tahmini WON olarak işaretle
     * Phase 2: result_reason ve final_score kolonlarını güncelle
     */
    async markWon(client, predictionId, reason, score) {
        await client.query(`
      UPDATE ai_predictions
      SET result = 'won',
          resulted_at = NOW(),
          updated_at = NOW(),
          result_reason = $2,
          final_score = COALESCE($3, final_score)
      WHERE id = $1 AND result = 'pending'
    `, [predictionId, reason, score || null]);
        (0, obsLogger_1.logEvent)('info', 'settlement.won', {
            prediction_id: predictionId,
            reason,
            score,
        });
    }
    /**
     * Tahmini LOST olarak işaretle
     * Phase 2: result_reason ve final_score kolonlarını güncelle
     */
    async markLost(client, predictionId, reason, score) {
        await client.query(`
      UPDATE ai_predictions
      SET result = 'lost',
          resulted_at = NOW(),
          updated_at = NOW(),
          result_reason = $2,
          final_score = COALESCE($3, final_score)
      WHERE id = $1 AND result = 'pending'
    `, [predictionId, reason, score || null]);
        (0, obsLogger_1.logEvent)('info', 'settlement.lost', {
            prediction_id: predictionId,
            reason,
            score,
        });
    }
    /**
     * WebSocket broadcast helper
     * Phase 3: Tüm bağlı frontend'lere settlement event'i gönder
     */
    broadcastSettlement(data) {
        if (onPredictionSettled) {
            try {
                onPredictionSettled(data);
                logger_1.logger.debug(`[Settlement] Broadcasted ${data.result} for ${data.predictionId}`);
            }
            catch (error) {
                logger_1.logger.warn(`[Settlement] Broadcast failed for ${data.predictionId}:`, error.message);
            }
        }
    }
    /**
     * Deduplication kontrolü
     * Aynı matchId:eventType kombinasyonu 5 saniye içinde tekrar gelirse skip et
     */
    isDuplicate(event) {
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
    cleanupCache() {
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
    refreshStatsAsync() {
        connection_1.pool.query('SELECT refresh_prediction_stats()')
            .then(() => logger_1.logger.debug('[Settlement] Stats views refreshed'))
            .catch(err => logger_1.logger.warn('[Settlement] Stats refresh failed:', err.message));
    }
    // ==========================================================================
    // BACKWARD COMPATIBILITY
    // ==========================================================================
    /**
     * Legacy settleInstantWin wrapper
     * @deprecated Use processEvent instead
     */
    async settleInstantWin(matchExternalId, homeScore, awayScore, minute, statusId) {
        logger_1.logger.debug(`[Settlement] Legacy settleInstantWin called for ${matchExternalId}`);
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
    async settleMatchPredictions(matchExternalId, homeScore, awayScore, htHome, htAway) {
        logger_1.logger.debug(`[Settlement] Legacy settleMatchPredictions called for ${matchExternalId}`);
        // Skorlar verilmediyse database'den al
        let finalHome = homeScore;
        let finalAway = awayScore;
        let halfTimeHome = htHome;
        let halfTimeAway = htAway;
        if (finalHome === undefined || finalAway === undefined) {
            const matchResult = await connection_1.pool.query(`
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
            }
            else {
                logger_1.logger.warn(`[Settlement] No match found for ${matchExternalId}`);
                return { settled: 0, winners: 0, losers: 0 };
            }
        }
        // Fulltime settlement işle
        const result = await this.processEvent({
            matchId: matchExternalId,
            eventType: 'fulltime',
            homeScore: finalHome,
            awayScore: finalAway,
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
exports.predictionSettlementService = new PredictionSettlementService();
