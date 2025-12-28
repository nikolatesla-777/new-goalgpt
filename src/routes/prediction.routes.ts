/**
 * AI Prediction Routes
 * 
 * API endpoints for AI prediction ingestion and management.
 * These run on the VPS backend (Digital Ocean).
 * 
 * All incoming requests are logged for debugging (success/failure).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { aiPredictionService, RawPredictionPayload } from '../services/ai/aiPrediction.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

interface IngestBody {
    id?: string;
    date?: string;
    prediction?: string;
    bot_name?: string;
    league?: string;
    home_team?: string;
    away_team?: string;
    score?: string;
    minute?: string | number;
    prediction_type?: string;
    prediction_value?: string;
}

/**
 * Log an incoming request to the database
 */
async function logRequest(
    request: FastifyRequest,
    endpoint: string,
    responseStatus: number,
    responseBody: any,
    success: boolean,
    errorMessage?: string,
    processingTimeMs?: number
): Promise<void> {
    try {
        // Get source IP (handle proxies)
        const sourceIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || (request.headers['x-real-ip'] as string)
            || request.ip
            || 'unknown';

        const requestBody = typeof request.body === 'string'
            ? request.body
            : JSON.stringify(request.body || {});

        // Filter sensitive headers
        const safeHeaders: Record<string, any> = {};
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        for (const [key, value] of Object.entries(request.headers)) {
            if (!sensitiveHeaders.includes(key.toLowerCase())) {
                safeHeaders[key] = value;
            }
        }

        await pool.query(`
            INSERT INTO ai_prediction_requests (
                request_id, source_ip, user_agent, http_method, endpoint,
                request_headers, request_body, response_status, response_body,
                success, error_message, processing_time_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
            (request as any).requestId || `req_${Date.now()}`,
            sourceIp,
            request.headers['user-agent'] || 'unknown',
            request.method,
            endpoint,
            JSON.stringify(safeHeaders),
            requestBody.substring(0, 10000), // Limit to 10KB
            responseStatus,
            JSON.stringify(responseBody).substring(0, 5000), // Limit to 5KB
            success,
            errorMessage || null,
            processingTimeMs || null
        ]);
    } catch (error) {
        // Don't let logging errors break the main flow
        logger.error('[Predictions] Failed to log request:', error);
    }
}

export async function predictionRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /api/predictions/ingest
     * Receive AI predictions from external sources
     */
    fastify.post('/api/predictions/ingest', async (request: FastifyRequest<{ Body: IngestBody }>, reply: FastifyReply) => {
        const startTime = Date.now();
        let responseStatus = 200;
        let responseBody: any;
        let success = false;
        let errorMessage: string | undefined;

        try {
            const payload = request.body as RawPredictionPayload;

            if (!payload) {
                responseStatus = 400;
                responseBody = { success: false, error: 'Empty payload' };
                errorMessage = 'Empty payload';
                return reply.status(400).send(responseBody);
            }

            logger.info('[Predictions] Incoming prediction:', {
                id: payload.id,
                hasBase64: !!payload.prediction,
                hasDirectFields: !!(payload.home_team && payload.away_team)
            });

            const result = await aiPredictionService.ingestPrediction(payload);

            if (result.success) {
                success = true;
                responseBody = {
                    success: true,
                    prediction_id: result.predictionId,
                    match_found: result.matchFound,
                    match_external_id: result.matchExternalId,
                    confidence: result.confidence,
                    message: result.matchFound
                        ? `Prediction matched to ${result.matchExternalId}`
                        : 'Prediction stored, no match found'
                };
                return reply.status(200).send(responseBody);
            } else {
                responseStatus = 400;
                errorMessage = result.error;
                responseBody = { success: false, error: result.error };
                return reply.status(400).send(responseBody);
            }

        } catch (error) {
            responseStatus = 500;
            errorMessage = error instanceof Error ? error.message : 'Internal server error';
            responseBody = { success: false, error: errorMessage };
            logger.error('[Predictions] Ingest error:', error);
            return reply.status(500).send(responseBody);
        } finally {
            await logRequest(request, '/api/predictions/ingest', responseStatus, responseBody, success, errorMessage, Date.now() - startTime);
        }
    });

    /**
     * POST /api/v1/ingest/predictions
     * Legacy endpoint for backwards compatibility with existing external systems
     */
    fastify.post('/api/v1/ingest/predictions', async (request: FastifyRequest<{ Body: IngestBody }>, reply: FastifyReply) => {
        const startTime = Date.now();
        let responseStatus = 200;
        let responseBody: any;
        let success = false;
        let errorMessage: string | undefined;

        try {
            const payload = request.body as RawPredictionPayload;

            logger.info('[Predictions] Legacy ingest endpoint called');

            const result = await aiPredictionService.ingestPrediction(payload);
            success = result.success;

            // Return legacy format for backwards compatibility
            responseBody = {
                type: 'legacy',
                count: 1,
                message: result.success ? 'Prediction received' : result.error,
                success: result.success,
                // Extended info
                prediction_id: result.predictionId,
                match_found: result.matchFound
            };

            if (!result.success) {
                errorMessage = result.error;
            }

            return reply.status(200).send(responseBody);

        } catch (error) {
            responseStatus = 500;
            errorMessage = error instanceof Error ? error.message : 'Server error';
            responseBody = {
                type: 'legacy',
                count: 0,
                message: 'Server error',
                success: false
            };
            logger.error('[Predictions] Legacy ingest error:', error);
            return reply.status(500).send(responseBody);
        } finally {
            await logRequest(request, '/api/v1/ingest/predictions', responseStatus, responseBody, success, errorMessage, Date.now() - startTime);
        }
    });

    /**
     * GET /api/predictions/requests
     * Get request logs for debugging
     */
    fastify.get('/api/predictions/requests', async (request: FastifyRequest<{ Querystring: { limit?: string; success?: string } }>, reply: FastifyReply) => {
        try {
            const limit = parseInt(request.query.limit || '50', 10);
            const successFilter = request.query.success;

            let query = `
                SELECT 
                    id, request_id, source_ip, user_agent, http_method, endpoint,
                    request_body, response_status, response_body,
                    success, error_message, processing_time_ms, created_at
                FROM ai_prediction_requests 
            `;

            const params: any[] = [];
            if (successFilter !== undefined) {
                query += ' WHERE success = $1';
                params.push(successFilter === 'true');
            }

            query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
            params.push(limit);

            const result = await pool.query(query, params);

            return reply.status(200).send({
                success: true,
                count: result.rows.length,
                requests: result.rows.map(row => ({
                    ...row,
                    request_body: row.request_body ? JSON.parse(row.request_body) : null,
                    response_body: row.response_body ? JSON.parse(row.response_body) : null
                }))
            });
        } catch (error) {
            logger.error('[Predictions] Get requests error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/pending
     * List pending (unmatched) predictions
     */
    fastify.get('/api/predictions/pending', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
        try {
            const limit = parseInt(request.query.limit || '50', 10);
            const predictions = await aiPredictionService.getPendingPredictions(limit);

            return reply.status(200).send({
                success: true,
                count: predictions.length,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get pending error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/matched
     * List matched predictions with results
     */
    fastify.get('/api/predictions/matched', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
        try {
            const limit = parseInt(request.query.limit || '50', 10);
            const predictions = await aiPredictionService.getMatchedPredictions(limit);

            return reply.status(200).send({
                success: true,
                count: predictions.length,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get matched error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * POST /api/predictions/update-results
     * Manually trigger result updates for completed matches
     */
    fastify.post('/api/predictions/update-results', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const updatedCount = await aiPredictionService.updatePredictionResults();

            return reply.status(200).send({
                success: true,
                updated_count: updatedCount,
                message: `Updated ${updatedCount} prediction results`
            });
        } catch (error) {
            logger.error('[Predictions] Update results error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/stats
     * Get prediction statistics
     */
    fastify.get('/api/predictions/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const statsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM ai_predictions) as total,
                    (SELECT COUNT(*) FROM ai_predictions WHERE processed = false) as pending,
                    (SELECT COUNT(*) FROM ai_prediction_matches WHERE match_status = 'matched') as matched,
                    (SELECT COUNT(*) FROM ai_prediction_matches WHERE prediction_result = 'winner') as winners,
                    (SELECT COUNT(*) FROM ai_prediction_matches WHERE prediction_result = 'loser') as losers,
                    (SELECT AVG(overall_confidence) FROM ai_prediction_matches WHERE match_status = 'matched') as avg_confidence,
                    (SELECT COUNT(*) FROM ai_prediction_requests) as total_requests,
                    (SELECT COUNT(*) FROM ai_prediction_requests WHERE success = true) as successful_requests,
                    (SELECT COUNT(*) FROM ai_prediction_requests WHERE success = false) as failed_requests
            `;

            const result = await pool.query(statsQuery);
            const stats = result.rows[0];

            return reply.status(200).send({
                success: true,
                stats: {
                    predictions: {
                        total: parseInt(stats.total) || 0,
                        pending: parseInt(stats.pending) || 0,
                        matched: parseInt(stats.matched) || 0,
                        winners: parseInt(stats.winners) || 0,
                        losers: parseInt(stats.losers) || 0,
                        win_rate: stats.winners > 0
                            ? ((parseInt(stats.winners) / (parseInt(stats.winners) + parseInt(stats.losers))) * 100).toFixed(1) + '%'
                            : 'N/A',
                        avg_confidence: stats.avg_confidence
                            ? (parseFloat(stats.avg_confidence) * 100).toFixed(1) + '%'
                            : 'N/A'
                    },
                    requests: {
                        total: parseInt(stats.total_requests) || 0,
                        successful: parseInt(stats.successful_requests) || 0,
                        failed: parseInt(stats.failed_requests) || 0,
                        success_rate: stats.total_requests > 0
                            ? ((parseInt(stats.successful_requests) / parseInt(stats.total_requests)) * 100).toFixed(1) + '%'
                            : 'N/A'
                    }
                }
            });
        } catch (error) {
            logger.error('[Predictions] Get stats error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    logger.info('[Routes] AI Prediction routes registered');
}
