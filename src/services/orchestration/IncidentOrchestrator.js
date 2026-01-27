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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.getIncidentOrchestrator = exports.IncidentOrchestrator = void 0;
var events_1 = require("events");
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var RedisManager_1 = require("../../core/RedisManager");
// Event type constants (from TheSports API)
var EVENT_TYPES = {
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
var IncidentOrchestrator = /** @class */ (function (_super) {
    __extends(IncidentOrchestrator, _super);
    function IncidentOrchestrator() {
        var _this = _super.call(this) || this;
        // Stats tracking
        _this.stats = {
            totalProcessed: 0,
            totalAdded: 0,
            totalSkipped: 0,
            totalErrors: 0,
            lastProcessTime: null,
        };
        logger_1.logger.info('[IncidentOrchestrator] Initialized');
        return _this;
    }
    /**
     * Get singleton instance
     */
    IncidentOrchestrator.getInstance = function () {
        if (!this.instance) {
            this.instance = new IncidentOrchestrator();
        }
        return this.instance;
    };
    /**
     * Generate unique incident key for deduplication
     * Format: match_id:type:time:position
     */
    IncidentOrchestrator.prototype.generateIncidentKey = function (matchId, incident) {
        return "".concat(matchId, ":").concat(incident.type, ":").concat(incident.time, ":").concat(incident.position || 0);
    };
    /**
     * Check if incident already exists in Redis cache
     */
    IncidentOrchestrator.prototype.isProcessed = function (incidentKey) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, RedisManager_1.RedisManager.get("incident:".concat(incidentKey))];
                    case 1:
                        cached = _b.sent();
                        return [2 /*return*/, cached !== null];
                    case 2:
                        _a = _b.sent();
                        // Redis error - fall through to DB check
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Mark incident as processed in Redis (TTL 24h)
     */
    IncidentOrchestrator.prototype.markProcessed = function (incidentKey) {
        return __awaiter(this, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, RedisManager_1.RedisManager.set("incident:".concat(incidentKey), '1', 86400)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        // Redis error - not critical, DB constraint will handle
                        logger_1.logger.debug("[IncidentOrchestrator] Redis cache set failed: ".concat(err_1));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Main entry point - process incidents from any source
     *
     * @param matchId - External match ID
     * @param incidents - Array of incidents from API/WebSocket
     * @param source - Source identifier for logging ('api', 'websocket', 'polling')
     * @returns Processing result with counts
     */
    IncidentOrchestrator.prototype.processIncidents = function (matchId, incidents, source) {
        return __awaiter(this, void 0, void 0, function () {
            var result, client, _i, incidents_1, incident, incidentKey, err_2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!incidents || incidents.length === 0) {
                            return [2 /*return*/, { added: 0, skipped: 0, errors: 0 }];
                        }
                        logger_1.logger.info("[IncidentOrchestrator] Processing ".concat(incidents.length, " incidents for ").concat(matchId, " from ").concat(source));
                        result = { added: 0, skipped: 0, errors: 0 };
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _c.sent();
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, , 14, 15]);
                        _i = 0, incidents_1 = incidents;
                        _c.label = 3;
                    case 3:
                        if (!(_i < incidents_1.length)) return [3 /*break*/, 13];
                        incident = incidents_1[_i];
                        incidentKey = this.generateIncidentKey(matchId, incident);
                        return [4 /*yield*/, this.isProcessed(incidentKey)];
                    case 4:
                        // 1. Check Redis cache first (fast path)
                        if (_c.sent()) {
                            result.skipped++;
                            return [3 /*break*/, 12];
                        }
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 8, , 12]);
                        return [4 /*yield*/, client.query("\n            INSERT INTO ts_incidents (\n              match_id, type, time, position,\n              player_name, player_id, assist1_name,\n              in_player_name, out_player_name,\n              home_score, away_score,\n              var_reason, reason_type, add_time,\n              incident_key, source\n            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)\n            ON CONFLICT (incident_key) DO NOTHING\n          ", [
                                matchId,
                                incident.type,
                                incident.time,
                                incident.position || 0,
                                incident.player_name || null,
                                incident.player_id || null,
                                incident.assist1_name || null,
                                incident.in_player_name || null,
                                incident.out_player_name || null,
                                (_a = incident.home_score) !== null && _a !== void 0 ? _a : null,
                                (_b = incident.away_score) !== null && _b !== void 0 ? _b : null,
                                incident.var_reason || null,
                                incident.reason_type || null,
                                incident.add_time || null,
                                incidentKey,
                                source,
                            ])];
                    case 6:
                        _c.sent();
                        // 3. Mark as processed in Redis
                        return [4 /*yield*/, this.markProcessed(incidentKey)];
                    case 7:
                        // 3. Mark as processed in Redis
                        _c.sent();
                        result.added++;
                        // 4. Emit appropriate events
                        this.emitIncidentEvents(matchId, incident);
                        return [3 /*break*/, 12];
                    case 8:
                        err_2 = _c.sent();
                        if (!(err_2.code === '23505')) return [3 /*break*/, 10];
                        // Unique constraint violation - already exists
                        result.skipped++;
                        return [4 /*yield*/, this.markProcessed(incidentKey)];
                    case 9:
                        _c.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        logger_1.logger.error("[IncidentOrchestrator] DB error for incident:", err_2);
                        result.errors++;
                        _c.label = 11;
                    case 11: return [3 /*break*/, 12];
                    case 12:
                        _i++;
                        return [3 /*break*/, 3];
                    case 13:
                        // Update stats
                        this.stats.totalProcessed += incidents.length;
                        this.stats.totalAdded += result.added;
                        this.stats.totalSkipped += result.skipped;
                        this.stats.totalErrors += result.errors;
                        this.stats.lastProcessTime = new Date();
                        if (result.added > 0) {
                            logger_1.logger.info("[IncidentOrchestrator] \u2705 Added ".concat(result.added, " incidents for ").concat(matchId));
                        }
                        return [2 /*return*/, result];
                    case 14:
                        client.release();
                        return [7 /*endfinally*/];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Emit events for different incident types
     */
    IncidentOrchestrator.prototype.emitIncidentEvents = function (matchId, incident) {
        var _a, _b;
        // General incident event
        this.emit('incident:added', { matchId: matchId, incident: incident });
        // Specific events by type
        switch (incident.type) {
            case EVENT_TYPES.GOAL:
            case EVENT_TYPES.PENALTY:
            case EVENT_TYPES.OWN_GOAL:
                this.emit('incident:goal', {
                    matchId: matchId,
                    incident: incident,
                    homeScore: (_a = incident.home_score) !== null && _a !== void 0 ? _a : 0,
                    awayScore: (_b = incident.away_score) !== null && _b !== void 0 ? _b : 0,
                });
                break;
            case EVENT_TYPES.YELLOW_CARD:
                this.emit('incident:card', { matchId: matchId, incident: incident, cardType: 'yellow' });
                break;
            case EVENT_TYPES.RED_CARD:
            case EVENT_TYPES.CARD_UPGRADE:
                this.emit('incident:card', { matchId: matchId, incident: incident, cardType: 'red' });
                break;
            case EVENT_TYPES.SUBSTITUTION:
                this.emit('incident:substitution', { matchId: matchId, incident: incident });
                break;
        }
    };
    /**
     * Get incidents for a match from database
     */
    IncidentOrchestrator.prototype.getMatchIncidents = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 4, 5]);
                        return [4 /*yield*/, client.query("\n        SELECT type, time, position, player_name, player_id,\n               assist1_name, in_player_name, out_player_name,\n               home_score, away_score, var_reason, reason_type, add_time\n        FROM ts_incidents\n        WHERE match_id = $1\n        ORDER BY time DESC\n      ", [matchId])];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                    case 4:
                        client.release();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get orchestrator statistics
     */
    IncidentOrchestrator.prototype.getStats = function () {
        return __assign({}, this.stats);
    };
    /**
     * Health check
     */
    IncidentOrchestrator.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var redis, db, _a, client, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        redis = false;
                        db = false;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, RedisManager_1.RedisManager.healthCheck()];
                    case 2:
                        redis = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _c.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        _c.trys.push([4, 7, , 8]);
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 5:
                        client = _c.sent();
                        return [4 /*yield*/, client.query('SELECT 1')];
                    case 6:
                        _c.sent();
                        client.release();
                        db = true;
                        return [3 /*break*/, 8];
                    case 7:
                        _b = _c.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, {
                            healthy: redis && db,
                            redis: redis,
                            db: db,
                        }];
                }
            });
        });
    };
    IncidentOrchestrator.instance = null;
    return IncidentOrchestrator;
}(events_1.EventEmitter));
exports.IncidentOrchestrator = IncidentOrchestrator;
// Export singleton getter
var getIncidentOrchestrator = function () { return IncidentOrchestrator.getInstance(); };
exports.getIncidentOrchestrator = getIncidentOrchestrator;
