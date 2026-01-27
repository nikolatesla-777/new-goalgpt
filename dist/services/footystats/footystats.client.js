"use strict";
/**
 * FootyStatsAPIClient - Singleton Pattern
 *
 * FootyStats API client for advanced betting statistics:
 * - xG (Expected Goals)
 * - BTTS Potential
 * - Over/Under Percentages
 * - Referee Stats
 * - Form Strings
 *
 * @author GoalGPT Team
 * @version 1.0.0
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
exports.FootyStatsAPIClient = exports.footyStatsAPI = void 0;
var axios_1 = require("axios");
var logger_1 = require("../../utils/logger");
var FOOTYSTATS_RATE_CONFIG = {
    requestsPerMinute: 30, // FootyStats allows more requests
    maxBurst: 10,
};
var FootyStatsRateLimiter = /** @class */ (function () {
    function FootyStatsRateLimiter(config) {
        if (config === void 0) { config = FOOTYSTATS_RATE_CONFIG; }
        this.config = config;
        this.tokens = config.maxBurst;
        this.lastRefill = Date.now();
    }
    FootyStatsRateLimiter.prototype.acquire = function () {
        return __awaiter(this, arguments, void 0, function (context) {
            var waitTime;
            if (context === void 0) { context = 'default'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.refillTokens();
                        if (this.tokens >= 1) {
                            this.tokens -= 1;
                            return [2 /*return*/];
                        }
                        waitTime = this.calculateWaitTime();
                        logger_1.logger.debug("[FootyStats RateLimit] Waiting ".concat(waitTime, "ms for ").concat(context));
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime); })];
                    case 1:
                        _a.sent();
                        this.refillTokens();
                        this.tokens -= 1;
                        return [2 /*return*/];
                }
            });
        });
    };
    FootyStatsRateLimiter.prototype.refillTokens = function () {
        var now = Date.now();
        var timeElapsed = (now - this.lastRefill) / 1000;
        var tokensPerSecond = this.config.requestsPerMinute / 60;
        var tokensToAdd = timeElapsed * tokensPerSecond;
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxBurst);
        this.lastRefill = now;
    };
    FootyStatsRateLimiter.prototype.calculateWaitTime = function () {
        var tokensPerSecond = this.config.requestsPerMinute / 60;
        var tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / tokensPerSecond) * 1000);
    };
    return FootyStatsRateLimiter;
}());
// ============================================================================
// SINGLETON CLIENT
// ============================================================================
var FootyStatsAPIClient = /** @class */ (function () {
    function FootyStatsAPIClient() {
        this.isInitialized = false;
        // Metrics
        this.requestCount = 0;
        this.errorCount = 0;
        this.apiKey = process.env.FOOTYSTATS_API_KEY || '';
        this.axiosInstance = axios_1.default.create({
            baseURL: 'https://api.football-data-api.com',
            timeout: 30000,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'GoalGPT/1.0-FootyStats',
            },
        });
        this.rateLimiter = new FootyStatsRateLimiter();
        this.setupInterceptors();
        this.isInitialized = true;
        logger_1.logger.info('[FootyStatsAPI] Client initialized');
    }
    FootyStatsAPIClient.getInstance = function () {
        if (!FootyStatsAPIClient.instance) {
            FootyStatsAPIClient.instance = new FootyStatsAPIClient();
        }
        return FootyStatsAPIClient.instance;
    };
    FootyStatsAPIClient.prototype.setupInterceptors = function () {
        var _this = this;
        this.axiosInstance.interceptors.request.use(function (cfg) {
            var _a;
            cfg.metadata = { startTime: Date.now() };
            logger_1.logger.debug("[FootyStatsAPI] \u2192 ".concat((_a = cfg.method) === null || _a === void 0 ? void 0 : _a.toUpperCase(), " ").concat(cfg.url));
            return cfg;
        }, function (error) {
            logger_1.logger.error('[FootyStatsAPI] Request error:', error.message);
            return Promise.reject(error);
        });
        this.axiosInstance.interceptors.response.use(function (response) {
            var _a;
            var startTime = (_a = response.config.metadata) === null || _a === void 0 ? void 0 : _a.startTime;
            var duration = startTime ? Date.now() - startTime : 0;
            logger_1.logger.debug("[FootyStatsAPI] \u2190 ".concat(response.status, " (").concat(duration, "ms)"));
            return response;
        }, function (error) {
            _this.errorCount++;
            logger_1.logger.error('[FootyStatsAPI] Response error:', error.message);
            return Promise.reject(error);
        });
    };
    /**
     * Set API key (for runtime configuration)
     */
    FootyStatsAPIClient.prototype.setApiKey = function (key) {
        this.apiKey = key;
        logger_1.logger.info('[FootyStatsAPI] API key updated');
    };
    /**
     * Check if API key is configured
     */
    FootyStatsAPIClient.prototype.isConfigured = function () {
        return this.apiKey.length > 0;
    };
    /**
     * Generic GET request
     */
    FootyStatsAPIClient.prototype.get = function (endpoint_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, params) {
            var queryParams, url, response;
            if (params === void 0) { params = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.rateLimiter.acquire(endpoint)];
                    case 1:
                        _a.sent();
                        this.requestCount++;
                        queryParams = new URLSearchParams(__assign({ key: this.apiKey }, params));
                        url = "".concat(endpoint, "?").concat(queryParams.toString());
                        return [4 /*yield*/, this.axiosInstance.get(url)];
                    case 2:
                        response = _a.sent();
                        if (response.status >= 400) {
                            throw new Error("FootyStats API Error: ".concat(response.status));
                        }
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    // ============================================================================
    // API ENDPOINTS
    // ============================================================================
    /**
     * Get list of all available leagues
     */
    FootyStatsAPIClient.prototype.getLeagueList = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/league-list')];
            });
        });
    };
    /**
     * Get today's matches
     */
    FootyStatsAPIClient.prototype.getTodaysMatches = function (date, timezone) {
        return __awaiter(this, void 0, void 0, function () {
            var params;
            return __generator(this, function (_a) {
                params = {};
                if (date)
                    params.date = date;
                if (timezone)
                    params.timezone = timezone;
                return [2 /*return*/, this.get('/todays-matches', params)];
            });
        });
    };
    /**
     * Get match details with stats, H2H, odds, trends
     */
    FootyStatsAPIClient.prototype.getMatchDetails = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/match', { match_id: matchId.toString() })];
            });
        });
    };
    /**
     * Get league teams
     */
    FootyStatsAPIClient.prototype.getLeagueTeams = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/league-teams', { season_id: seasonId.toString() })];
            });
        });
    };
    /**
     * Get league season stats
     */
    FootyStatsAPIClient.prototype.getLeagueSeason = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/league-season', { season_id: seasonId.toString() })];
            });
        });
    };
    /**
     * Get league standings/tables for a season
     */
    FootyStatsAPIClient.prototype.getLeagueTables = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/league-tables', { season_id: seasonId.toString() })];
            });
        });
    };
    /**
     * Get all players in a league season (max 200 per page)
     */
    FootyStatsAPIClient.prototype.getLeaguePlayers = function (seasonId_1) {
        return __awaiter(this, arguments, void 0, function (seasonId, page) {
            if (page === void 0) { page = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/league-players', {
                        season_id: seasonId.toString(),
                        page: page.toString()
                    })];
            });
        });
    };
    /**
     * Get detailed stats for a specific player
     */
    FootyStatsAPIClient.prototype.getPlayerStats = function (playerId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/player-stats', { player_id: playerId.toString() })];
            });
        });
    };
    /**
     * Get team last X matches form
     */
    FootyStatsAPIClient.prototype.getTeamLastX = function (teamId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/lastx', { team_id: teamId.toString() })];
            });
        });
    };
    /**
     * Get referee stats
     */
    FootyStatsAPIClient.prototype.getRefereeStats = function (refereeId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/referee', { referee_id: refereeId.toString() })];
            });
        });
    };
    /**
     * Get BTTS top stats (teams, fixtures, leagues)
     */
    FootyStatsAPIClient.prototype.getBTTSStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/stats-data-btts')];
            });
        });
    };
    /**
     * Get Over 2.5 top stats
     */
    FootyStatsAPIClient.prototype.getOver25Stats = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get('/stats-data-over25')];
            });
        });
    };
    // ============================================================================
    // HEALTH & METRICS
    // ============================================================================
    FootyStatsAPIClient.prototype.getHealth = function () {
        return {
            initialized: this.isInitialized,
            configured: this.isConfigured(),
            metrics: {
                requests: this.requestCount,
                errors: this.errorCount,
            },
        };
    };
    FootyStatsAPIClient.instance = null;
    return FootyStatsAPIClient;
}());
exports.FootyStatsAPIClient = FootyStatsAPIClient;
// ============================================================================
// EXPORTS
// ============================================================================
exports.footyStatsAPI = FootyStatsAPIClient.getInstance();
