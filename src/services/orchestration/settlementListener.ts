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

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { LiveMatchOrchestrator } from './LiveMatchOrchestrator';
import { predictionSettlementService, SettlementEvent } from '../ai/predictionSettlement.service';

interface MatchState {
  external_id: string;
  home_score_display: number | null;
  away_score_display: number | null;
  minute: number | null;
  status_id: number;
  ht_home: number | null;
  ht_away: number | null;
}

export class OrchestratorSettlementListener {
  constructor(orchestrator: LiveMatchOrchestrator) {
    // Listen to orchestrator match update events
    orchestrator.on('match:updated', this.handleMatchUpdate.bind(this));
    logger.info('[SettlementListener] Initialized - listening to orchestrator events');
  }

  /**
   * Handle match:updated event from orchestrator
   *
   * Detects score/status changes and triggers settlement
   */
  private async handleMatchUpdate(event: {
    matchId: string;
    fields: string[];
    source: string;
  }): Promise<void> {
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
        logger.warn(`[SettlementListener] Match not found: ${event.matchId}`);
        return;
      }

      // 3. Determine event type based on status and changes
      let eventType: 'score_change' | 'halftime' | 'fulltime' | 'goal';

      // Halftime detection: Status 3 (HALF_TIME)
      if (match.status_id === 3) {
        eventType = 'halftime';
        logger.info(`[SettlementListener] Halftime detected for ${event.matchId} - triggering halftime settlement`);
      }
      // Fulltime detection: Status 8 (END)
      else if (match.status_id === 8) {
        eventType = 'fulltime';
        logger.info(`[SettlementListener] Fulltime detected for ${event.matchId} - triggering fulltime settlement`);
      }
      // Score change: Trigger instant win check
      else if (isScoreChange) {
        eventType = 'score_change';
        logger.debug(`[SettlementListener] Score change for ${event.matchId}: ${match.home_score_display}-${match.away_score_display} (minute: ${match.minute})`);
      }
      // Status change but not HT/FT: Skip settlement
      else {
        logger.debug(`[SettlementListener] Status change to ${match.status_id} for ${event.matchId} - no settlement action`);
        return;
      }

      // 4. Trigger settlement service
      await predictionSettlementService.processEvent({
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

      logger.debug(`[SettlementListener] Settlement triggered: ${eventType} for ${event.matchId} (source: ${event.source})`);

    } catch (error: any) {
      logger.error(`[SettlementListener] Error handling match update for ${event.matchId}:`, error);
      // Don't throw - settlement errors shouldn't block orchestrator
    }
  }

  /**
   * Fetch current match state from database
   *
   * Returns score, minute, status needed for settlement
   */
  private async fetchMatchState(matchId: string): Promise<MatchState | null> {
    const client = await pool.connect();
    try {
      const result = await client.query<MatchState>(`
        SELECT
          external_id,
          home_score_display,
          away_score_display,
          minute,
          status_id,
          ht_home,
          ht_away
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);

      return result.rows[0] || null;

    } catch (error: any) {
      logger.error(`[SettlementListener] Error fetching match state for ${matchId}:`, error);
      return null;
    } finally {
      client.release();
    }
  }
}
