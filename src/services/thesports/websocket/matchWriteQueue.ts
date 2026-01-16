/**
 * Match Write Queue
 *
 * Batches database writes for the same match to reduce database load and improve performance.
 * Groups updates by matchId and flushes them periodically or when batch size is reached.
 *
 * CRITICAL REFACTOR (2026-01-16):
 * - Now uses LiveMatchOrchestrator for all writes
 * - Ensures MQTT data goes through protection layer (NULL rejection, terminal state, etc.)
 * - MQTT source has highest priority (3) for real-time updates
 */

import { logger } from '../../../utils/logger';
import { ParsedScore } from '../../../types/thesports/websocket/websocket.types';
import { LiveMatchOrchestrator, FieldUpdate } from '../../orchestration/LiveMatchOrchestrator';

interface MatchUpdate {
  type: 'score' | 'incidents' | 'statistics' | 'status';
  data: any;
  providerUpdateTime: number | null;
  ingestionTs: number;
}

interface MatchUpdateBatch {
  matchId: string;
  updates: {
    score?: ParsedScore;
    incidents?: any[];
    statistics?: Record<string, { home: number; away: number }>;
    status?: number;
    statusProviderTime?: number | null;
  };
  providerUpdateTime: number | null;
  latestIngestionTs: number;
}

export class MatchWriteQueue {
  private queue: Map<string, MatchUpdateBatch> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly batchSize: number = 10; // Flush when queue has 10 matches
  private readonly flushIntervalMs: number = 100; // Flush every 100ms
  private isFlushing: boolean = false;
  private orchestrator: LiveMatchOrchestrator;

  constructor() {
    this.orchestrator = LiveMatchOrchestrator.getInstance();
    this.startFlushInterval();
  }

  /**
   * Add update to queue
   */
  enqueue(matchId: string, update: MatchUpdate): void {
    let batch = this.queue.get(matchId);
    
    if (!batch) {
      batch = {
        matchId,
        updates: {},
        providerUpdateTime: update.providerUpdateTime,
        latestIngestionTs: update.ingestionTs,
      };
      this.queue.set(matchId, batch);
    }

    // Merge update into batch
    switch (update.type) {
      case 'score':
        batch.updates.score = update.data;
        break;
      case 'incidents':
        batch.updates.incidents = update.data;
        break;
      case 'statistics':
        batch.updates.statistics = update.data;
        break;
      case 'status':
        batch.updates.status = update.data;
        batch.updates.statusProviderTime = update.providerUpdateTime;
        break;
    }

    // Update timestamps (use latest)
    if (update.providerUpdateTime !== null) {
      batch.providerUpdateTime = batch.providerUpdateTime !== null
        ? Math.max(batch.providerUpdateTime, update.providerUpdateTime)
        : update.providerUpdateTime;
    }
    batch.latestIngestionTs = Math.max(batch.latestIngestionTs, update.ingestionTs);

    // Flush if batch size reached
    if (this.queue.size >= this.batchSize) {
      this.flush().catch(err => {
        logger.error('[MatchWriteQueue] Error flushing on batch size:', err);
      });
    }
  }

  /**
   * Start periodic flush interval
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      if (this.queue.size > 0 && !this.isFlushing) {
        this.flush().catch(err => {
          logger.error('[MatchWriteQueue] Error flushing on interval:', err);
        });
      }
    }, this.flushIntervalMs);
  }

  /**
   * Flush queue to database
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.size === 0) {
      return;
    }

    this.isFlushing = true;
    const batches = Array.from(this.queue.values());
    this.queue.clear();

    try {
      await this.batchWrite(batches);
      logger.debug(`[MatchWriteQueue] Flushed ${batches.length} match updates`);
    } catch (error: any) {
      logger.error('[MatchWriteQueue] Error in batch write:', error);
      // Re-queue failed batches (optional - could cause duplicates)
      // For now, we'll log and continue
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Batch write via LiveMatchOrchestrator
   *
   * CRITICAL REFACTOR (2026-01-16):
   * - Replaced direct DB writes with orchestrator.updateMatch()
   * - All MQTT updates now go through protection layer
   * - Source priority: 'mqtt' (highest = 3)
   */
  private async batchWrite(batches: MatchUpdateBatch[]): Promise<void> {
    if (batches.length === 0) return;

    // Process each batch through orchestrator
    for (const batch of batches) {
      try {
        await this.writeBatchViaOrchestrator(batch);
      } catch (error: any) {
        logger.error(`[MatchWriteQueue] Error writing batch for match ${batch.matchId}:`, error);
        // Continue with other batches
      }
    }
  }

