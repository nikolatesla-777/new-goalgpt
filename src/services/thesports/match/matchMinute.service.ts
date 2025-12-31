/**
 * Match Minute Service
 * 
 * Backend-authoritative minute calculation engine.
 * Calculates match minutes from kickoff timestamps stored in DB.
 * UI will read minute from DB (Phase 3C); this service enforces backend authority.
 * 
 * PHASE 3C COMPLETE — Minute & Watchdog logic frozen
 * No further changes allowed without Phase 4+ approval.
 */

import { pool } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';

export class MatchMinuteService {
  /**
   * Calculate minute for a match based on status and kickoff timestamps
   * @param statusId - Match status (2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=PENALTY)
   * @param firstHalfKickoffTs - Unix seconds timestamp (nullable)
   * @param secondHalfKickoffTs - Unix seconds timestamp (nullable)
   * @param overtimeKickoffTs - Unix seconds timestamp (nullable)
   * @param existingMinute - Current minute value in DB (for freeze statuses)
   * @param nowTs - Current server time (Unix seconds)
   * @returns Calculated minute value (INTEGER, nullable) or null if cannot calculate
   */
  calculateMinute(
    statusId: number,
    firstHalfKickoffTs: number | null,
    secondHalfKickoffTs: number | null,
    overtimeKickoffTs: number | null,
    existingMinute: number | null,
    nowTs: number
  ): number | null {
    // PHASE 4-2: Cast bigints from DB to Number to prevent string concatenation
    // Ensure we don't return NaN which would crash DB integer columns
    const toSafeNum = (val: any) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    };

    const firstHalfTs = toSafeNum(firstHalfKickoffTs);
    const secondHalfTs = toSafeNum(secondHalfKickoffTs);
    const overtimeTs = toSafeNum(overtimeKickoffTs);

    // Status 2 (FIRST_HALF)
    if (statusId === 2) {
      if (firstHalfTs === null) {
        logger.warn(`[MinuteEngine] Cannot calculate minute for status 2: first_half_kickoff_ts is NULL`);
        return null;
      }
      const calculated = Math.floor((nowTs - firstHalfTs) / 60) + 1;
      return Math.min(calculated, 45); // Clamp max 45
    }

    // Status 3 (HALF_TIME) - frozen at 45
    if (statusId === 3) {
      return 45; // Always 45, never NULL
    }

    // Status 4 (SECOND_HALF)
    if (statusId === 4) {
      if (secondHalfTs === null) {
        // FALLBACK: If second_half_kickoff_ts is missing, estimate from first_half
        // Usually second half starts ~60 minutes after first half kickoff (45m play + 15m break)
        if (firstHalfTs !== null) {
          const estimatedSecondHalfStart = firstHalfTs + 3600; // 60 minutes
          const calculated = 45 + Math.floor((nowTs - estimatedSecondHalfStart) / 60) + 1;
          logger.debug(`[MinuteEngine] Using fallback for status 4 (estimated_start=${estimatedSecondHalfStart}): minute=${calculated}`);
          return Math.max(calculated, 46); // Clamp min 46
        }
        logger.warn(`[MinuteEngine] Cannot calculate minute for status 4: both second_half_kickoff_ts and first_half_kickoff_ts are NULL`);
        return null;
      }
      const calculated = 45 + Math.floor((nowTs - secondHalfTs) / 60) + 1;
      return Math.max(calculated, 46); // Clamp min 46
    }

    // Status 5 (OVERTIME)
    if (statusId === 5) {
      if (overtimeTs === null) {
        logger.warn(`[MinuteEngine] Cannot calculate minute for status 5: overtime_kickoff_ts is NULL`);
        return null;
      }
      return 90 + Math.floor((nowTs - overtimeTs) / 60) + 1;
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
   * Update minute for a single match in DB
   * Only updates if minute value changed (new_minute !== existing_minute)
   * CRITICAL: Does NOT update updated_at (preserves watchdog/reconcile stale detection)
   * 
   * @param matchId - External match ID
   * @param newMinute - Calculated minute value
   * @param existingMinute - Current minute in DB
   * @returns { updated: boolean, rowCount: number }
   */
  async updateMatchMinute(
    matchId: string,
    newMinute: number | null,
    existingMinute: number | null
  ): Promise<{ updated: boolean; rowCount: number }> {
    // Update rules:
    // - newMinute === existingMinute → skip (no change)
    // - newMinute === null && existingMinute !== null → skip (preserve existing)
    // - newMinute !== null && existingMinute === null → update (first time setting)
    // - newMinute !== existingMinute → update (minute changed)

    if (newMinute === existingMinute) {
      return { updated: false, rowCount: 0 };
    }

    // If newMinute is null but existingMinute exists, preserve existing (do not set to NULL)
    if (newMinute === null && existingMinute !== null) {
      logger.debug(`[MinuteEngine] Skipping update for ${matchId}: newMinute is null but existingMinute=${existingMinute} (preserving existing)`);
      return { updated: false, rowCount: 0 };
    }

    const client = await pool.connect();
    try {
      const nowTs = Math.floor(Date.now() / 1000);

      // CRITICAL: Do NOT update updated_at - only minute and last_minute_update_ts
      const query = `
        UPDATE ts_matches
        SET 
          minute = $1,
          last_minute_update_ts = $2
        WHERE external_id = $3
          AND (minute IS DISTINCT FROM $1)
      `;

      const result = await client.query(query, [newMinute, nowTs, matchId]);
      const rowCount = result.rowCount ?? 0;

      if (rowCount > 0) {
        logEvent('info', 'minute.update', {
          match_id: matchId,
          old_minute: existingMinute,
          new_minute: newMinute,
        });
      } else {
        logger.debug(`[MinuteEngine] skipped match_id=${matchId} reason=unchanged minute (newMinute=${newMinute}, existingMinute=${existingMinute})`);
      }

      return { updated: rowCount > 0, rowCount };
    } catch (error: any) {
      logger.error(`[MinuteEngine] Failed to update minute for ${matchId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

