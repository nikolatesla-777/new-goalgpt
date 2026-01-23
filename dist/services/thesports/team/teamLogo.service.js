"use strict";
/**
 * Team Logo Service
 *
 * Handles team logo URL retrieval with 4-source strategy
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamLogoService = void 0;
const TeamRepository_1 = require("../../../repositories/implementations/TeamRepository");
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const logger_1 = require("../../../utils/logger");
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../config");
class TeamLogoService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        this.repository = new TeamRepository_1.TeamRepository();
    }
    /**
     * Get team logo URL (4-source strategy)
     * 1. Database
     * 2. results_extra (from cache)
     * 3. TheSports API team/detail
     * 4. Fallback URL pattern
     */
    async getTeamLogoUrl(teamId) {
        // 1. Check database
        const team = await this.repository.findByExternalId(teamId);
        if (team?.logo_url) {
            return team.logo_url;
        }
        // 2. Check results_extra from cache
        const resultsExtra = await this.getResultsExtraFromCache();
        if (resultsExtra?.team?.[teamId]?.logo_url) {
            const logoUrl = resultsExtra.team[teamId].logo_url;
            if (team?.id) {
                await this.repository.update(team.id, { logo_url: logoUrl });
            }
            else {
                await this.repository.createOrUpdate({
                    external_id: teamId,
                    logo_url: logoUrl,
                });
            }
            return logoUrl;
        }
        // 3. Try TheSports API team/detail endpoint
        try {
            const teamDetail = await this.fetchTeamDetail(teamId);
            if (teamDetail?.logo_url) {
                await this.repository.update(team?.id || teamId, { logo_url: teamDetail.logo_url });
                return teamDetail.logo_url;
            }
        }
        catch (error) {
            logger_1.logger.debug(`Team detail endpoint not available for ${teamId}`);
        }
        // 4. Fallback URL pattern
        const fallbackLogoUrl = this.buildFallbackLogoUrl(teamId);
        const isValid = await this.validateLogoUrl(fallbackLogoUrl);
        if (isValid) {
            if (team) {
                await this.repository.update(team.id, { logo_url: fallbackLogoUrl });
            }
            else {
                await this.repository.createOrUpdate({
                    external_id: teamId,
                    logo_url: fallbackLogoUrl,
                });
            }
            return fallbackLogoUrl;
        }
        return null;
    }
    /**
     * Get results_extra from cache
     */
    async getResultsExtraFromCache() {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:diary:extra:${today}`;
        return cache_service_1.cacheService.get(cacheKey);
    }
    /**
     * Fetch team detail from API
     */
    async fetchTeamDetail(teamId) {
        try {
            // TODO: Implement when team/detail endpoint is available
            // const response = await this.client.get('/team/detail', { team_id: teamId });
            // return { logo_url: response.logo_url };
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Build fallback logo URL pattern
     */
    buildFallbackLogoUrl(teamId) {
        const baseUrl = config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
        const logoBaseUrl = baseUrl.replace('/v1/football', '');
        return `${logoBaseUrl}/logo/team/${teamId}.png`;
    }
    /**
     * Validate logo URL (HEAD request)
     */
    async validateLogoUrl(url) {
        try {
            const response = await axios_1.default.head(url, { timeout: 5000 });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
}
exports.TeamLogoService = TeamLogoService;
