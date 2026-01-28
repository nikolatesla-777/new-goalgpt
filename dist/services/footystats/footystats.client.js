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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FootyStatsAPIClient = exports.footyStatsAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables before accessing process.env
dotenv_1.default.config();
const logger_1 = require("../../utils/logger");
const FOOTYSTATS_RATE_CONFIG = {
    requestsPerMinute: 30, // FootyStats allows more requests
    maxBurst: 10,
};
class FootyStatsRateLimiter {
    constructor(config = FOOTYSTATS_RATE_CONFIG) {
        this.config = config;
        this.tokens = config.maxBurst;
        this.lastRefill = Date.now();
    }
    async acquire(context = 'default') {
        this.refillTokens();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        const waitTime = this.calculateWaitTime();
        logger_1.logger.debug(`[FootyStats RateLimit] Waiting ${waitTime}ms for ${context}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.refillTokens();
        this.tokens -= 1;
    }
    refillTokens() {
        const now = Date.now();
        const timeElapsed = (now - this.lastRefill) / 1000;
        const tokensPerSecond = this.config.requestsPerMinute / 60;
        const tokensToAdd = timeElapsed * tokensPerSecond;
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxBurst);
        this.lastRefill = now;
    }
    calculateWaitTime() {
        const tokensPerSecond = this.config.requestsPerMinute / 60;
        const tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / tokensPerSecond) * 1000);
    }
}
// ============================================================================
// SINGLETON CLIENT
// ============================================================================
class FootyStatsAPIClient {
    constructor() {
        // IMPORTANT: Don't set apiKey here - it will be loaded lazily in getApiKey()
        // Leave it undefined so getApiKey() will load it on first use
        this.isInitialized = false;
        // Metrics
        this.requestCount = 0;
        this.errorCount = 0;
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
        logger_1.logger.info('[FootyStatsAPI] Client initialized (API key will be loaded on first use)');
    }
    /**
     * Lazy load API key from environment
     */
    getApiKey() {
        process.stderr.write('[getApiKey] CALLED\n');
        if (!this.apiKey) {
            process.stderr.write('[getApiKey] this.apiKey is undefined, loading from .env\n');
            // Ensure .env is loaded before reading process.env
            // Use explicit path to handle different working directories
            const path = require('path');
            const envPath = path.resolve(process.cwd(), '.env');
            const result = dotenv_1.default.config({ path: envPath });
            process.stderr.write(`[getApiKey] CWD: ${process.cwd()}\n`);
            process.stderr.write(`[getApiKey] .env path: ${envPath}\n`);
            process.stderr.write(`[getApiKey] dotenv result: ${result.error ? `ERROR: ${result.error.message}` : 'SUCCESS'}\n`);
            this.apiKey = process.env.FOOTYSTATS_API_KEY || '';
            process.stderr.write(`[getApiKey] API key length: ${this.apiKey.length}\n`);
            process.stderr.write(`[getApiKey] API key preview: ${this.apiKey ? this.apiKey.substring(0, 15) + '...' : 'EMPTY'}\n`);
            if (!this.apiKey) {
                logger_1.logger.error('[FootyStatsAPI] ⚠️ API KEY IS EMPTY! Check .env file');
            }
            else {
                logger_1.logger.info(`[FootyStatsAPI] ✅ API key loaded (${this.apiKey.substring(0, 10)}...)`);
            }
        }
        else {
            process.stderr.write(`[getApiKey] Using cached API key (length: ${this.apiKey.length})\n`);
        }
        process.stderr.write(`[getApiKey] RETURNING: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'EMPTY'}\n`);
        return this.apiKey || '';
    }
    static getInstance() {
        if (!FootyStatsAPIClient.instance) {
            // CRITICAL: Load .env before creating instance
            dotenv_1.default.config();
            FootyStatsAPIClient.instance = new FootyStatsAPIClient();
        }
        return FootyStatsAPIClient.instance;
    }
    setupInterceptors() {
        this.axiosInstance.interceptors.request.use((cfg) => {
            cfg.metadata = { startTime: Date.now() };
            logger_1.logger.debug(`[FootyStatsAPI] → ${cfg.method?.toUpperCase()} ${cfg.url}`);
            return cfg;
        }, (error) => {
            logger_1.logger.error('[FootyStatsAPI] Request error:', error.message);
            return Promise.reject(error);
        });
        this.axiosInstance.interceptors.response.use((response) => {
            const startTime = response.config.metadata?.startTime;
            const duration = startTime ? Date.now() - startTime : 0;
            logger_1.logger.debug(`[FootyStatsAPI] ← ${response.status} (${duration}ms)`);
            return response;
        }, (error) => {
            this.errorCount++;
            logger_1.logger.error('[FootyStatsAPI] Response error:', error.message);
            return Promise.reject(error);
        });
    }
    /**
     * Set API key (for runtime configuration)
     */
    setApiKey(key) {
        this.apiKey = key;
        logger_1.logger.info('[FootyStatsAPI] API key updated');
    }
    /**
     * Check if API key is configured
     */
    isConfigured() {
        return this.getApiKey().length > 0;
    }
    /**
     * Generic GET request
     */
    async get(endpoint, params = {}) {
        await this.rateLimiter.acquire(endpoint);
        this.requestCount++;
        const queryParams = new URLSearchParams({
            key: this.getApiKey(), // Lazy load API key on first request
            ...params,
        });
        const url = `${endpoint}?${queryParams.toString()}`;
        const response = await this.axiosInstance.get(url);
        if (response.status >= 400) {
            throw new Error(`FootyStats API Error: ${response.status}`);
        }
        return response.data;
    }
    // ============================================================================
    // API ENDPOINTS
    // ============================================================================
    /**
     * Get list of all available leagues
     */
    async getLeagueList() {
        return this.get('/league-list');
    }
    /**
     * Get today's matches
     */
    async getTodaysMatches(date, timezone) {
        const params = {};
        if (date)
            params.date = date;
        if (timezone)
            params.timezone = timezone;
        return this.get('/todays-matches', params);
    }
    /**
     * Get match details with stats, H2H, odds, trends
     */
    async getMatchDetails(matchId) {
        return this.get('/match', { match_id: matchId.toString() });
    }
    /**
     * Get league teams
     */
    async getLeagueTeams(seasonId) {
        return this.get('/league-teams', { season_id: seasonId.toString() });
    }
    /**
     * Get league season stats
     */
    async getLeagueSeason(seasonId) {
        return this.get('/league-season', { season_id: seasonId.toString() });
    }
    /**
     * Get league standings/tables for a season
     */
    async getLeagueTables(seasonId) {
        return this.get('/league-tables', { season_id: seasonId.toString() });
    }
    /**
     * Get all players in a league season (max 200 per page)
     */
    async getLeaguePlayers(seasonId, page = 1) {
        return this.get('/league-players', {
            season_id: seasonId.toString(),
            page: page.toString()
        });
    }
    /**
     * Get detailed stats for a specific player
     */
    async getPlayerStats(playerId) {
        return this.get('/player-stats', { player_id: playerId.toString() });
    }
    /**
     * Get team last X matches form
     */
    async getTeamLastX(teamId) {
        return this.get('/lastx', { team_id: teamId.toString() });
    }
    /**
     * Get referee stats
     */
    async getRefereeStats(refereeId) {
        return this.get('/referee', { referee_id: refereeId.toString() });
    }
    /**
     * Get BTTS top stats (teams, fixtures, leagues)
     */
    async getBTTSStats() {
        return this.get('/stats-data-btts');
    }
    /**
     * Get Over 2.5 top stats
     */
    async getOver25Stats() {
        return this.get('/stats-data-over25');
    }
    // ============================================================================
    // HEALTH & METRICS
    // ============================================================================
    getHealth() {
        return {
            initialized: this.isInitialized,
            configured: this.isConfigured(),
            metrics: {
                requests: this.requestCount,
                errors: this.errorCount,
            },
        };
    }
}
exports.FootyStatsAPIClient = FootyStatsAPIClient;
FootyStatsAPIClient.instance = null;
// ============================================================================
// EXPORTS
// ============================================================================
exports.footyStatsAPI = FootyStatsAPIClient.getInstance();
