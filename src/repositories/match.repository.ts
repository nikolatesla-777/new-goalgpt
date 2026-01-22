/**
 * Match Repository
 *
 * PR-6: Match Orchestrator
 *
 * All database access for ts_matches table.
 * This is the ONLY place where pool.query is allowed for match writes.
 *
 * This repository is used by MatchOrchestrator to perform atomic updates.
 * Direct usage from routes/controllers is FORBIDDEN.
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

// ============================================================
// TYPES
// ============================================================

/**
 * Core match fields from ts_matches table
 */
export interface Match {
  id: number;
  external_id: string;
  competition_id: string | null;
  season_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  match_time: number | null;
  status_id: number;
  status_id_source: string | null;
  status_id_timestamp: number | null;
  home_score_display: number | null;
  home_score_source: string | null;
  away_score_display: number | null;
  away_score_source: string | null;
  minute: number | null;
  minute_source: string | null;
  minute_timestamp: number | null;
  provider_update_time: number | null;
  last_event_ts: number | null;
  first_half_kickoff_ts: number | null;
  second_half_kickoff_ts: number | null;
  last_update_source: string | null;
  updated_at: Date;
  created_at: Date;
}

/**
 * Fields that can be updated via MatchOrchestrator
 */
export interface MatchUpdateFields {
  status_id?: number;
  status_id_source?: string;
  status_id_timestamp?: number;
  home_score_display?: number;
  home_score_source?: string;
  away_score_display?: number;
  away_score_source?: string;
  minute?: number;
  minute_source?: string;
  minute_timestamp?: number;
  provider_update_time?: number;
  last_event_ts?: number;
  first_half_kickoff_ts?: number;
  second_half_kickoff_ts?: number;
  last_update_source?: string;
}

/**
 * Field update with source tracking for priority-based writes
 */
export interface FieldUpdate {
  field: keyof MatchUpdateFields;
  value: any;
  source: string;
  priority: number;
  timestamp: number;
}

// ============================================================
// MATCH REPOSITORY CLASS
// ============================================================

