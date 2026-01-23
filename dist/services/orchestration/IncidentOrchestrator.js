"use strict";
/**
 * Incident Orchestrator
 *
 * CRITICAL: Single Source of Truth for all match incident/event writes.
 * Pattern: Singleton + EventEmitter (same as LiveMatchOrchestrator)
 *
 * Features:
 * - Centralized incident processing from API, WebSocket, polling
 * - Deduplication via unique incident_key
 * - Event emission for real-time updates
 * - Database persistence to ts_incidents
 *
 * @module services/orchestration/IncidentOrchestrator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIncidentOrchestrator = exports.IncidentOrchestrator = void 0;
const events_1 = require("events");
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const RedisManager_1 = require("../../core/RedisManager");
// Event type constants (from TheSports API)
const EVENT_TYPES = {
    GOAL: 1,
    CORNER: 2,
    YELLOW_CARD: 3,
    RED_CARD: 4,
    OFFSIDE: 5,
    FREE_KICK: 6,
    GOAL_KICK: 7,
    PENALTY: 8,
    SUBSTITUTION: 9,
    START: 10,
    MIDFIELD: 11, // 2nd half started
    END: 12,
    HALFTIME_SCORE: 13,
    CARD_UPGRADE: 15, // 2nd yellow -> red
    PENALTY_MISSED: 16,
    OWN_GOAL: 17,
    INJURY_TIME: 19,
    VAR: 28,
    PENALTY_SHOOTOUT: 29,
    PENALTY_MISSED_SHOOTOUT: 30,
    SHOT_ON_POST: 34,
};
/**
 * IncidentOrchestrator - Single authority for all match incident writes
 *
 * USAGE:
 * ```typescript
 * const orchestrator = IncidentOrchestrator.getInstance();
 *
 *
 * // Process incidents from any source
 * const result = await orchestrator.processIncidents('match-123', incidents, 'api');
 * console.log(`Added ${result.added}, skipped ${result.skipped}`);
 * ```
 */
class IncidentOrchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        // Stats tracking
        this.stats = {
            totalProcessed: 0,
            totalAdded: 0,
            totalSkipped: 0,
            totalErrors: 0,
            lastProcessTime: null,
        };
        logger_1.logger.info('[IncidentOrchestrator] Initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = new IncidentOrchestrator();
        }
        return this.instance;
    }
    /**
     * Generate unique incident key for deduplication
     * Format: match_id:type:time:position
     */
    generateIncidentKey(matchId, incident) {
        return `${matchId}:${incident.type}:${incident.time}:${incident.position || 0}`;
    }
    /**
     * Check if incident already exists in Redis cache
     */
    async isProcessed(incidentKey) {
        try {
            const cached = await RedisManager_1.RedisManager.get(`incident:${incidentKey}`);
            return cached !== null;
        }
        catch {
            // Redis error - fall through to DB check
            return false;
        }
    }
    /**
     * Mark incident as processed in Redis (TTL 24h)
     */
    async markProcessed(incidentKey) {
        try {
            await RedisManager_1.RedisManager.set(`incident:${incidentKey}`, '1', 86400);
        }
        catch (err) {
            // Redis error - not critical, DB constraint will handle
            logger_1.logger.debug(`[IncidentOrchestrator] Redis cache set failed: ${err}`);
        }
    }
    /**
     * Main entry point - process incidents from any source
     *
     * @param matchId - External match ID
     * @param incidents - Array of incidents from API/WebSocket
     * @param source - Source identifier for logging ('api', 'websocket', 'polling')
     * @returns Processing result with counts
     */
    async processIncidents(matchId, incidents, source) {
        if (!incidents || incidents.length === 0) {
            return { added: 0, skipped: 0, errors: 0 };
        }
        logger_1.logger.info(`[IncidentOrchestrator] Processing ${incidents.length} incidents for ${matchId} from ${source}`);
        const result = { added: 0, skipped: 0, errors: 0 };
        const client = await connection_1.pool.connect();
        try {
            for (const incident of incidents) {
                const incidentKey = this.generateIncidentKey(matchId, incident);
                // 1. Check Redis cache first (fast path)
                if (await this.isProcessed(incidentKey)) {
                    result.skipped++;
                    continue;
                }
                // 2. Try to insert into database
                try {
                    await client.query(`
            INSERT INTO ts_incidents (
              match_id, type, time, position,
              player_name, player_id, assist1_name,
              in_player_name, out_player_name,
              home_score, away_score,
              var_reason, reason_type, add_time,
              incident_key, source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (incident_key) DO NOTHING
          `, [
                        matchId,
                        incident.type,
                        incident.time,
                        incident.position || 0,
                        incident.player_name || null,
                        incident.player_id || null,
                        incident.assist1_name || null,
                        incident.in_player_name || null,
                        incident.out_player_name || null,
                        incident.home_score ?? null,
                        incident.away_score ?? null,
                        incident.var_reason || null,
                        incident.reason_type || null,
                        incident.add_time || null,
                        incidentKey,
                        source,
                    ]);
                    // 3. Mark as processed in Redis
                    await this.markProcessed(incidentKey);
                    result.added++;
                    // 4. Emit appropriate events
                    this.emitIncidentEvents(matchId, incident);
                }
                catch (err) {
                    if (err.code === '23505') {
                        // Unique constraint violation - already exists
                        result.skipped++;
                        await this.markProcessed(incidentKey);
                    }
                    else {
                        logger_1.logger.error(`[IncidentOrchestrator] DB error for incident:`, err);
                        result.errors++;
                    }
                }
            }
            // Update stats
            this.stats.totalProcessed += incidents.length;
            this.stats.totalAdded += result.added;
            this.stats.totalSkipped += result.skipped;
            this.stats.totalErrors += result.errors;
            this.stats.lastProcessTime = new Date();
            if (result.added > 0) {
                logger_1.logger.info(`[IncidentOrchestrator] ✅ Added ${result.added} incidents for ${matchId}`);
            }
            return result;
        }
        finally {
            client.release();
        }
    }
    /**
     * Emit events for different incident types
     */
    emitIncidentEvents(matchId, incident) {
        // General incident event
        this.emit('incident:added', { matchId, incident });
        // Specific events by type
        switch (incident.type) {
            case EVENT_TYPES.GOAL:
            case EVENT_TYPES.PENALTY:
            case EVENT_TYPES.OWN_GOAL:
                this.emit('incident:goal', {
                    matchId,
                    incident,
                    homeScore: incident.home_score ?? 0,
                    awayScore: incident.away_score ?? 0,
                });
                break;
            case EVENT_TYPES.YELLOW_CARD:
                this.emit('incident:card', { matchId, incident, cardType: 'yellow' });
                break;
            case EVENT_TYPES.RED_CARD:
            case EVENT_TYPES.CARD_UPGRADE:
                this.emit('incident:card', { matchId, incident, cardType: 'red' });
                break;
            case EVENT_TYPES.SUBSTITUTION:
                this.emit('incident:substitution', { matchId, incident });
                break;
        }
    }
    /**
     * Get incidents for a match from database
     */
    async getMatchIncidents(matchId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT type, time, position, player_name, player_id,
               assist1_name, in_player_name, out_player_name,
               home_score, away_score, var_reason, reason_type, add_time
        FROM ts_incidents
        WHERE match_id = $1
        ORDER BY time DESC
      `, [matchId]);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get orchestrator statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Health check
     */
    async healthCheck() {
        let redis = false;
        let db = false;
        try {
            redis = await RedisManager_1.RedisManager.healthCheck();
        }
        catch { /* ignore */ }
        try {
            const client = await connection_1.pool.connect();
            await client.query('SELECT 1');
            client.release();
            db = true;
        }
        catch { /* ignore */ }
        return {
            healthy: redis && db,
            redis,
            db,
        };
    }
}
exports.IncidentOrchestrator = IncidentOrchestrator;
IncidentOrchestrator.instance = null;
// Export singleton getter
const getIncidentOrchestrator = () => IncidentOrchestrator.getInstance();
exports.getIncidentOrchestrator = getIncidentOrchestrator;
