"use strict";
/**
 * Competition Service
 *
 * Handles competition data retrieval
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitionService = void 0;
// PR-5B: Migrated to hardened TheSportsClient via adapter
var thesports_1 = require("../../../integrations/thesports");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var logger_1 = require("../../../utils/logger");
var CompetitionRepository_1 = require("../../../repositories/implementations/CompetitionRepository");
var CompetitionService = /** @class */ (function () {
    function CompetitionService() {
        this.client = thesports_1.theSportsAPIAdapter;
        this.repository = new CompetitionRepository_1.CompetitionRepository();
    }
    /**
     * Get competition list
     */
    CompetitionService.prototype.getCompetitionList = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":competition:list");
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _a.sent();
                        if (cached) {
                            logger_1.logger.debug('Cache hit for competition list');
                            return [2 /*return*/, cached];
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        logger_1.logger.info('Fetching competition list from API');
                        return [4 /*yield*/, this.client.get('/competition/list')];
                    case 3:
                        response = _a.sent();
                        if (response.err) {
                            logger_1.logger.warn("TheSports API error for competition list: ".concat(response.err));
                            return [2 /*return*/, { results: [], err: response.err }];
                        }
                        // Cache response
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Day)];
                    case 4:
                        // Cache response
                        _a.sent();
                        return [2 /*return*/, response];
                    case 5:
                        error_1 = _a.sent();
                        logger_1.logger.error('Failed to fetch competition list:', error_1);
                        return [2 /*return*/, { results: [], err: error_1.message }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get competition by ID (from database first, fallback to API)
     */
    CompetitionService.prototype.getCompetitionById = function (competitionId) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, dbCompetition, competition, list, apiCompetition, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":competition:").concat(competitionId);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _a.sent();
                        if (cached) {
                            return [2 /*return*/, cached];
                        }
                        return [4 /*yield*/, this.repository.findByExternalId(competitionId)];
                    case 2:
                        dbCompetition = _a.sent();
                        if (!dbCompetition) return [3 /*break*/, 4];
                        competition = {
                            id: dbCompetition.external_id,
                            name: dbCompetition.name,
                            short_name: dbCompetition.short_name || null,
                            logo_url: dbCompetition.logo_url || null,
                            type: dbCompetition.type || null,
                            category_id: dbCompetition.category_id || null,
                            country_id: dbCompetition.country_id || null,
                            country_name: dbCompetition.country_name || undefined, // From ts_countries JOIN
                            cur_season_id: dbCompetition.cur_season_id || null,
                            cur_stage_id: dbCompetition.cur_stage_id || null,
                            primary_color: dbCompetition.primary_color || null,
                            secondary_color: dbCompetition.secondary_color || null,
                        };
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, competition, types_1.CacheTTL.Day)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, competition];
                    case 4:
                        // 3. Fallback to API (should rarely happen if sync is working)
                        logger_1.logger.debug("Competition ".concat(competitionId, " not in DB, fetching from API"));
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 9, , 10]);
                        return [4 /*yield*/, this.getCompetitionList()];
                    case 6:
                        list = _a.sent();
                        if (!(list && list.results && Array.isArray(list.results))) return [3 /*break*/, 8];
                        apiCompetition = list.results.find(function (c) { return c && c.id === competitionId; });
                        if (!apiCompetition) return [3 /*break*/, 8];
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, apiCompetition, types_1.CacheTTL.Day)];
                    case 7:
                        _a.sent();
                        return [2 /*return*/, apiCompetition];
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_2 = _a.sent();
                        logger_1.logger.warn("Failed to fetch competition ".concat(competitionId, " from API: ").concat(error_2.message));
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Get competitions by IDs (batch) - from database first
     */
    CompetitionService.prototype.getCompetitionsByIds = function (competitionIds) {
        return __awaiter(this, void 0, void 0, function () {
            var map, cachePromises, missingIds, dbCompetitions, _i, dbCompetitions_1, dbComp, competition, cacheKey, stillMissing, list, _a, _b, comp, cacheKey, error_3;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        map = new Map();
                        if (competitionIds.length === 0)
                            return [2 /*return*/, map];
                        cachePromises = competitionIds.map(function (id) { return __awaiter(_this, void 0, void 0, function () {
                            var cacheKey, cached;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":competition:").concat(id);
                                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                                    case 1:
                                        cached = _a.sent();
                                        if (cached) {
                                            map.set(id, cached);
                                        }
                                        return [2 /*return*/, { id: id, cached: cached }];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(cachePromises)];
                    case 1:
                        _c.sent();
                        missingIds = competitionIds.filter(function (id) { return !map.has(id); });
                        if (!(missingIds.length > 0)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.repository.findByExternalIds(missingIds)];
                    case 2:
                        dbCompetitions = _c.sent();
                        _i = 0, dbCompetitions_1 = dbCompetitions;
                        _c.label = 3;
                    case 3:
                        if (!(_i < dbCompetitions_1.length)) return [3 /*break*/, 6];
                        dbComp = dbCompetitions_1[_i];
                        competition = {
                            id: dbComp.external_id,
                            name: dbComp.name,
                            short_name: dbComp.short_name || null,
                            logo_url: dbComp.logo_url || null,
                            type: dbComp.type || null,
                            category_id: dbComp.category_id || null,
                            country_id: dbComp.country_id || null,
                            country_name: dbComp.country_name || undefined, // From ts_countries JOIN
                            cur_season_id: dbComp.cur_season_id || null,
                            cur_stage_id: dbComp.cur_stage_id || null,
                            primary_color: dbComp.primary_color || null,
                            secondary_color: dbComp.secondary_color || null,
                        };
                        map.set(dbComp.external_id, competition);
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":competition:").concat(dbComp.external_id);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, competition, types_1.CacheTTL.Day)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        stillMissing = competitionIds.filter(function (id) { return !map.has(id); });
                        if (!(stillMissing.length > 0)) return [3 /*break*/, 14];
                        logger_1.logger.debug("Fetching ".concat(stillMissing.length, " competitions from API (not in DB)"));
                        _c.label = 7;
                    case 7:
                        _c.trys.push([7, 13, , 14]);
                        return [4 /*yield*/, this.getCompetitionList()];
                    case 8:
                        list = _c.sent();
                        if (!(list && list.results && Array.isArray(list.results))) return [3 /*break*/, 12];
                        _a = 0, _b = list.results;
                        _c.label = 9;
                    case 9:
                        if (!(_a < _b.length)) return [3 /*break*/, 12];
                        comp = _b[_a];
                        if (!(comp && comp.id && stillMissing.includes(comp.id))) return [3 /*break*/, 11];
                        map.set(comp.id, comp);
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":competition:").concat(comp.id);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, comp, types_1.CacheTTL.Day)];
                    case 10:
                        _c.sent();
                        _c.label = 11;
                    case 11:
                        _a++;
                        return [3 /*break*/, 9];
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        error_3 = _c.sent();
                        logger_1.logger.warn("Failed to fetch competition list from API: ".concat(error_3.message));
                        return [3 /*break*/, 14];
                    case 14: return [2 /*return*/, map];
                }
            });
        });
    };
    /**
     * Enrich competition data from results_extra
     * CRITICAL: Saves to DB, not just cache (prevents foreign key constraint failures)
     */
    CompetitionService.prototype.enrichFromResultsExtra = function (resultsExtra) {
        return __awaiter(this, void 0, void 0, function () {
            var competitions, competitionsToSave, _i, _a, _b, compId, compData, competition, cacheKey, error_4;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!resultsExtra.competition) {
                            return [2 /*return*/];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 8, , 9]);
                        competitions = resultsExtra.competition;
                        competitionsToSave = [];
                        _i = 0, _a = Object.entries(competitions);
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        _b = _a[_i], compId = _b[0], compData = _b[1];
                        if (!compId || compId === '0' || compId === '')
                            return [3 /*break*/, 4];
                        competition = {
                            id: compId,
                            name: compData.name || compData.name_en || compData.name_cn || 'Unknown Competition',
                            logo_url: compData.logo_url || compData.logo || null,
                            country_id: compData.country_id || undefined,
                            country_name: compData.country_name || undefined,
                        };
                        // Save to DB (CRITICAL: Prevents foreign key constraint failures)
                        competitionsToSave.push({
                            external_id: compId,
                            name: competition.name,
                            logo_url: competition.logo_url || null,
                            country_id: competition.country_id || null,
                            category_id: compData.category_id || null,
                            type: compData.type || null,
                        });
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":competition:").concat(compId);
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, competition, types_1.CacheTTL.Day)];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        if (!(competitionsToSave.length > 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.repository.batchUpsert(competitionsToSave)];
                    case 6:
                        _c.sent();
                        logger_1.logger.info("\u2705 Saved ".concat(competitionsToSave.length, " competitions to DB from results_extra"));
                        _c.label = 7;
                    case 7:
                        logger_1.logger.debug("Enriched ".concat(Object.keys(competitions).length, " competitions from results_extra"));
                        return [3 /*break*/, 9];
                    case 8:
                        error_4 = _c.sent();
                        logger_1.logger.error('❌ Failed to enrich competitions from results_extra:', error_4.message);
                        throw error_4; // Re-throw to prevent silent failures
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    return CompetitionService;
}());
exports.CompetitionService = CompetitionService;
