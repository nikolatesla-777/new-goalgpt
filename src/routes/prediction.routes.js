"use strict";
/**
 * AI Prediction Routes
 *
 * API endpoints for AI prediction ingestion and management.
 * These run on the VPS backend (Digital Ocean).
 *
 * All incoming requests are logged for debugging (success/failure).
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictionRoutes = predictionRoutes;
var aiPrediction_service_1 = require("../services/ai/aiPrediction.service");
var unifiedPrediction_service_1 = require("../services/ai/unifiedPrediction.service");
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
var auth_middleware_1 = require("../middleware/auth.middleware");
var memoryCache_1 = require("../utils/cache/memoryCache");
var singleFlight_1 = require("../utils/cache/singleFlight");
var cacheKeyGenerator_1 = require("../utils/cache/cacheKeyGenerator");
var deprecation_utils_1 = require("../utils/deprecation.utils");
// PR-10: Schema validation
var validation_middleware_1 = require("../middleware/validation.middleware");
var prediction_schema_1 = require("../schemas/prediction.schema");
/**
 * Cache Configuration for Empty Responses
 *
 * Business Rule Decision:
 * - CACHE_EMPTY_RESPONSES=true: Empty results are normal (user has no predictions yet)
 *   → Cache empty arrays with short TTL (10-15s) to reduce DB load
 *   → Use when: Empty responses are frequent and legitimate
 *
 * - CACHE_EMPTY_RESPONSES=false: Empty results indicate temporary error/incomplete data
 *   → Don't cache empty arrays, retry on next request
 *   → Use when: Empty responses are rare or indicate API issues
 *
 * Default: true (predictions endpoint often returns empty for new users)
 */
var CACHE_EMPTY_RESPONSES = process.env.CACHE_EMPTY_RESPONSES !== 'false';
/**
 * Log an incoming request to the database
 */
