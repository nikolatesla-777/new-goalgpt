"use strict";
/**
 * Orchestrator Settlement Listener
 *
 * Connects LiveMatchOrchestrator to AI Prediction Settlement Service
 *
 * ARCHITECTURE:
 * - Event-driven: Listens to orchestrator 'match:updated' events
 * - Score/status change detection: Checks fieldsUpdated array
 * - Settlement trigger: Calls predictionSettlementService.processEvent()
 * - Deduplication: Handled by settlement service (5s window)
 *
 * TRIGGER SOURCES (all via orchestrator):
 * - DataUpdate (20s polling) → orchestrator → THIS → settlement
 * - MatchWatchdog (30s polling) → orchestrator → THIS → settlement
 * - MatchSync (30s polling) → orchestrator → THIS → settlement
 * - WebSocket (real-time) → orchestrator → THIS → settlement
 *
 * BENEFITS:
 * - Single centralized listener for ALL match updates
 * - No code duplication across workers
 * - Future-proof: new workers auto-trigger settlement
 * - Loosely coupled: event-driven architecture
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorSettlementListener = void 0;
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const predictionSettlement_service_1 = require("../ai/predictionSettlement.service");
class OrchestratorSettlementListener {
    constructor(orchestrator) {
        // Listen to orchestrator match update events
        orchestrator.on('match:updated', this.handleMatchUpdate.bind(this));
        logger_1.logger.info('[SettlementListener] Initialized - listening to orchestrator events');
    }
    /**
     * Handle match:updated event from orchestrator
     *
     * Detects score/status changes and triggers settlement
     */
    async handleMatchUpdate(event) {
        try {
            // 1. Detect if score or status changed
            const isScoreChange = event.fields.includes('home_score_display') ||
                event.fields.includes('away_score_display');
            const isStatusChange = event.fields.includes('status_id');
            if (!isScoreChange && !isStatusChange) {
                // No relevant change for settlement
                return;
            }
            // 2. Fetch current match state (score, minute, status)
            const match = await this.fetchMatchState(event.matchId);
            if (!match) {
                logger_1.logger.warn(`[SettlementListener] Match not found: ${event.matchId}`);
                return;
            }
            // 3. Determine event type based on status and changes
            let eventType;
            // Halftime detection: Status 3 (HALF_TIME)
            if (match.status_id === 3) {
                eventType = 'halftime';
                logger_1.logger.info(`[SettlementListener] Halftime detected for ${event.matchId} - triggering halftime settlement`);
            }
            // Fulltime detection: Status 8 (END)
            else if (match.status_id === 8) {
                eventType = 'fulltime';
                logger_1.logger.info(`[SettlementListener] Fulltime detected for ${event.matchId} - triggering fulltime settlement`);
            }
            // Score change: Trigger instant win check
            else if (isScoreChange) {
                eventType = 'score_change';
                logger_1.logger.debug(`[SettlementListener] Score change for ${event.matchId}: ${match.home_score_display}-${match.away_score_display} (minute: ${match.minute})`);
            }
            // Status change but not HT/FT: Skip settlement
            else {
                logger_1.logger.debug(`[SettlementListener] Status change to ${match.status_id} for ${event.matchId} - no settlement action`);
                return;
            }
            // 4. Trigger settlement service
            await predictionSettlement_service_1.predictionSettlementService.processEvent({
                matchId: event.matchId,
                eventType,
                homeScore: match.home_score_display ?? 0,
                awayScore: match.away_score_display ?? 0,
                htHome: match.ht_home ?? undefined,
                htAway: match.ht_away ?? undefined,
                minute: match.minute ?? undefined,
                statusId: match.status_id,
                timestamp: Date.now(),
            });
            logger_1.logger.debug(`[SettlementListener] Settlement triggered: ${eventType} for ${event.matchId} (source: ${event.source})`);
        }
        catch (error) {
            logger_1.logger.error(`[SettlementListener] Error handling match update for ${event.matchId}:`, error);
            // Don't throw - settlement errors shouldn't block orchestrator
        }
    }
    /**
     * Fetch current match state from database
     *
     * Returns score, minute, status needed for settlement
     */
    async fetchMatchState(matchId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT
          external_id,
          home_score_display,
          away_score_display,
          minute,
          status_id,
          (home_scores->>1)::INTEGER as ht_home,
          (away_scores->>1)::INTEGER as ht_away
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            return result.rows[0] || null;
        }
        catch (error) {
            logger_1.logger.error(`[SettlementListener] Error fetching match state for ${matchId}:`, error);
            return null;
        }
        finally {
            client.release();
        }
    }
}
exports.OrchestratorSettlementListener = OrchestratorSettlementListener;
