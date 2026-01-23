"use strict";
/**
 * Prediction Orchestrator
 *
 * Event-driven orchestrator for AI prediction CRUD operations.
 * Pattern: EventEmitter + Singleton (same as LiveMatchOrchestrator)
 *
 * Events emitted:
 * - prediction:created (when new prediction ingested)
 * - prediction:updated (when prediction modified)
 * - prediction:deleted (when prediction removed)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictionOrchestrator = void 0;
const events_1 = require("events");
const connection_1 = require("../../database/connection");
const RedisManager_1 = require("../../core/RedisManager");
const logger_1 = require("../../utils/logger");
class PredictionOrchestrator extends events_1.EventEmitter {
    static getInstance() {
        if (!this.instance) {
            this.instance = new PredictionOrchestrator();
        }
        return this.instance;
    }
    /**
     * Create new prediction (from ingest or manual)
     *
     * Flow:
     * 1. Acquire Redis lock (prevent duplicate ingest)
     * 2. Check existing prediction by external_id
     * 3. Insert to database
     * 4. Emit prediction:created event
     * 5. Release lock
     */
    async createPrediction(data) {
        const lockKey = `prediction:create:${data.external_id}`;
        const lockTTL = 3; // 3 seconds
        try {
            // Step 1: Acquire lock (prevent duplicate ingest)
            const redisAvailable = RedisManager_1.RedisManager.isAvailable();
            let lockAcquired = false;
            if (redisAvailable) {
                lockAcquired = await RedisManager_1.RedisManager.acquireLock(lockKey, 'ingest', lockTTL);
                if (!lockAcquired) {
                    logger_1.logger.warn(`[PredictionOrchestrator] Lock busy for ${data.external_id}`);
                    return { status: 'duplicate', reason: 'Already processing' };
                }
            }
            else {
                logger_1.logger.warn('[PredictionOrchestrator] Redis unavailable - proceeding without lock');
            }
            // Step 2: Check duplicate
            const existing = await connection_1.pool.query('SELECT id FROM ai_predictions WHERE external_id = $1', [data.external_id]);
            if (existing.rows.length > 0) {
                if (redisAvailable && lockAcquired) {
                    await RedisManager_1.RedisManager.releaseLock(lockKey);
                }
                logger_1.logger.debug(`[PredictionOrchestrator] Duplicate prediction: ${data.external_id}`);
                return { status: 'duplicate', predictionId: existing.rows[0].id };
            }
            // Step 3: Database insert
            const result = await connection_1.pool.query(`
        INSERT INTO ai_predictions (
          external_id, canonical_bot_name, league_name,
          home_team_name, away_team_name, home_team_logo, away_team_logo,
          score_at_prediction, minute_at_prediction, prediction, prediction_threshold,
          match_id, match_time, match_status, access_type, source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING id, external_id, created_at
      `, [
                data.external_id,
                data.canonical_bot_name,
                data.league_name,
                data.home_team_name,
                data.away_team_name,
                data.home_team_logo || null,
                data.away_team_logo || null,
                data.score_at_prediction,
                data.minute_at_prediction,
                data.prediction,
                data.prediction_threshold,
                data.match_id || null,
                data.match_time || null,
                data.match_status || 1,
                data.access_type || 'FREE',
                data.source || 'external',
            ]);
            const prediction = result.rows[0];
            // Step 4: Emit event
            this.emit('prediction:created', {
                predictionId: prediction.id,
                externalId: prediction.external_id,
                botName: data.canonical_bot_name,
                matchId: data.match_id || '', // Empty string if not matched
                prediction: data.prediction,
                accessType: data.access_type || 'FREE',
                timestamp: Date.now(),
            });
            logger_1.logger.info(`[PredictionOrchestrator] Created prediction: ${prediction.id} (${data.external_id})`);
            // Step 5: Release lock
            if (redisAvailable && lockAcquired) {
                await RedisManager_1.RedisManager.releaseLock(lockKey);
            }
            return { status: 'success', predictionId: prediction.id };
        }
        catch (error) {
            logger_1.logger.error('[PredictionOrchestrator] createPrediction error:', error);
            // Release lock on error
            const redisAvailable = RedisManager_1.RedisManager.isAvailable();
            if (redisAvailable) {
                await RedisManager_1.RedisManager.releaseLock(lockKey).catch(() => {
                    // Ignore lock release errors
                });
            }
            return { status: 'error', reason: error.message };
        }
    }
    /**
     * Update prediction (access_type, match_id, etc.)
     *
     * Flow:
     * 1. Acquire Redis lock
     * 2. Build dynamic UPDATE query based on fields provided
     * 3. Execute update
     * 4. Emit prediction:updated event
     * 5. Release lock
     */
    async updatePrediction(predictionId, updates) {
        const lockKey = `prediction:update:${predictionId}`;
        const lockTTL = 3;
        try {
            const redisAvailable = RedisManager_1.RedisManager.isAvailable();
            let lockAcquired = false;
            if (redisAvailable) {
                lockAcquired = await RedisManager_1.RedisManager.acquireLock(lockKey, 'update', lockTTL);
                if (!lockAcquired) {
                    logger_1.logger.warn(`[PredictionOrchestrator] Lock busy for prediction ${predictionId}`);
                    return { status: 'error', reason: 'Lock busy' };
                }
            }
            // Build dynamic UPDATE query
            const fields = [];
            const values = [];
            let paramIndex = 1;
            if (updates.access_type) {
                fields.push(`access_type = $${paramIndex++}`);
                values.push(updates.access_type);
            }
            if (updates.match_id !== undefined) {
                fields.push(`match_id = $${paramIndex++}`);
                values.push(updates.match_id);
            }
            if (updates.match_time !== undefined) {
                fields.push(`match_time = $${paramIndex++}`);
                values.push(updates.match_time);
            }
            if (updates.match_status !== undefined) {
                fields.push(`match_status = $${paramIndex++}`);
                values.push(updates.match_status);
            }
            if (fields.length === 0) {
                if (redisAvailable && lockAcquired) {
                    await RedisManager_1.RedisManager.releaseLock(lockKey);
                }
                return { status: 'success' };
            }
            values.push(predictionId);
            const query = `
        UPDATE ai_predictions
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, external_id, match_id
      `;
            const result = await connection_1.pool.query(query, values);
            if (result.rows.length === 0) {
                if (redisAvailable && lockAcquired) {
                    await RedisManager_1.RedisManager.releaseLock(lockKey);
                }
                return { status: 'not_found' };
            }
            const prediction = result.rows[0];
            // Emit event
            this.emit('prediction:updated', {
                predictionId,
                matchId: prediction.match_id || '', // Empty string if not matched
                fields: Object.keys(updates),
                timestamp: Date.now(),
            });
            logger_1.logger.info(`[PredictionOrchestrator] Updated prediction: ${predictionId} (fields: ${Object.keys(updates).join(', ')})`);
            if (redisAvailable && lockAcquired) {
                await RedisManager_1.RedisManager.releaseLock(lockKey);
            }
            return { status: 'success' };
        }
        catch (error) {
            logger_1.logger.error('[PredictionOrchestrator] updatePrediction error:', error);
            const redisAvailable = RedisManager_1.RedisManager.isAvailable();
            if (redisAvailable) {
                await RedisManager_1.RedisManager.releaseLock(lockKey).catch(() => {
                    // Ignore lock release errors
                });
            }
            return { status: 'error', reason: error.message };
        }
    }
    /**
     * Delete prediction
     *
     * Flow:
     * 1. Acquire Redis lock
     * 2. Delete from database
     * 3. Emit prediction:deleted event
     * 4. Release lock
     */
    async deletePrediction(predictionId) {
        const lockKey = `prediction:delete:${predictionId}`;
        const lockTTL = 3;
        try {
            const redisAvailable = RedisManager_1.RedisManager.isAvailable();
            let lockAcquired = false;
            if (redisAvailable) {
                lockAcquired = await RedisManager_1.RedisManager.acquireLock(lockKey, 'delete', lockTTL);
                if (!lockAcquired) {
                    logger_1.logger.warn(`[PredictionOrchestrator] Lock busy for prediction ${predictionId}`);
                    return { status: 'error' };
                }
            }
            const result = await connection_1.pool.query('DELETE FROM ai_predictions WHERE id = $1 RETURNING external_id, match_id', [predictionId]);
            if (result.rows.length === 0) {
                if (redisAvailable && lockAcquired) {
                    await RedisManager_1.RedisManager.releaseLock(lockKey);
                }
                return { status: 'not_found' };
            }
            const prediction = result.rows[0];
            this.emit('prediction:deleted', {
                predictionId,
                matchId: prediction.match_id || '', // Empty string if not matched
                timestamp: Date.now(),
            });
            logger_1.logger.info(`[PredictionOrchestrator] Deleted prediction: ${predictionId}`);
            if (redisAvailable && lockAcquired) {
                await RedisManager_1.RedisManager.releaseLock(lockKey);
            }
            return { status: 'success' };
        }
        catch (error) {
            logger_1.logger.error('[PredictionOrchestrator] deletePrediction error:', error);
            const redisAvailable = RedisManager_1.RedisManager.isAvailable();
            if (redisAvailable) {
                await RedisManager_1.RedisManager.releaseLock(lockKey).catch(() => {
                    // Ignore lock release errors
                });
            }
            return { status: 'error' };
        }
    }
}
exports.PredictionOrchestrator = PredictionOrchestrator;
PredictionOrchestrator.instance = null;