function logRequest(request, endpoint, responseStatus, responseBody, success, errorMessage, processingTimeMs) {
    return __awaiter(this, void 0, void 0, function () {
        var sourceIp, requestBody, safeHeaders, sensitiveHeaders, _i, _a, _b, key, value, error_1;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    sourceIp = ((_d = (_c = request.headers['x-forwarded-for']) === null || _c === void 0 ? void 0 : _c.split(',')[0]) === null || _d === void 0 ? void 0 : _d.trim())
                        || request.headers['x-real-ip']
                        || request.ip
                        || 'unknown';
                    requestBody = typeof request.body === 'string'
                        ? request.body
                        : JSON.stringify(request.body || {});
                    safeHeaders = {};
                    sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
                    for (_i = 0, _a = Object.entries(request.headers); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        if (!sensitiveHeaders.includes(key.toLowerCase())) {
                            safeHeaders[key] = value;
                        }
                    }
                    return [4 /*yield*/, connection_1.pool.query("\n            INSERT INTO ai_prediction_requests (\n                request_id, source_ip, user_agent, http_method, endpoint,\n                request_headers, request_body, response_status, response_body,\n                success, error_message, processing_time_ms\n            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)\n        ", [
                            request.requestId || "req_".concat(Date.now()),
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
                        ])];
                case 1:
                    _e.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _e.sent();
                    // Don't let logging errors break the main flow
                    logger_1.logger.error('[Predictions] Failed to log request:', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function predictionRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * POST /api/predictions/ingest
             * Receive AI predictions from external sources
             */
            // PR-10: Non-strict validation for external bot submissions
            fastify.post('/api/predictions/ingest', { preHandler: [(0, validation_middleware_1.validate)({ body: prediction_schema_1.ingestPredictionSchema, strict: false })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var startTime, responseStatus, responseBody, success, errorMessage, payload, result, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            responseStatus = 200;
                            success = false;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, 4, 6]);
                            payload = request.body;
                            if (!payload) {
                                responseStatus = 400;
                                responseBody = { success: false, error: 'Empty payload' };
                                errorMessage = 'Empty payload';
                                return [2 /*return*/, reply.status(400).send(responseBody)];
                            }
                            logger_1.logger.info('[Predictions] Incoming prediction:', {
                                id: payload.id,
                                hasBase64: !!payload.prediction,
                                hasDirectFields: !!(payload.home_team && payload.away_team)
                            });
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.ingestPrediction(payload)];
                        case 2:
                            result = _a.sent();
                            if (result.success) {
                                success = true;
                                responseBody = {
                                    success: true,
                                    prediction_id: result.predictionId,
                                    match_found: result.matchFound,
                                    match_external_id: result.matchExternalId,
                                    confidence: result.confidence,
                                    message: result.matchFound
                                        ? "Prediction matched to ".concat(result.matchExternalId)
                                        : 'Prediction stored, no match found'
                                };
                                return [2 /*return*/, reply.status(200).send(responseBody)];
                            }
                            else {
                                responseStatus = 400;
                                errorMessage = result.error;
                                responseBody = { success: false, error: result.error };
                                return [2 /*return*/, reply.status(400).send(responseBody)];
                            }
                            return [3 /*break*/, 6];
                        case 3:
                            error_2 = _a.sent();
                            responseStatus = 500;
                            errorMessage = error_2 instanceof Error ? error_2.message : 'Internal server error';
                            responseBody = { success: false, error: errorMessage };
                            logger_1.logger.error('[Predictions] Ingest error:', error_2);
                            return [2 /*return*/, reply.status(500).send(responseBody)];
                        case 4: return [4 /*yield*/, logRequest(request, '/api/predictions/ingest', responseStatus, responseBody, success, errorMessage, Date.now() - startTime)];
                        case 5:
                            _a.sent();
                            return [7 /*endfinally*/];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/v1/ingest/predictions
             * PR-11: DEPRECATED - Legacy endpoint for backwards compatibility with existing external systems
             *
             * @deprecated Use POST /api/predictions/ingest instead
             * @sunset 2026-03-01
             */
            // PR-10: Non-strict validation for external bot submissions
            fastify.post('/api/v1/ingest/predictions', { preHandler: [(0, validation_middleware_1.validate)({ body: prediction_schema_1.ingestPredictionSchema, strict: false })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var startTime, responseStatus, responseBody, success, errorMessage, payload, result, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // PR-11: Add deprecation headers
                            (0, deprecation_utils_1.deprecateRoute)(request, reply, {
                                canonical: '/api/predictions/ingest',
                                sunset: '2026-03-01T00:00:00Z',
                                docs: 'https://docs.goalgpt.app/api/predictions/ingest',
                                message: 'This v1 endpoint is deprecated. Use POST /api/predictions/ingest for the modern API.'
                            });
                            startTime = Date.now();
                            responseStatus = 200;
                            success = false;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, 4, 6]);
                            payload = request.body;
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.ingestPrediction(payload)];
                        case 2:
                            result = _a.sent();
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
                            return [2 /*return*/, reply.status(200).send(responseBody)];
                        case 3:
                            error_3 = _a.sent();
                            responseStatus = 500;
                            errorMessage = error_3 instanceof Error ? error_3.message : 'Server error';
                            responseBody = {
                                type: 'legacy',
                                count: 0,
                                message: 'Server error',
                                success: false
                            };
                            logger_1.logger.error('[Predictions] Legacy ingest error:', error_3);
                            return [2 /*return*/, reply.status(500).send(responseBody)];
                        case 4: return [4 /*yield*/, logRequest(request, '/api/v1/ingest/predictions', responseStatus, responseBody, success, errorMessage, Date.now() - startTime)];
                        case 5:
                            _a.sent();
                            return [7 /*endfinally*/];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/rules
             * Get all bot rules
             */
            fastify.get('/api/predictions/rules', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var rules, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getAllBotRules()];
                        case 1:
                            rules = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    rules: rules
                                })];
                        case 2:
                            error_4 = _a.sent();
                            logger_1.logger.error('[Predictions] Get bot rules error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to retrieve bot rules'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
            * GET /api/predictions/stats/bots
            * Get statistics for all bots (Total, Wins, Losses, Ratio)
            */
            fastify.get('/api/predictions/stats/bots', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getBotPerformanceStats()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, reply
                                    .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
                                    .header('Pragma', 'no-cache')
                                    .header('Expires', '0')
                                    .status(200).send(__assign(__assign({ success: true }, stats), { timestamp: new Date().toISOString() }))];
                        case 2:
                            error_5 = _a.sent();
                            logger_1.logger.error('[Predictions] Get bot stats error:', error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'Failed to retrieve bot statistics'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/requests
             * Get request logs for debugging
             */
            fastify.get('/api/predictions/requests', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, successFilter, query, params, result, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = parseInt(request.query.limit || '50', 10);
                            successFilter = request.query.success;
                            query = "\n                SELECT \n                    id, request_id, source_ip, user_agent, http_method, endpoint,\n                    request_body, response_status, response_body,\n                    success, error_message, processing_time_ms, created_at\n                FROM ai_prediction_requests \n            ";
                            params = [];
                            if (successFilter !== undefined) {
                                query += ' WHERE success = $1';
                                params.push(successFilter === 'true');
                            }
                            query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
                            params.push(limit);
                            return [4 /*yield*/, connection_1.pool.query(query, params)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    count: result.rows.length,
                                    requests: result.rows.map(function (row) { return (__assign(__assign({}, row), { request_body: row.request_body ? JSON.parse(row.request_body) : null, response_body: row.response_body ? JSON.parse(row.response_body) : null })); })
                                })];
                        case 2:
                            error_6 = _a.sent();
                            logger_1.logger.error('[Predictions] Get requests error:', error_6);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_6 instanceof Error ? error_6.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
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
            fastify.get('/api/predictions/unified', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, status_1, bot, date, access, page, limit, filter, result, error_7;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.query, status_1 = _a.status, bot = _a.bot, date = _a.date, access = _a.access, page = _a.page, limit = _a.limit;
                            filter = {
                                status: status_1 || 'all',
                                bot: bot || undefined,
                                date: date || undefined,
                                access: access || 'all',
                                page: page ? parseInt(page, 10) : 1,
                                limit: limit ? Math.min(parseInt(limit, 10), 100) : 50
                            };
                            return [4 /*yield*/, unifiedPrediction_service_1.unifiedPredictionService.getPredictions(filter)];
                        case 1:
                            result = _b.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    data: result
                                })];
                        case 2:
                            error_7 = _b.sent();
                            logger_1.logger.error('[Predictions] Unified endpoint error:', error_7);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_7 instanceof Error ? error_7.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/bot/:botName
             *
             * Get specific bot detail with predictions
             */
            fastify.get('/api/predictions/bot/:botName', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var botName, _a, page, limit, result, error_8;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            botName = request.params.botName;
                            _a = request.query, page = _a.page, limit = _a.limit;
                            return [4 /*yield*/, unifiedPrediction_service_1.unifiedPredictionService.getBotDetail(decodeURIComponent(botName), page ? parseInt(page, 10) : 1, limit ? Math.min(parseInt(limit, 10), 100) : 50)];
                        case 1:
                            result = _b.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    data: result
                                })];
                        case 2:
                            error_8 = _b.sent();
                            logger_1.logger.error('[Predictions] Bot detail error:', error_8);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_8 instanceof Error ? error_8.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/pending
             * List pending (unmatched) predictions
             */
            fastify.get('/api/predictions/pending', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, predictions, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = parseInt(request.query.limit || '50', 10);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getPendingPredictions(limit)];
                        case 1:
                            predictions = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    count: predictions.length,
                                    predictions: predictions
                                })];
                        case 2:
                            error_9 = _a.sent();
                            logger_1.logger.error('[Predictions] Get pending error:', error_9);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_9 instanceof Error ? error_9.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/matched
             * List matched predictions with results
             * Mobile app compatible format
             *
             * CACHE: 30s TTL (reduces pool exhaustion on peak load)
             * IN-FLIGHT DEDUPE: Single DB query for concurrent requests
             */
            fastify.get('/api/predictions/matched', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var startTime, limit_1, userId, cacheKey_1, cached, cacheAge, response, error_10;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            limit_1 = parseInt(request.query.limit || '50', 10);
                            userId = request.query.userId;
                            cacheKey_1 = (0, cacheKeyGenerator_1.generatePredictionsCacheKey)({ limit: limit_1, userId: userId });
                            cached = memoryCache_1.memoryCache.get('predictions', cacheKey_1);
                            if (cached) {
                                cacheAge = Date.now() - startTime;
                                logger_1.logger.debug("[Predictions] Cache HIT for ".concat(cacheKey_1, " (").concat(cacheAge, "ms)"));
                                return [2 /*return*/, reply.status(200).send(cached)];
                            }
                            return [4 /*yield*/, singleFlight_1.singleFlight.do(cacheKey_1, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var doubleCheck, dbStartTime, predictions, dbDuration, result, totalDuration, hasData, isEmpty;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                doubleCheck = memoryCache_1.memoryCache.get('predictions', cacheKey_1);
                                                if (doubleCheck) {
                                                    logger_1.logger.debug("[Predictions] Cache HIT on double-check for ".concat(cacheKey_1));
                                                    return [2 /*return*/, doubleCheck];
                                                }
                                                dbStartTime = Date.now();
                                                return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getMatchedPredictions(limit_1)];
                                            case 1:
                                                predictions = _a.sent();
                                                dbDuration = Date.now() - dbStartTime;
                                                result = {
                                                    success: true,
                                                    data: {
                                                        predictions: predictions,
                                                        total: predictions.length
                                                    },
                                                    // Keep for backward compatibility
                                                    count: predictions.length,
                                                    predictions: predictions
                                                };
                                                totalDuration = Date.now() - startTime;
                                                hasData = predictions && predictions.length > 0;
                                                isEmpty = predictions && predictions.length === 0;
                                                if (hasData) {
                                                    // Always cache results with data
                                                    memoryCache_1.memoryCache.set('predictions', cacheKey_1, result);
                                                    logger_1.logger.info("[Predictions] Cached result with data for ".concat(cacheKey_1, " - DB: ").concat(dbDuration, "ms, Total: ").concat(totalDuration, "ms"));
                                                }
                                                else if (isEmpty && CACHE_EMPTY_RESPONSES) {
                                                    // Cache empty results if configured (reduces DB load for new users)
                                                    memoryCache_1.memoryCache.set('predictions', cacheKey_1, result);
                                                    logger_1.logger.debug("[Predictions] Cached empty result for ".concat(cacheKey_1, " (CACHE_EMPTY_RESPONSES=true) - DB: ").concat(dbDuration, "ms"));
                                                }
                                                else if (isEmpty && !CACHE_EMPTY_RESPONSES) {
                                                    // Don't cache empty results (may be temporary API issue)
                                                    logger_1.logger.debug("[Predictions] Skipping cache for ".concat(cacheKey_1, " - empty result (CACHE_EMPTY_RESPONSES=false, may retry)"));
                                                }
                                                else {
                                                    // predictions is null/undefined (error case) - don't cache
                                                    logger_1.logger.warn("[Predictions] Skipping cache for ".concat(cacheKey_1, " - null/undefined result (error)"));
                                                }
                                                return [2 /*return*/, result];
                                        }
                                    });
                                }); })];
                        case 2:
                            response = _a.sent();
                            return [2 /*return*/, reply.status(200).send(response)];
                        case 3:
                            error_10 = _a.sent();
                            logger_1.logger.error('[Predictions] Get matched error:', error_10);
                            // Don't cache errors - let next request try again
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_10 instanceof Error ? error_10.message : 'Internal server error'
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/match/:matchId
             * Get all predictions for a specific match (for match detail page)
             * Mobile app compatible format
             */
            fastify.get('/api/predictions/match/:matchId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, predictions, error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getPredictionsByMatchId(matchId)];
                        case 1:
                            predictions = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    data: {
                                        predictions: predictions,
                                        matchId: matchId
                                    },
                                    // Keep for backward compatibility
                                    count: predictions.length,
                                    predictions: predictions
                                })];
                        case 2:
                            error_11 = _a.sent();
                            logger_1.logger.error('[Predictions] Get predictions by match ID error:', error_11);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_11 instanceof Error ? error_11.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/bots
             * List bot stats with prediction counts
             */
            fastify.get('/api/predictions/bots', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var botStats, error_12;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getBotStats()];
                        case 1:
                            botStats = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    count: botStats.length,
                                    bots: botStats
                                })];
                        case 2:
                            error_12 = _a.sent();
                            logger_1.logger.error('[Predictions] Get bot stats error:', error_12);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_12 instanceof Error ? error_12.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/bot-history
             * List predictions for a specific bot via query param (safe for special chars)
             */
            fastify.get('/api/predictions/bot-history', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, botName, limit, limitVal, predictions, error_13;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.query, botName = _a.botName, limit = _a.limit;
                            if (!botName) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'botName query parameter is required'
                                    })];
                            }
                            limitVal = parseInt(limit || '50', 10);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getPredictionsByBotName(botName, limitVal)];
                        case 1:
                            predictions = _b.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    bot_name: botName,
                                    count: predictions.length,
                                    predictions: predictions
                                })];
                        case 2:
                            error_13 = _b.sent();
                            logger_1.logger.error('[Predictions] Get bot history error:', error_13);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_13 instanceof Error ? error_13.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/by-bot/:botName
             * List predictions for a specific bot
             */
            fastify.get('/api/predictions/by-bot/:botName', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var botName, limit, decodedBotName, predictions, error_14;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            botName = request.params.botName;
                            limit = parseInt(request.query.limit || '50', 10);
                            decodedBotName = decodeURIComponent(botName);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getPredictionsByBotName(decodedBotName, limit)];
                        case 1:
                            predictions = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    bot_name: decodedBotName,
                                    count: predictions.length,
                                    predictions: predictions
                                })];
                        case 2:
                            error_14 = _a.sent();
                            logger_1.logger.error('[Predictions] Get predictions by bot error:', error_14);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_14 instanceof Error ? error_14.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/predictions/update-results
             * Manually trigger result updates for completed matches
             * SECURITY: Admin-only endpoint
             */
            // PR-10: This endpoint takes no body, but keep auth handlers
            fastify.post('/api/predictions/update-results', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var updatedCount, error_15;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.updatePredictionResults()];
                        case 1:
                            updatedCount = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    updated_count: updatedCount,
                                    message: "Updated ".concat(updatedCount, " prediction results")
                                })];
                        case 2:
                            error_15 = _a.sent();
                            logger_1.logger.error('[Predictions] Update results error:', error_15);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_15 instanceof Error ? error_15.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/stats
             * Get prediction statistics
             */
            fastify.get('/api/predictions/stats', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var statsQuery, result, stats, error_16;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            statsQuery = "\n                SELECT \n                    (SELECT COUNT(*) FROM ai_predictions) as total,\n                    (SELECT COUNT(*) FROM ai_predictions WHERE processed = false) as pending,\n                    (SELECT COUNT(*) FROM ai_prediction_matches WHERE match_status = 'matched') as matched,\n                    (SELECT COUNT(*) FROM ai_prediction_matches WHERE prediction_result = 'winner') as winners,\n                    (SELECT COUNT(*) FROM ai_prediction_matches WHERE prediction_result = 'loser') as losers,\n                    (SELECT AVG(overall_confidence) FROM ai_prediction_matches WHERE match_status = 'matched') as avg_confidence,\n                    (SELECT COUNT(*) FROM ai_prediction_requests) as total_requests,\n                    (SELECT COUNT(*) FROM ai_prediction_requests WHERE success = true) as successful_requests,\n                    (SELECT COUNT(*) FROM ai_prediction_requests WHERE success = false) as failed_requests\n            ";
                            return [4 /*yield*/, connection_1.pool.query(statsQuery)];
                        case 1:
                            result = _a.sent();
                            stats = result.rows[0];
                            return [2 /*return*/, reply.status(200).send({
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
                                })];
                        case 2:
                            error_16 = _a.sent();
                            logger_1.logger.error('[Predictions] Get stats error:', error_16);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_16 instanceof Error ? error_16.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * PUT /api/predictions/:id/display
             * Update display_prediction text for a prediction (admin only)
             * This is what users will see in the TAHMİN column
             * SECURITY: Admin-only endpoint
             */
            // PR-10: Validate params and body
            fastify.put('/api/predictions/:id/display', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: prediction_schema_1.predictionIdParamSchema, body: prediction_schema_1.updateDisplaySchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, display_prediction, success, error_17;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            display_prediction = request.body.display_prediction;
                            if (!id) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'Prediction ID required'
                                    })];
                            }
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.updateDisplayPrediction(id, display_prediction || '')];
                        case 1:
                            success = _a.sent();
                            if (success) {
                                return [2 /*return*/, reply.status(200).send({
                                        success: true,
                                        message: 'Display prediction updated',
                                        prediction_id: id,
                                        display_prediction: display_prediction
                                    })];
                            }
                            else {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Prediction not found'
                                    })];
                            }
                            return [3 /*break*/, 3];
                        case 2:
                            error_17 = _a.sent();
                            logger_1.logger.error('[Predictions] Update display error:', error_17);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_17 instanceof Error ? error_17.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * PUT /api/predictions/bulk-display
             * Bulk update display_prediction for multiple predictions
             * SECURITY: Admin-only endpoint
             */
            // PR-10: Validate body
            fastify.put('/api/predictions/bulk-display', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ body: prediction_schema_1.bulkDisplaySchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var updates, mappedUpdates, updatedCount, error_18;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            updates = request.body.updates;
                            if (!Array.isArray(updates) || updates.length === 0) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'Updates array required'
                                    })];
                            }
                            mappedUpdates = updates.map(function (u) { return ({
                                id: u.id,
                                displayText: u.display_prediction
                            }); });
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.bulkUpdateDisplayPrediction(mappedUpdates)];
                        case 1:
                            updatedCount = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    updated_count: updatedCount,
                                    message: "Updated ".concat(updatedCount, " predictions")
                                })];
                        case 2:
                            error_18 = _a.sent();
                            logger_1.logger.error('[Predictions] Bulk display update error:', error_18);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_18 instanceof Error ? error_18.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * PUT /api/predictions/:id/access
             * Toggle access_type between VIP and FREE
             * SECURITY: Admin-only endpoint
             */
            // PR-10: Validate params and body
            fastify.put('/api/predictions/:id/access', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: prediction_schema_1.predictionIdParamSchema, body: prediction_schema_1.updateAccessSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, access_type, result, error_19;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            access_type = request.body.access_type;
                            if (!id) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'Prediction ID required'
                                    })];
                            }
                            if (!access_type || !['VIP', 'FREE'].includes(access_type)) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'Valid access_type (VIP or FREE) required'
                                    })];
                            }
                            return [4 /*yield*/, connection_1.pool.query("\n                UPDATE ai_predictions\n                SET access_type = $1, updated_at = NOW()\n                WHERE id = $2\n                RETURNING id, access_type\n            ", [access_type, id])];
                        case 1:
                            result = _a.sent();
                            if (result.rowCount === 0) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'Prediction not found'
                                    })];
                            }
                            logger_1.logger.info("[Predictions] Access type updated: ".concat(id, " -> ").concat(access_type));
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    message: 'Access type updated',
                                    prediction_id: id,
                                    access_type: access_type
                                })];
                        case 2:
                            error_19 = _a.sent();
                            logger_1.logger.error('[Predictions] Update access type error:', error_19);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_19 instanceof Error ? error_19.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/displayable
             * Get predictions with display_prediction set (for user-facing components)
             * Only returns predictions that have admin-defined display text
             */
            fastify.get('/api/predictions/displayable', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, predictions, error_20;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = parseInt(request.query.limit || '50', 10);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getDisplayablePredictions(limit)];
                        case 1:
                            predictions = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    count: predictions.length,
                                    predictions: predictions
                                })];
                        case 2:
                            error_20 = _a.sent();
                            logger_1.logger.error('[Predictions] Get displayable error:', error_20);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_20 instanceof Error ? error_20.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/predictions/manual
             * List manual predictions
             * NOTE: Public endpoint (no auth) for consistency with other prediction endpoints
             */
            fastify.get('/api/predictions/manual', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, predictions, error_21;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = parseInt(request.query.limit || '100', 10);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.getManualPredictions(limit)];
                        case 1:
                            predictions = _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    predictions: predictions
                                })];
                        case 2:
                            error_21 = _a.sent();
                            logger_1.logger.error('[Predictions] Get manual predictions error:', error_21);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_21 instanceof Error ? error_21.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // NOTE: Public endpoint (no auth) for consistency with Telegram endpoints
            // PR-10: Validate body
            fastify.post('/api/predictions/manual', { preHandler: [(0, validation_middleware_1.validate)({ body: prediction_schema_1.manualPredictionSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var result, error_22;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.createManualPrediction(request.body)];
                        case 1:
                            result = _a.sent();
                            if (result) {
                                return [2 /*return*/, reply.status(200).send({ success: true, message: 'Prediction created', prediction: result })];
                            }
                            else {
                                return [2 /*return*/, reply.status(500).send({ success: false, error: 'Failed to create prediction' })];
                            }
                            return [3 /*break*/, 3];
                        case 2:
                            error_22 = _a.sent();
                            logger_1.logger.error('[Predictions] Create manual prediction error:', error_22);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_22 instanceof Error ? error_22.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // NOTE: Public endpoint (no auth) for consistency with manual predictions endpoint
            // PR-10: Validate body
            fastify.post('/api/predictions/manual-coupon', { preHandler: [(0, validation_middleware_1.validate)({ body: prediction_schema_1.manualCouponSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var result, error_23;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, aiPrediction_service_1.aiPredictionService.createCoupon(request.body)];
                        case 1:
                            result = _a.sent();
                            if (result) {
                                return [2 /*return*/, reply.status(200).send({ success: true, message: 'Coupon created', coupon: result })];
                            }
                            else {
                                return [2 /*return*/, reply.status(500).send({ success: false, error: 'Failed to create coupon' })];
                            }
                            return [3 /*break*/, 3];
                        case 2:
                            error_23 = _a.sent();
                            logger_1.logger.error('[Predictions] Create coupon error:', error_23);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_23 instanceof Error ? error_23.message : 'Internal server error'
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/predictions/match-unmatched
             *
             * Manually trigger prediction matcher to match all unmatched predictions
             * Requires admin authentication
             */
            // PR-10: This endpoint takes no body, triggers matching all unmatched
            fastify.post('/api/predictions/match-unmatched', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var predictionMatcherService, results, successCount, error_24;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../services/ai/predictionMatcher.service')); })];
                        case 1:
                            predictionMatcherService = (_a.sent()).predictionMatcherService;
                            logger_1.logger.info('[Predictions] Manually triggering prediction matcher...');
                            return [4 /*yield*/, predictionMatcherService.matchUnmatchedPredictions()];
                        case 2:
                            results = _a.sent();
                            successCount = results.filter(function (r) { return r.matchFound; }).length;
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    message: "Matched ".concat(successCount, "/").concat(results.length, " predictions"),
                                    total: results.length,
                                    matched: successCount,
                                    results: results
                                })];
                        case 3:
                            error_24 = _a.sent();
                            logger_1.logger.error('[Predictions] Match unmatched predictions error:', error_24);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_24 instanceof Error ? error_24.message : 'Internal server error'
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/predictions/match/:externalId
             *
             * Match a specific prediction by external ID
             * Requires admin authentication
             */
            // PR-10: Validate params
            fastify.post('/api/predictions/match/:externalId', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: prediction_schema_1.externalIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var predictionMatcherService, externalId, result, error_25;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../services/ai/predictionMatcher.service')); })];
                        case 1:
                            predictionMatcherService = (_a.sent()).predictionMatcherService;
                            externalId = request.params.externalId;
                            logger_1.logger.info("[Predictions] Manually matching prediction ".concat(externalId, "..."));
                            return [4 /*yield*/, predictionMatcherService.matchByExternalId(externalId)];
                        case 2:
                            result = _a.sent();
                            if (result.matchFound) {
                                return [2 /*return*/, reply.status(200).send({
                                        success: true,
                                        message: 'Prediction matched successfully',
                                        result: result
                                    })];
                            }
                            else {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        message: 'No matching match found',
                                        result: result
                                    })];
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            error_25 = _a.sent();
                            logger_1.logger.error('[Predictions] Match prediction error:', error_25);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_25 instanceof Error ? error_25.message : 'Internal server error'
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            logger_1.logger.info('[Routes] AI Prediction routes registered');
            return [2 /*return*/];
        });
    });
}
