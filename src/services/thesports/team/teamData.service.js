"use strict";
/**
 * Team Data Service
 *
 * Handles team data retrieval with cache-first strategy
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
exports.TeamDataService = void 0;
var TeamRepository_1 = require("../../../repositories/implementations/TeamRepository");
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var logger_1 = require("../../../utils/logger");
var TeamDataService = /** @class */ (function () {
    function TeamDataService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        this.repository = new TeamRepository_1.TeamRepository();
    }
    /**
     * Get team by ID (cache-first strategy)
     * 1. Cache
     * 2. Database
     * 3. API
     */
    TeamDataService.prototype.getTeamById = function (teamId) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, dbTeam, teamData, apiTeam, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":team:").concat(teamId);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _a.sent();
                        if (cached) {
                            logger_1.logger.debug("Cache hit for team: ".concat(teamId));
                            return [2 /*return*/, cached];
                        }
                        return [4 /*yield*/, this.repository.findByExternalId(teamId)];
                    case 2:
                        dbTeam = _a.sent();
                        if (!dbTeam) return [3 /*break*/, 4];
                        teamData = this.mapToTeamData(dbTeam);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, teamData, types_1.CacheTTL.Day)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, teamData];
                    case 4:
                        _a.trys.push([4, 9, , 10]);
                        return [4 /*yield*/, this.fetchTeamFromAPI(teamId)];
                    case 5:
                        apiTeam = _a.sent();
                        if (!apiTeam) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.repository.createOrUpdate(__assign({ external_id: teamId }, apiTeam))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, apiTeam, types_1.CacheTTL.Day)];
                    case 7:
                        _a.sent();
                        return [2 /*return*/, apiTeam];
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_1 = _a.sent();
                        logger_1.logger.warn("Failed to fetch team ".concat(teamId, " from API:"), error_1.message);
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Get multiple teams by IDs (batch processing)
     */
    TeamDataService.prototype.getTeamsByIds = function (teamIds) {
        return __awaiter(this, void 0, void 0, function () {
            var results, missingIds, _i, teamIds_1, teamId, cacheKey, cached, dbTeams, _a, dbTeams_1, team, teamData, cacheKey, stillMissing, fetchPromises;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        results = new Map();
                        missingIds = [];
                        _i = 0, teamIds_1 = teamIds;
                        _b.label = 1;
                    case 1:
                        if (!(_i < teamIds_1.length)) return [3 /*break*/, 4];
                        teamId = teamIds_1[_i];
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":team:").concat(teamId);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 2:
                        cached = _b.sent();
                        if (cached) {
                            results.set(teamId, cached);
                        }
                        else {
                            missingIds.push(teamId);
                        }
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        if (!(missingIds.length > 0)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.repository.findByExternalIds(missingIds)];
                    case 5:
                        dbTeams = _b.sent();
                        _a = 0, dbTeams_1 = dbTeams;
                        _b.label = 6;
                    case 6:
                        if (!(_a < dbTeams_1.length)) return [3 /*break*/, 9];
                        team = dbTeams_1[_a];
                        teamData = this.mapToTeamData(team);
                        results.set(team.external_id, teamData);
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":team:").concat(team.external_id);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, teamData, types_1.CacheTTL.Day)];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8:
                        _a++;
                        return [3 /*break*/, 6];
                    case 9:
                        stillMissing = missingIds.filter(function (id) { return !results.has(id); });
                        if (!(stillMissing.length > 0)) return [3 /*break*/, 11];
                        logger_1.logger.debug("Fetching ".concat(stillMissing.length, " teams from API individually"));
                        fetchPromises = stillMissing.slice(0, 10).map(function (teamId) { return __awaiter(_this, void 0, void 0, function () {
                            var team, error_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this.getTeamById(teamId)];
                                    case 1:
                                        team = _a.sent();
                                        if (team) {
                                            results.set(teamId, team);
                                        }
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_2 = _a.sent();
                                        logger_1.logger.warn("Failed to fetch individual team ".concat(teamId, " from API:"), error_2.message);
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(fetchPromises)];
                    case 10:
                        _b.sent();
                        _b.label = 11;
                    case 11: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Enrich from results_extra (from API responses)
     * NOTE: results_extra.team can be either an array or an object
     */
    TeamDataService.prototype.enrichFromResultsExtra = function (resultsExtra) {
        return __awaiter(this, void 0, void 0, function () {
            var teamsToUpdate, _i, _a, team, teamData, cacheKey, _b, _c, _d, teamId, teamInfo, teamData, cacheKey, _e, teamsToUpdate_1, _f, external_id, data, error_3;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        if (!resultsExtra.team)
                            return [2 /*return*/];
                        teamsToUpdate = [];
                        if (!Array.isArray(resultsExtra.team)) return [3 /*break*/, 5];
                        _i = 0, _a = resultsExtra.team;
                        _g.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        team = _a[_i];
                        if (!team.id) return [3 /*break*/, 3];
                        teamData = {
                            id: team.id,
                            name: team.name || null,
                            logo_url: team.logo || team.logo_url || null,
                            short_name: team.short_name || null,
                        };
                        teamsToUpdate.push({
                            external_id: team.id,
                            data: teamData,
                        });
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":team:").concat(team.id);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, teamData, types_1.CacheTTL.Day)];
                    case 2:
                        _g.sent();
                        _g.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [3 /*break*/, 9];
                    case 5:
                        _b = 0, _c = Object.entries(resultsExtra.team);
                        _g.label = 6;
                    case 6:
                        if (!(_b < _c.length)) return [3 /*break*/, 9];
                        _d = _c[_b], teamId = _d[0], teamInfo = _d[1];
                        teamData = {
                            id: teamId,
                            name: teamInfo.name || null,
                            logo_url: teamInfo.logo_url || null,
                            short_name: teamInfo.short_name || null,
                        };
                        teamsToUpdate.push({
                            external_id: teamId,
                            data: teamData,
                        });
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":team:").concat(teamId);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, teamData, types_1.CacheTTL.Day)];
                    case 7:
                        _g.sent();
                        _g.label = 8;
                    case 8:
                        _b++;
                        return [3 /*break*/, 6];
                    case 9:
                        _e = 0, teamsToUpdate_1 = teamsToUpdate;
                        _g.label = 10;
                    case 10:
                        if (!(_e < teamsToUpdate_1.length)) return [3 /*break*/, 15];
                        _f = teamsToUpdate_1[_e], external_id = _f.external_id, data = _f.data;
                        _g.label = 11;
                    case 11:
                        _g.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, this.repository.createOrUpdate(__assign({ external_id: external_id }, data))];
                    case 12:
                        _g.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        error_3 = _g.sent();
                        logger_1.logger.error("Failed to update team ".concat(external_id, ":"), error_3);
                        return [3 /*break*/, 14];
                    case 14:
                        _e++;
                        return [3 /*break*/, 10];
                    case 15:
                        logger_1.logger.info("Enriched ".concat(teamsToUpdate.length, " teams from results_extra (format: ").concat(Array.isArray(resultsExtra.team) ? 'ARRAY' : 'OBJECT', ")"));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Map database Team to TeamData
     */
    TeamDataService.prototype.mapToTeamData = function (team) {
        return {
            id: team.external_id,
            name: team.name,
            short_name: team.short_name,
            logo_url: team.logo_url,
            country_id: team.country_id,
            competition_id: team.competition_id,
        };
    };
    /**
     * Fetch team from API using /team/additional/list with pagination
     * NOTE: /team/list endpoint is not documented in API docs, using /team/additional/list instead
     */
    TeamDataService.prototype.fetchTeamFromAPI = function (teamId) {
        return __awaiter(this, void 0, void 0, function () {
            var page, hasMore, maxPages, response, team, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        page = 1;
                        hasMore = true;
                        maxPages = 10;
                        _a.label = 1;
                    case 1:
                        if (!(hasMore && page <= maxPages)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.client.get('/team/additional/list', {
                                page: page,
                                limit: 100, // Fetch 100 teams per page
                            })];
                    case 2:
                        response = _a.sent();
                        if (response.results && response.results.length > 0) {
                            team = response.results.find(function (t) { return t.id === teamId; });
                            if (team) {
                                return [2 /*return*/, {
                                        id: team.id || teamId,
                                        name: team.name || null,
                                        logo_url: team.logo_url || team.logo || null,
                                        short_name: team.short_name || null,
                                        country_id: team.country_id || null,
                                        competition_id: team.competition_id || null,
                                    }];
                            }
                            // If results array is empty, stop searching
                            if (response.results.length === 0) {
                                hasMore = false;
                            }
                            else {
                                page++;
                            }
                        }
                        else {
                            hasMore = false;
                        }
                        return [3 /*break*/, 1];
                    case 3:
                        logger_1.logger.debug("Team ".concat(teamId, " not found in first ").concat(maxPages, " pages of /team/additional/list"));
                        return [2 /*return*/, null];
                    case 4:
                        error_4 = _a.sent();
                        logger_1.logger.debug("Team API fetch failed for ".concat(teamId, ":"), error_4.message);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return TeamDataService;
}());
exports.TeamDataService = TeamDataService;
