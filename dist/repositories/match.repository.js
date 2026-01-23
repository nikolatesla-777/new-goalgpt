"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchRepository = exports.MatchRepository = void 0;
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
// ============================================================
// MATCH REPOSITORY CLASS
// ============================================================
class MatchRepository {
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!MatchRepository.instance) {
            MatchRepository.instance = new MatchRepository();
        }
        return MatchRepository.instance;
    }
    /**
     * Reset singleton (for testing)
     */
    static resetInstance() {
        MatchRepository.instance = null;
    }
    // ============================================================
    // READ OPERATIONS
    // ============================================================
    /**
     * Find match by external_id
     */
    async findByExternalId(externalId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`SELECT * FROM ts_matches WHERE external_id = $1`, [externalId]);
            return result.rows[0] ?? null;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error finding match ${externalId}:`, error.message);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Find match by internal database id
     */
    async findById(id) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`SELECT * FROM ts_matches WHERE id = $1`, [id]);
            return result.rows[0] ?? null;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error finding match by id ${id}:`, error.message);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Find all live matches (status_id in 2, 3, 4, 5, 7)
     */
    async findLiveMatches() {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`SELECT * FROM ts_matches
         WHERE status_id IN (2, 3, 4, 5, 7)
         ORDER BY match_time ASC`);
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error('[MatchRepository] Error finding live matches:', error.message);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Find matches by status
     */
    async findByStatus(statusId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`SELECT * FROM ts_matches WHERE status_id = $1 ORDER BY match_time ASC`, [statusId]);
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error finding matches by status ${statusId}:`, error.message);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Find matches by date range
     */
    async findByDateRange(startDate, endDate) {
        const client = await connection_1.pool.connect();
        try {
            // Convert date strings to timestamps
            const startTs = Math.floor(new Date(startDate).getTime() / 1000);
            const endTs = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000);
            const result = await client.query(`SELECT * FROM ts_matches
         WHERE match_time >= $1 AND match_time <= $2
         ORDER BY match_time ASC`, [startTs, endTs]);
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error finding matches by date:`, error.message);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get core match fields for orchestrator updates
     * Returns only the fields needed for update decisions (lighter query)
     */
    async getMatchUpdateState(externalId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`SELECT
           status_id, status_id_source, status_id_timestamp,
           home_score_display, away_score_display, minute,
           provider_update_time, last_event_ts, last_update_source, updated_at
         FROM ts_matches
         WHERE external_id = $1`, [externalId]);
            return result.rows[0] ?? null;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error getting update state for ${externalId}:`, error.message);
            throw error;
        }
        finally {
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
    async updateFields(externalId, updates) {
        if (updates.length === 0) {
            return { status: 'success', fieldsUpdated: [] };
        }
        const client = await connection_1.pool.connect();
        try {
            const setClauses = [];
            const values = [];
            let paramIndex = 1;
            const fieldsUpdated = [];
            // Source column mapping for tracked fields
            const sourceColumnMap = {
                home_score_display: 'home_score_source',
                away_score_display: 'away_score_source',
                status_id: 'status_id_source',
                minute: 'minute_source',
            };
            // Timestamp column mapping for tracked fields
            const timestampColumnMap = {
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
                logger_1.logger.warn(`[MatchRepository] No match found with external_id ${externalId}`);
                return { status: 'not_found', fieldsUpdated: [] };
            }
            logger_1.logger.debug(`[MatchRepository] Updated ${externalId}: ${fieldsUpdated.join(', ')}`);
            return { status: 'success', fieldsUpdated };
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error updating match ${externalId}:`, error.message);
            return { status: 'error', fieldsUpdated: [] };
        }
        finally {
            client.release();
        }
    }
    /**
     * Simple update for non-tracked fields (no source/timestamp tracking)
     */
    async update(externalId, fields) {
        const entries = Object.entries(fields).filter(([_, v]) => v !== undefined);
        if (entries.length === 0)
            return true;
        const client = await connection_1.pool.connect();
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
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error updating match ${externalId}:`, error.message);
            return false;
        }
        finally {
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
    async tryAcquireLock(lockKey) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [lockKey.toString()]);
            return result.rows[0]?.ok === true;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error acquiring lock ${lockKey}:`, error.message);
            return false;
        }
        finally {
            client.release();
        }
    }
    /**
     * Release advisory lock for a match
     *
     * @param lockKey - The bigint lock key
     * @returns true if lock released
     */
    async releaseLock(lockKey) {
        const client = await connection_1.pool.connect();
        try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockKey.toString()]);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error releasing lock ${lockKey}:`, error.message);
            return false;
        }
        finally {
            client.release();
        }
    }
    // ============================================================
    // BATCH OPERATIONS
    // ============================================================
    /**
     * Find multiple matches by external_ids
     */
    async findByExternalIds(externalIds) {
        if (externalIds.length === 0)
            return [];
        const client = await connection_1.pool.connect();
        try {
            const placeholders = externalIds.map((_, i) => `$${i + 1}`).join(', ');
            const result = await client.query(`SELECT * FROM ts_matches WHERE external_id IN (${placeholders})`, externalIds);
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error('[MatchRepository] Error finding matches by ids:', error.message);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Check if match exists by external_id
     */
    async exists(externalId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query('SELECT 1 FROM ts_matches WHERE external_id = $1 LIMIT 1', [externalId]);
            return result.rowCount !== null && result.rowCount > 0;
        }
        catch (error) {
            logger_1.logger.error(`[MatchRepository] Error checking existence of ${externalId}:`, error.message);
            return false;
        }
        finally {
            client.release();
        }
    }
}
exports.MatchRepository = MatchRepository;
MatchRepository.instance = null;
// ============================================================
// EXPORTS
// ============================================================
// Default singleton export
exports.matchRepository = MatchRepository.getInstance();
