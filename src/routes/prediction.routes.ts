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
import { unifiedPredictionService, PredictionFilter } from '../services/ai/unifiedPrediction.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

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
     * GET /api/predictions/rules
     * Get all bot rules
     */
    fastify.get('/api/predictions/rules', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const rules = await aiPredictionService.getAllBotRules();
            return reply.status(200).send({
                success: true,
                rules
            });
        } catch (error) {
            logger.error('[Predictions] Get bot rules error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to retrieve bot rules'
            });
        }
    });

    /**
    * GET /api/predictions/stats/bots
    * Get statistics for all bots (Total, Wins, Losses, Ratio)
    */
    fastify.get('/api/predictions/stats/bots', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const stats = await aiPredictionService.getBotPerformanceStats();
            return reply
                .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
                .header('Pragma', 'no-cache')
                .header('Expires', '0')
                .status(200).send({
                    success: true,
                    ...stats,
                    timestamp: new Date().toISOString()
                });
        } catch (error) {
            logger.error('[Predictions] Get bot stats error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to retrieve bot statistics'
            });
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
     * GET /api/predictions/unified
     * 
     * UNIFIED ENDPOINT - Single source of truth for all prediction pages
     * Serves: /admin/predictions, /ai-predictions, /admin/bots, /admin/bots/[botName]
     * 
     * Query params:
     *   - status: all | pending | matched | won | lost
     *   - bot: bot name filter (partial match)
     *   - date: YYYY-MM-DD
     *   - access: all | vip | free
     *   - page: page number (default 1)
     *   - limit: items per page (default 50)
     */
    fastify.get('/api/predictions/unified', async (request: FastifyRequest<{
        Querystring: {
            status?: string;
            bot?: string;
            date?: string;
            access?: string;
            page?: string;
            limit?: string;
        }
    }>, reply: FastifyReply) => {
        try {
            const { status, bot, date, access, page, limit } = request.query;

            const filter: PredictionFilter = {
                status: (status as PredictionFilter['status']) || 'all',
                bot: bot || undefined,
                date: date || undefined,
                access: (access as PredictionFilter['access']) || 'all',
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? Math.min(parseInt(limit, 10), 100) : 50
            };

            const result = await unifiedPredictionService.getPredictions(filter);

            return reply.status(200).send({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('[Predictions] Unified endpoint error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/bot/:botName
     * 
     * Get specific bot detail with predictions
     */
    fastify.get('/api/predictions/bot/:botName', async (request: FastifyRequest<{
        Params: { botName: string };
        Querystring: { page?: string; limit?: string; }
    }>, reply: FastifyReply) => {
        try {
            const { botName } = request.params;
            const { page, limit } = request.query;

            const result = await unifiedPredictionService.getBotDetail(
                decodeURIComponent(botName),
                page ? parseInt(page, 10) : 1,
                limit ? Math.min(parseInt(limit, 10), 100) : 50
            );

            return reply.status(200).send({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('[Predictions] Bot detail error:', error);
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
     * Mobile app compatible format
     */
    fastify.get('/api/predictions/matched', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
        try {
            const limit = parseInt(request.query.limit || '50', 10);
            const predictions = await aiPredictionService.getMatchedPredictions(limit);

            return reply.status(200).send({
                success: true,
                data: {
                    predictions,
                    total: predictions.length
                },
                // Keep for backward compatibility
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
     * GET /api/predictions/match/:matchId
     * Get all predictions for a specific match (for match detail page)
     * Mobile app compatible format
     */
    fastify.get('/api/predictions/match/:matchId', async (request: FastifyRequest<{ Params: { matchId: string } }>, reply: FastifyReply) => {
        try {
            const { matchId } = request.params;
            const predictions = await aiPredictionService.getPredictionsByMatchId(matchId);

            return reply.status(200).send({
                success: true,
                data: {
                    predictions,
                    matchId
                },
                // Keep for backward compatibility
                count: predictions.length,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get predictions by match ID error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/bots
     * List bot stats with prediction counts
     */
    fastify.get('/api/predictions/bots', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const botStats = await aiPredictionService.getBotStats();

            return reply.status(200).send({
                success: true,
                count: botStats.length,
                bots: botStats
            });
        } catch (error) {
            logger.error('[Predictions] Get bot stats error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });



    /**
     * GET /api/predictions/bot-history
     * List predictions for a specific bot via query param (safe for special chars)
     */
    fastify.get('/api/predictions/bot-history', async (request: FastifyRequest<{ Querystring: { botName: string; limit?: string } }>, reply: FastifyReply) => {
        try {
            const { botName, limit } = request.query;

            if (!botName) {
                return reply.status(400).send({
                    success: false,
                    error: 'botName query parameter is required'
                });
            }

            const limitVal = parseInt(limit || '50', 10);
            const predictions = await aiPredictionService.getPredictionsByBotName(botName, limitVal);

            return reply.status(200).send({
                success: true,
                bot_name: botName,
                count: predictions.length,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get bot history error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/by-bot/:botName
     * List predictions for a specific bot
     */
    fastify.get('/api/predictions/by-bot/:botName', async (request: FastifyRequest<{ Params: { botName: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
        try {
            const { botName } = request.params;
            const limit = parseInt(request.query.limit || '50', 10);

            // URL decode the bot name
            const decodedBotName = decodeURIComponent(botName);
            const predictions = await aiPredictionService.getPredictionsByBotName(decodedBotName, limit);

            return reply.status(200).send({
                success: true,
                bot_name: decodedBotName,
                count: predictions.length,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get predictions by bot error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * POST /api/predictions/update-results
     * Manually trigger result updates for completed matches
     * SECURITY: Admin-only endpoint
     */
    fastify.post('/api/predictions/update-results', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    /**
     * PUT /api/predictions/:id/display
     * Update display_prediction text for a prediction (admin only)
     * This is what users will see in the TAHMİN column
     * SECURITY: Admin-only endpoint
     */
    fastify.put('/api/predictions/:id/display', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{ Params: { id: string }; Body: { display_prediction: string } }>, reply: FastifyReply) => {
        try {
            const { id } = request.params;
            const { display_prediction } = request.body;

            if (!id) {
                return reply.status(400).send({
                    success: false,
                    error: 'Prediction ID required'
                });
            }

            const success = await aiPredictionService.updateDisplayPrediction(id, display_prediction || '');

            if (success) {
                return reply.status(200).send({
                    success: true,
                    message: 'Display prediction updated',
                    prediction_id: id,
                    display_prediction: display_prediction
                });
            } else {
                return reply.status(404).send({
                    success: false,
                    error: 'Prediction not found'
                });
            }
        } catch (error) {
            logger.error('[Predictions] Update display error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * PUT /api/predictions/bulk-display
     * Bulk update display_prediction for multiple predictions
     * SECURITY: Admin-only endpoint
     */
    fastify.put('/api/predictions/bulk-display', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{ Body: { updates: { id: string; display_prediction: string }[] } }>, reply: FastifyReply) => {
        try {
            const { updates } = request.body;

            if (!Array.isArray(updates) || updates.length === 0) {
                return reply.status(400).send({
                    success: false,
                    error: 'Updates array required'
                });
            }

            const mappedUpdates = updates.map(u => ({
                id: u.id,
                displayText: u.display_prediction
            }));

            const updatedCount = await aiPredictionService.bulkUpdateDisplayPrediction(mappedUpdates);

            return reply.status(200).send({
                success: true,
                updated_count: updatedCount,
                message: `Updated ${updatedCount} predictions`
            });
        } catch (error) {
            logger.error('[Predictions] Bulk display update error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * PUT /api/predictions/:id/access
     * Toggle access_type between VIP and FREE
     * SECURITY: Admin-only endpoint
     */
    fastify.put('/api/predictions/:id/access', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{ Params: { id: string }; Body: { access_type: 'VIP' | 'FREE' } }>, reply: FastifyReply) => {
        try {
            const { id } = request.params;
            const { access_type } = request.body;

            if (!id) {
                return reply.status(400).send({
                    success: false,
                    error: 'Prediction ID required'
                });
            }

            if (!access_type || !['VIP', 'FREE'].includes(access_type)) {
                return reply.status(400).send({
                    success: false,
                    error: 'Valid access_type (VIP or FREE) required'
                });
            }

            const result = await pool.query(`
                UPDATE ai_predictions
                SET access_type = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, access_type
            `, [access_type, id]);

            if (result.rowCount === 0) {
                return reply.status(404).send({
                    success: false,
                    error: 'Prediction not found'
                });
            }

            logger.info(`[Predictions] Access type updated: ${id} -> ${access_type}`);

            return reply.status(200).send({
                success: true,
                message: 'Access type updated',
                prediction_id: id,
                access_type: access_type
            });
        } catch (error) {
            logger.error('[Predictions] Update access type error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/displayable
     * Get predictions with display_prediction set (for user-facing components)
     * Only returns predictions that have admin-defined display text
     */
    fastify.get('/api/predictions/displayable', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
        try {
            const limit = parseInt(request.query.limit || '50', 10);
            const predictions = await aiPredictionService.getDisplayablePredictions(limit);

            return reply.status(200).send({
                success: true,
                count: predictions.length,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get displayable error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * GET /api/predictions/manual
     * List manual predictions
     * SECURITY: Admin only - lists all manual predictions
     */
    fastify.get('/api/predictions/manual', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
        try {
            const limit = parseInt(request.query.limit || '100', 10);
            const predictions = await aiPredictionService.getManualPredictions(limit);

            return reply.status(200).send({
                success: true,
                predictions
            });
        } catch (error) {
            logger.error('[Predictions] Get manual predictions error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * POST /api/predictions/manual
     * Create a new manual prediction (New 29-column schema)
     */
    interface ManualPredictionBody {
        match_id: string;           // ts_matches.id
        home_team: string;
        away_team: string;
        league: string;
        score: string;              // "0-0"
        minute: number;             // 15
        prediction: string;         // "IY 0.5 ÜST", "MS 2.5 ÜST"
        access_type: 'VIP' | 'FREE';
        bot_name?: string;          // Optional, defaults to "Manual"
    }

    // SECURITY: Admin authentication required for manual prediction creation
    fastify.post('/api/predictions/manual', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{ Body: ManualPredictionBody }>, reply: FastifyReply) => {
        try {
            const result = await aiPredictionService.createManualPrediction(request.body);
            if (result) {
                return reply.status(200).send({ success: true, message: 'Prediction created', prediction: result });
            } else {
                return reply.status(500).send({ success: false, error: 'Failed to create prediction' });
            }
        } catch (error) {
            logger.error('[Predictions] Create manual prediction error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * POST /api/predictions/manual-coupon
     * Create a new Combined Betting Coupon
     */
    interface CouponBody {
        title: string;
        access_type: 'VIP' | 'FREE';
        items: Array<{
            match_id: string;
            home_team: string;
            away_team: string;
            league: string;
            score: string;
            minute: number;
            prediction: string;
        }>;
    }

    // SECURITY: Admin authentication required for coupon creation
    fastify.post('/api/predictions/manual-coupon', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{ Body: CouponBody }>, reply: FastifyReply) => {
        try {
            const result = await aiPredictionService.createCoupon(request.body);
            if (result) {
                return reply.status(200).send({ success: true, message: 'Coupon created', coupon: result });
            } else {
                return reply.status(500).send({ success: false, error: 'Failed to create coupon' });
            }
        } catch (error) {
            logger.error('[Predictions] Create coupon error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * POST /api/predictions/match-unmatched
     *
     * Manually trigger prediction matcher to match all unmatched predictions
     * Requires admin authentication
     */
    fastify.post('/api/predictions/match-unmatched', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { predictionMatcherService } = await import('../services/ai/predictionMatcher.service');

            logger.info('[Predictions] Manually triggering prediction matcher...');
            const results = await predictionMatcherService.matchUnmatchedPredictions();

            const successCount = results.filter(r => r.matchFound).length;

            return reply.status(200).send({
                success: true,
                message: `Matched ${successCount}/${results.length} predictions`,
                total: results.length,
                matched: successCount,
                results: results
            });
        } catch (error) {
            logger.error('[Predictions] Match unmatched predictions error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    /**
     * POST /api/predictions/match/:externalId
     *
     * Match a specific prediction by external ID
     * Requires admin authentication
     */
    fastify.post('/api/predictions/match/:externalId', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest<{
        Params: { externalId: string }
    }>, reply: FastifyReply) => {
        try {
            const { predictionMatcherService } = await import('../services/ai/predictionMatcher.service');

            const { externalId } = request.params;

            logger.info(`[Predictions] Manually matching prediction ${externalId}...`);
            const result = await predictionMatcherService.matchByExternalId(externalId);

            if (result.matchFound) {
                return reply.status(200).send({
                    success: true,
                    message: 'Prediction matched successfully',
                    result: result
                });
            } else {
                return reply.status(404).send({
                    success: false,
                    message: 'No matching match found',
                    result: result
                });
            }
        } catch (error) {
            logger.error('[Predictions] Match prediction error:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    logger.info('[Routes] AI Prediction routes registered');
}