  /**
   * Write single batch via LiveMatchOrchestrator
   *
   * CRITICAL REFACTOR (2026-01-16):
   * - Converts batch updates to FieldUpdate[] format
   * - Sends to orchestrator with source='mqtt' and priority=3 (highest)
   * - Orchestrator handles: NULL rejection, terminal state protection, timestamp checks
   */
  private async writeBatchViaOrchestrator(batch: MatchUpdateBatch): Promise<void> {
    const updates: FieldUpdate[] = [];
    const nowTs = Math.floor(Date.now() / 1000);
    const timestamp = batch.providerUpdateTime || nowTs;

    // Status update
    if (batch.updates.status !== undefined && batch.updates.status !== null && !isNaN(Number(batch.updates.status))) {
      updates.push({
        field: 'status_id',
        value: Number(batch.updates.status),
        source: 'mqtt',
        priority: 3, // Highest priority for real-time MQTT data
        timestamp: batch.updates.statusProviderTime || timestamp,
      });
    }

    // Score updates (from ParsedScore)
    if (batch.updates.score) {
      const score = batch.updates.score;

      // Home score display
      if (score.home?.score !== undefined && score.home?.score !== null && !isNaN(Number(score.home.score))) {
        updates.push({
          field: 'home_score_display',
          value: Number(score.home.score),
          source: 'mqtt',
          priority: 3,
          timestamp,
        });
      }

      // Away score display
      if (score.away?.score !== undefined && score.away?.score !== null && !isNaN(Number(score.away.score))) {
        updates.push({
          field: 'away_score_display',
          value: Number(score.away.score),
          source: 'mqtt',
          priority: 3,
          timestamp,
        });
      }

      // Regular scores (if different from display)
      if (score.home?.regularScore !== undefined && score.home?.regularScore !== null && !isNaN(Number(score.home.regularScore))) {
        updates.push({
          field: 'home_score_regular',
          value: Number(score.home.regularScore),
          source: 'mqtt',
          priority: 3,
          timestamp,
        });
      }

      if (score.away?.regularScore !== undefined && score.away?.regularScore !== null && !isNaN(Number(score.away.regularScore))) {
        updates.push({
          field: 'away_score_regular',
          value: Number(score.away.regularScore),
          source: 'mqtt',
          priority: 3,
          timestamp,
        });
      }

      // Minute from MQTT (calculated from messageTimestamp)
      // NOTE: Orchestrator will respect source priority (mqtt > computed)
      if (score.minute !== undefined && score.minute !== null && !isNaN(Number(score.minute))) {
        updates.push({
          field: 'minute',
          value: Number(score.minute),
          source: 'mqtt',
          priority: 3,
          timestamp,
        });
      }
    }

    // Incidents update (JSONB field - not in orchestrator field rules, will be added dynamically)
    if (batch.updates.incidents) {
      updates.push({
        field: 'incidents',
        value: batch.updates.incidents,
        source: 'mqtt',
        priority: 3,
        timestamp,
      });
    }

    // Statistics update (JSONB field)
    if (batch.updates.statistics) {
      updates.push({
        field: 'statistics',
        value: batch.updates.statistics,
        source: 'mqtt',
        priority: 3,
        timestamp,
      });
    }

    // Provider timestamps
    if (batch.providerUpdateTime !== null && !isNaN(Number(batch.providerUpdateTime))) {
      updates.push({
        field: 'provider_update_time',
        value: Number(batch.providerUpdateTime),
        source: 'mqtt',
        priority: 3,
        timestamp,
      });
    }

    if (batch.latestIngestionTs !== null && !isNaN(Number(batch.latestIngestionTs))) {
      updates.push({
        field: 'last_event_ts',
        value: Number(batch.latestIngestionTs),
        source: 'mqtt',
        priority: 3,
        timestamp,
      });
    }

    // Send to orchestrator if we have updates
    if (updates.length > 0) {
      const result = await this.orchestrator.updateMatch(batch.matchId, updates, 'mqtt');

      if (result.status === 'success') {
        logger.debug(
          `[MatchWriteQueue → Orchestrator] ✅ Updated ${batch.matchId}: ` +
          `${result.fieldsUpdated?.join(', ')} (${updates.length} fields sent)`
        );
      } else if (result.status === 'rejected') {
        logger.warn(
          `[MatchWriteQueue → Orchestrator] ⚠️ Rejected ${batch.matchId}: ${result.reason}`
        );
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    batchSize: number;
    flushIntervalMs: number;
    isFlushing: boolean;
  } {
    return {
      queueSize: this.queue.size,
      batchSize: this.batchSize,
      flushIntervalMs: this.flushIntervalMs,
      isFlushing: this.isFlushing,
    };
  }

  /**
   * Stop flush interval
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining items
    this.flush().catch(err => {
      logger.error('[MatchWriteQueue] Error flushing on stop:', err);
    });
  }
}