export class MatchRepository {
  private static instance: MatchRepository | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): MatchRepository {
    if (!MatchRepository.instance) {
      MatchRepository.instance = new MatchRepository();
    }
    return MatchRepository.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    MatchRepository.instance = null;
  }

  // ============================================================
  // READ OPERATIONS
  // ============================================================

  /**
   * Find match by external_id
   */
  async findByExternalId(externalId: string): Promise<Match | null> {
    const client = await pool.connect();
    try {
      const result = await client.query<Match>(
        `SELECT * FROM ts_matches WHERE external_id = $1`,
        [externalId]
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error finding match ${externalId}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find match by internal database id
   */
  async findById(id: number): Promise<Match | null> {
    const client = await pool.connect();
    try {
      const result = await client.query<Match>(
        `SELECT * FROM ts_matches WHERE id = $1`,
        [id]
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error finding match by id ${id}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find all live matches (status_id in 2, 3, 4, 5, 7)
   */
  async findLiveMatches(): Promise<Match[]> {
    const client = await pool.connect();
    try {
      const result = await client.query<Match>(
        `SELECT * FROM ts_matches
         WHERE status_id IN (2, 3, 4, 5, 7)
         ORDER BY match_time ASC`
      );
      return result.rows;
    } catch (error: any) {
      logger.error('[MatchRepository] Error finding live matches:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find matches by status
   */
  async findByStatus(statusId: number): Promise<Match[]> {
    const client = await pool.connect();
    try {
      const result = await client.query<Match>(
        `SELECT * FROM ts_matches WHERE status_id = $1 ORDER BY match_time ASC`,
        [statusId]
      );
      return result.rows;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error finding matches by status ${statusId}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find matches by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Match[]> {
    const client = await pool.connect();
    try {
      // Convert date strings to timestamps
      const startTs = Math.floor(new Date(startDate).getTime() / 1000);
      const endTs = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000);

      const result = await client.query<Match>(
        `SELECT * FROM ts_matches
         WHERE match_time >= $1 AND match_time <= $2
         ORDER BY match_time ASC`,
        [startTs, endTs]
      );
      return result.rows;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error finding matches by date:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get core match fields for orchestrator updates
   * Returns only the fields needed for update decisions (lighter query)
   */
  async getMatchUpdateState(externalId: string): Promise<{
    status_id: number;
    status_id_source: string | null;
    status_id_timestamp: number | null;
    home_score_display: number | null;
    away_score_display: number | null;
    minute: number | null;
    provider_update_time: number | null;
    last_event_ts: number | null;
    last_update_source: string | null;
    updated_at: Date;
  } | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
           status_id, status_id_source, status_id_timestamp,
           home_score_display, away_score_display, minute,
           provider_update_time, last_event_ts, last_update_source, updated_at
         FROM ts_matches
         WHERE external_id = $1`,
        [externalId]
      );
      return result.rows[0] ?? null;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error getting update state for ${externalId}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================
  // WRITE OPERATIONS
  // ============================================================

  /**
   * Update match fields with dynamic query building
   *
   * This method builds an UPDATE query from the provided field updates,
   * including source tracking columns for priority-based writes.
   *
   * @param externalId - The external_id of the match
   * @param updates - Array of field updates with source/priority info
   * @returns Object with status and updated fields
   */
  async updateFields(
    externalId: string,
    updates: FieldUpdate[]
  ): Promise<{ status: string; fieldsUpdated: string[] }> {
    if (updates.length === 0) {
      return { status: 'success', fieldsUpdated: [] };
    }

    const client = await pool.connect();
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      const fieldsUpdated: string[] = [];

      // Source column mapping for tracked fields
      const sourceColumnMap: Record<string, string> = {
        home_score_display: 'home_score_source',
        away_score_display: 'away_score_source',
        status_id: 'status_id_source',
        minute: 'minute_source',
      };

      // Timestamp column mapping for tracked fields
      const timestampColumnMap: Record<string, string> = {
        status_id: 'status_id_timestamp',
        minute: 'minute_timestamp',
      };

      for (const update of updates) {
        // Add main field update
        setClauses.push(`${update.field} = $${paramIndex}`);
        values.push(update.value);
        fieldsUpdated.push(update.field);
        paramIndex++;

        // Add source tracking column if exists
        const sourceColumn = sourceColumnMap[update.field];
        if (sourceColumn) {
          setClauses.push(`${sourceColumn} = $${paramIndex}`);
          values.push(update.source);
          paramIndex++;
        }

        // Add timestamp tracking column if exists
        const timestampColumn = timestampColumnMap[update.field];
        if (timestampColumn) {
          setClauses.push(`${timestampColumn} = $${paramIndex}`);
          values.push(update.timestamp);
          paramIndex++;
        }
      }

      // Always update updated_at and last_update_source
      setClauses.push(`updated_at = NOW()`);

      // Get source from first update (they should all be from same source)
      const source = updates[0]?.source ?? 'unknown';
      setClauses.push(`last_update_source = $${paramIndex}`);
      values.push(source);
      paramIndex++;

      // Build and execute query
      const query = `
        UPDATE ts_matches
        SET ${setClauses.join(', ')}
        WHERE external_id = $${paramIndex}
      `;
      values.push(externalId);

      const result = await client.query(query, values);

      if (result.rowCount === 0) {
        logger.warn(`[MatchRepository] No match found with external_id ${externalId}`);
        return { status: 'not_found', fieldsUpdated: [] };
      }

      logger.debug(`[MatchRepository] Updated ${externalId}: ${fieldsUpdated.join(', ')}`);
      return { status: 'success', fieldsUpdated };
    } catch (error: any) {
      logger.error(`[MatchRepository] Error updating match ${externalId}:`, error.message);
      return { status: 'error', fieldsUpdated: [] };
    } finally {
      client.release();
    }
  }

  /**
   * Simple update for non-tracked fields (no source/timestamp tracking)
   */
  async update(
    externalId: string,
    fields: Partial<MatchUpdateFields>
  ): Promise<boolean> {
    const entries = Object.entries(fields).filter(([_, v]) => v !== undefined);
    if (entries.length === 0) return true;

    const client = await pool.connect();
    try {
      const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`);
      const values = entries.map(([_, v]) => v);

      setClauses.push(`updated_at = NOW()`);

      const query = `
        UPDATE ts_matches
        SET ${setClauses.join(', ')}
        WHERE external_id = $${values.length + 1}
      `;
      values.push(externalId);

      const result = await client.query(query, values);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error updating match ${externalId}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }

  // ============================================================
  // LOCK OPERATIONS
  // ============================================================

  /**
   * Acquire advisory lock for a match
   * Uses pg_try_advisory_lock (non-blocking)
   *
   * @param lockKey - The bigint lock key
   * @returns true if lock acquired, false if already held
   */
  async tryAcquireLock(lockKey: bigint): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT pg_try_advisory_lock($1) AS ok',
        [lockKey.toString()]
      );
      return result.rows[0]?.ok === true;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error acquiring lock ${lockKey}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Release advisory lock for a match
   *
   * @param lockKey - The bigint lock key
   * @returns true if lock released
   */
  async releaseLock(lockKey: bigint): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey.toString()]);
      return true;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error releasing lock ${lockKey}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }

  // ============================================================
  // BATCH OPERATIONS
  // ============================================================

  /**
   * Find multiple matches by external_ids
   */
  async findByExternalIds(externalIds: string[]): Promise<Match[]> {
    if (externalIds.length === 0) return [];

    const client = await pool.connect();
    try {
      const placeholders = externalIds.map((_, i) => `$${i + 1}`).join(', ');
      const result = await client.query<Match>(
        `SELECT * FROM ts_matches WHERE external_id IN (${placeholders})`,
        externalIds
      );
      return result.rows;
    } catch (error: any) {
      logger.error('[MatchRepository] Error finding matches by ids:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if match exists by external_id
   */
  async exists(externalId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM ts_matches WHERE external_id = $1 LIMIT 1',
        [externalId]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: any) {
      logger.error(`[MatchRepository] Error checking existence of ${externalId}:`, error.message);
      return false;
    } finally {
      client.release();
    }
  }
}

// ============================================================
// EXPORTS
// ============================================================

// Default singleton export
export const matchRepository = MatchRepository.getInstance();
