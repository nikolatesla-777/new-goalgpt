"use strict";
/**
 * Central Route Registration - PR-2: Auth Grouping
 *
 * Route groups with hook-level authentication.
 * Auth is applied ONLY at ROUTE GROUP level via addHook('preHandler', ...), NOT per-route.
 *
 * Route Groups:
 * - publicAPI - read-only endpoints, no authentication required
 * - authAPI - user endpoints requiring JWT authentication
 * - adminAPI - admin endpoints requiring JWT + admin role
 * - internalAPI - internal monitoring endpoints (localhost OR X-Internal-Secret header)
 * - wsAPI - WebSocket routes (first-message auth within 10s, handled in websocket.routes.ts)
 * - mixedAuthAPI - routes with mixed public/protected endpoints (auth handled internally per-route)
 *
 * IMPORTANT: All existing /api/* paths are preserved for backward compatibility (NO breaking changes).
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
// Middleware
var auth_middleware_1 = require("../middleware/auth.middleware");
var internal_middleware_1 = require("../middleware/internal.middleware");
// Core Match & Team Data
var match_routes_1 = __importDefault(require("./match.routes"));
var season_routes_1 = __importDefault(require("./season.routes"));
var team_routes_1 = __importDefault(require("./team.routes"));
var player_routes_1 = __importDefault(require("./player.routes"));
var league_routes_1 = __importDefault(require("./league.routes"));
// Health & Monitoring
var health_routes_1 = require("./health.routes");
var metrics_routes_1 = __importDefault(require("./metrics.routes"));
// WebSocket
var websocket_routes_1 = __importDefault(require("./websocket.routes"));
// AI Predictions (mixed patterns - TODO: unify in PR-2+)
var prediction_routes_1 = require("./prediction.routes");
var predictionUnlock_routes_1 = require("./predictionUnlock.routes");
// Dashboard
var dashboard_routes_1 = require("./dashboard.routes");
// Authentication & Authorization
var auth_routes_1 = require("./auth.routes");
// Gamification Systems (Phase 2-3)
var xp_routes_1 = require("./xp.routes");
var credits_routes_1 = require("./credits.routes");
var badges_routes_1 = require("./badges.routes");
var referrals_routes_1 = require("./referrals.routes");
var dailyRewards_routes_1 = require("./dailyRewards.routes");
// Social & Community Features
var comments_routes_1 = require("./comments.routes");
var forum_routes_1 = __importDefault(require("./forum.routes"));
// Admin & Moderation
var announcements_routes_1 = require("./announcements.routes");
// External Integrations
var footystats_routes_1 = require("./footystats.routes");
var partners_routes_1 = require("./partners.routes");
var telegram_routes_1 = require("./telegram.routes");
// ============================================================================
// CENTRAL REGISTRATION FUNCTION
// ============================================================================
/**
 * Register all application routes with hook-level authentication
 *
 * Called ONCE from server.ts bootstrap.
 * All route registration logic lives here.
 *
 * @param app - Fastify instance
 */
function registerRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // ============================================================================
                // PUBLIC API GROUP
                // Read-only endpoints, no authentication required
                // Prefix: /api/*
                // ============================================================================
                return [4 /*yield*/, app.register(function (publicAPI) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            // No auth hook - these are public endpoints
                            // Health checks (must be public for load balancer)
                            publicAPI.register(health_routes_1.healthRoutes, { prefix: '/api' });
                            // Core read-only data
                            publicAPI.register(match_routes_1.default, { prefix: '/api/matches' });
                            publicAPI.register(season_routes_1.default, { prefix: '/api/seasons' });
                            publicAPI.register(team_routes_1.default, { prefix: '/api/teams' });
                            publicAPI.register(player_routes_1.default, { prefix: '/api/players' });
                            publicAPI.register(league_routes_1.default, { prefix: '/api/leagues' });
                            // Prediction viewing (read-only)
                            publicAPI.register(prediction_routes_1.predictionRoutes);
                            return [2 /*return*/];
                        });
                    }); })];
                case 1:
                    // ============================================================================
                    // PUBLIC API GROUP
                    // Read-only endpoints, no authentication required
                    // Prefix: /api/*
                    // ============================================================================
                    _a.sent();
                    // ============================================================================
                    // AUTHENTICATED API GROUP
                    // User endpoints requiring valid JWT token
                    // Prefix: /api/*
                    // ============================================================================
                    return [4 /*yield*/, app.register(function (authAPI) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // Apply auth hook to ALL routes in this group
                                authAPI.addHook('preHandler', auth_middleware_1.requireAuth);
                                // Gamification systems
                                authAPI.register(xp_routes_1.xpRoutes, { prefix: '/api/xp' });
                                authAPI.register(credits_routes_1.creditsRoutes, { prefix: '/api/credits' });
                                authAPI.register(badges_routes_1.badgesRoutes, { prefix: '/api/badges' });
                                authAPI.register(referrals_routes_1.referralsRoutes, { prefix: '/api/referrals' });
                                authAPI.register(dailyRewards_routes_1.dailyRewardsRoutes, { prefix: '/api/daily-rewards' });
                                // Social features
                                authAPI.register(comments_routes_1.commentsRoutes, { prefix: '/api/comments' });
                                authAPI.register(forum_routes_1.default, { prefix: '/api/forum' });
                                // Prediction unlock (credit-based)
                                authAPI.register(predictionUnlock_routes_1.predictionUnlockRoutes, { prefix: '/api/predictions' });
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    // ============================================================================
                    // AUTHENTICATED API GROUP
                    // User endpoints requiring valid JWT token
                    // Prefix: /api/*
                    // ============================================================================
                    _a.sent();
                    // ============================================================================
                    // ADMIN API GROUP
                    // Admin endpoints requiring valid JWT token + admin role
                    // Prefix: /api/*
                    // ============================================================================
                    return [4 /*yield*/, app.register(function (adminAPI) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // Apply auth hooks to ALL routes in this group
                                adminAPI.addHook('preHandler', auth_middleware_1.requireAuth);
                                adminAPI.addHook('preHandler', auth_middleware_1.requireAdmin);
                                // Admin dashboard
                                adminAPI.register(dashboard_routes_1.dashboardRoutes);
                                // Admin moderation
                                adminAPI.register(announcements_routes_1.announcementsRoutes, { prefix: '/api/announcements' });
                                // Partner management
                                adminAPI.register(partners_routes_1.partnersRoutes, { prefix: '/api/partners' });
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    // ============================================================================
                    // ADMIN API GROUP
                    // Admin endpoints requiring valid JWT token + admin role
                    // Prefix: /api/*
                    // ============================================================================
                    _a.sent();
                    // ============================================================================
                    // INTERNAL API GROUP
                    // Internal monitoring endpoints
                    // Requires X-Internal-Secret header OR localhost
                    // Prefix: /api/metrics
                    // ============================================================================
                    return [4 /*yield*/, app.register(function (internalAPI) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // Apply internal auth hook to ALL routes in this group
                                internalAPI.addHook('preHandler', internal_middleware_1.requireInternal);
                                // Monitoring endpoints
                                internalAPI.register(metrics_routes_1.default, { prefix: '/api/metrics' });
                                return [2 /*return*/];
                            });
                        }); })];
                case 4:
                    // ============================================================================
                    // INTERNAL API GROUP
                    // Internal monitoring endpoints
                    // Requires X-Internal-Secret header OR localhost
                    // Prefix: /api/metrics
                    // ============================================================================
                    _a.sent();
                    // ============================================================================
                    // WEBSOCKET ROUTES
                    // WebSocket connections with first-message authentication
                    // Prefix: /ws
                    // ============================================================================
                    // WebSocket auth is handled inside websocket.routes.ts
                    // First message must contain valid JWT within 10 seconds
                    app.register(websocket_routes_1.default);
                    // ============================================================================
                    // MIXED AUTH API GROUP
                    // Routes with mixed public/protected endpoints
                    // Auth handled internally per-route (cannot use group hooks)
                    // Prefix: /api/*
                    // ============================================================================
                    // Auth routes: /login, /register are public; /me, /refresh require auth
                    app.register(auth_routes_1.authRoutes, { prefix: '/api/auth' });
                    // FootyStats integration (may have mixed endpoints)
                    app.register(footystats_routes_1.footyStatsRoutes, { prefix: '/api' });
                    // Telegram publishing (TEMPORARY: PUBLIC for development, will add auth later)
                    app.register(telegram_routes_1.telegramRoutes, { prefix: '/api' });
                    return [2 /*return*/];
            }
        });
    });
}
