/**
 * Match Write Queue
 * 
 * Batches database writes for the same match to reduce database load and improve performance.
 * Groups updates by matchId and flushes them periodically or when batch size is reached.
 */

import { pool } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { ParsedScore } from '../../../types/thesports/websocket/websocket.types';

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

  constructor() {
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
   * Batch write to database
   */
  private async batchWrite(batches: MatchUpdateBatch[]): Promise<void> {
    if (batches.length === 0) return;

    const client = await pool.connect();
    try {
      // Process each batch (could be optimized further with bulk UPDATE)
      for (const batch of batches) {
        try {
          await this.writeBatch(client, batch);
        } catch (error: any) {
          logger.error(`[MatchWriteQueue] Error writing batch for match ${batch.matchId}:`, error);
          // Continue with other batches
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Write single batch to database
   */
  private async writeBatch(client: any, batch: MatchUpdateBatch): Promise<void> {
    // Optimistic locking check
    const freshnessCheck = await this.shouldApplyUpdate(
      client,
      batch.matchId,
      batch.providerUpdateTime
    );

    if (!freshnessCheck.apply) {
      logger.debug(`[MatchWriteQueue] Skipping stale update for ${batch.matchId}`);
      return;
    }

    // Build UPDATE query based on what's in the batch
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Status update
    if (batch.updates.status !== undefined) {
      setParts.push(`status_id = $${paramIndex++}`);
      values.push(batch.updates.status);
    }

    // Score update (from ParsedScore)
    if (batch.updates.score) {
      const score = batch.updates.score;
      setParts.push(`home_score_display = $${paramIndex++}`);
      values.push(score.home.score);
      setParts.push(`away_score_display = $${paramIndex++}`);
      values.push(score.away.score);
      
      // Add other score fields if needed
      if (score.home.regularScore !== undefined) {
        setParts.push(`home_score_regular = $${paramIndex++}`);
        values.push(score.home.regularScore);
      }
      if (score.away.regularScore !== undefined) {
        setParts.push(`away_score_regular = $${paramIndex++}`);
        values.push(score.away.regularScore);
      }
    }

    // Incidents update
    if (batch.updates.incidents) {
      setParts.push(`incidents = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(batch.updates.incidents));
    }

    // Statistics update
    if (batch.updates.statistics) {
      setParts.push(`statistics = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(batch.updates.statistics));
    }

    // Timestamps
    if (freshnessCheck.providerTimeToWrite !== null) {
      setParts.push(`provider_update_time = GREATEST(COALESCE(provider_update_time, 0), $${paramIndex++})`);
      values.push(freshnessCheck.providerTimeToWrite);
    }
    setParts.push(`last_event_ts = $${paramIndex++}`);
    values.push(freshnessCheck.ingestionTs);
    setParts.push(`updated_at = NOW()`);

    if (setParts.length === 0) {
      return; // Nothing to update
    }

    // Execute UPDATE
    const query = `
      UPDATE ts_matches
      SET ${setParts.join(', ')}
      WHERE external_id = $${paramIndex}
    `;
    values.push(batch.matchId);

    const res = await client.query(query, values);
    
    if (res.rowCount === 0) {
      logger.warn(`[MatchWriteQueue] UPDATE affected 0 rows for match ${batch.matchId}`);
    }
  }

  /**
   * Optimistic locking check (same logic as WebSocketService)
   */
  private async shouldApplyUpdate(
    client: any,
    matchId: string,
    incomingProviderUpdateTime: number | null
  ): Promise<{ apply: boolean; providerTimeToWrite: number | null; ingestionTs: number }> {
    const ingestionTs = Math.floor(Date.now() / 1000);

    const result = await client.query(
      `SELECT provider_update_time, last_event_ts FROM ts_matches WHERE external_id = $1`,
      [matchId]
    );

    if (result.rows.length === 0) {
      logger.warn(`[MatchWriteQueue] Match ${matchId} not found in DB during optimistic locking check`);
      return { apply: true, providerTimeToWrite: incomingProviderUpdateTime, ingestionTs };
    }

    const existing = result.rows[0];
    const existingProviderTime = existing.provider_update_time;
    const existingEventTime = existing.last_event_ts;

    if (incomingProviderUpdateTime !== null && incomingProviderUpdateTime !== undefined) {
      if (existingProviderTime !== null && incomingProviderUpdateTime <= existingProviderTime) {
        return { apply: false, providerTimeToWrite: null, ingestionTs };
      }
      const providerTimeToWrite = Math.max(existingProviderTime || 0, incomingProviderUpdateTime);
      return { apply: true, providerTimeToWrite, ingestionTs };
    } else {
      if (existingEventTime !== null && ingestionTs <= existingEventTime + 5) {
        return { apply: false, providerTimeToWrite: null, ingestionTs };
      }
      return { apply: true, providerTimeToWrite: null, ingestionTs };
    }
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

