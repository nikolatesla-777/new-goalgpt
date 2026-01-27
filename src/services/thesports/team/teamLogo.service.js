"use strict";
/**
 * Team Logo Service
 *
 * Handles team logo URL retrieval with 4-source strategy
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
exports.TeamLogoService = void 0;
var TeamRepository_1 = require("../../../repositories/implementations/TeamRepository");
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var logger_1 = require("../../../utils/logger");
var axios_1 = __importDefault(require("axios"));
var config_1 = require("../../../config");
var TeamLogoService = /** @class */ (function () {
    function TeamLogoService() {
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
    TeamLogoService.prototype.getTeamLogoUrl = function (teamId) {
        return __awaiter(this, void 0, void 0, function () {
            var team, resultsExtra, logoUrl, teamDetail, error_1, fallbackLogoUrl, isValid;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.repository.findByExternalId(teamId)];
                    case 1:
                        team = _c.sent();
                        if (team === null || team === void 0 ? void 0 : team.logo_url) {
                            return [2 /*return*/, team.logo_url];
                        }
                        return [4 /*yield*/, this.getResultsExtraFromCache()];
                    case 2:
                        resultsExtra = _c.sent();
                        if (!((_b = (_a = resultsExtra === null || resultsExtra === void 0 ? void 0 : resultsExtra.team) === null || _a === void 0 ? void 0 : _a[teamId]) === null || _b === void 0 ? void 0 : _b.logo_url)) return [3 /*break*/, 7];
                        logoUrl = resultsExtra.team[teamId].logo_url;
                        if (!(team === null || team === void 0 ? void 0 : team.id)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.repository.update(team.id, { logo_url: logoUrl })];
                    case 3:
                        _c.sent();
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this.repository.createOrUpdate({
                            external_id: teamId,
                            logo_url: logoUrl,
                        })];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6: return [2 /*return*/, logoUrl];
                    case 7:
                        _c.trys.push([7, 11, , 12]);
                        return [4 /*yield*/, this.fetchTeamDetail(teamId)];
                    case 8:
                        teamDetail = _c.sent();
                        if (!(teamDetail === null || teamDetail === void 0 ? void 0 : teamDetail.logo_url)) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.repository.update((team === null || team === void 0 ? void 0 : team.id) || teamId, { logo_url: teamDetail.logo_url })];
                    case 9:
                        _c.sent();
                        return [2 /*return*/, teamDetail.logo_url];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_1 = _c.sent();
                        logger_1.logger.debug("Team detail endpoint not available for ".concat(teamId));
                        return [3 /*break*/, 12];
                    case 12:
                        fallbackLogoUrl = this.buildFallbackLogoUrl(teamId);
                        return [4 /*yield*/, this.validateLogoUrl(fallbackLogoUrl)];
                    case 13:
                        isValid = _c.sent();
                        if (!isValid) return [3 /*break*/, 18];
                        if (!team) return [3 /*break*/, 15];
                        return [4 /*yield*/, this.repository.update(team.id, { logo_url: fallbackLogoUrl })];
                    case 14:
                        _c.sent();
                        return [3 /*break*/, 17];
                    case 15: return [4 /*yield*/, this.repository.createOrUpdate({
                            external_id: teamId,
                            logo_url: fallbackLogoUrl,
                        })];
                    case 16:
                        _c.sent();
                        _c.label = 17;
                    case 17: return [2 /*return*/, fallbackLogoUrl];
                    case 18: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Get results_extra from cache
     */
    TeamLogoService.prototype.getResultsExtraFromCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            var today, cacheKey;
            return __generator(this, function (_a) {
                today = new Date().toISOString().split('T')[0];
                cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":diary:extra:").concat(today);
                return [2 /*return*/, cache_service_1.cacheService.get(cacheKey)];
            });
        });
    };
    /**
     * Fetch team detail from API
     */
    TeamLogoService.prototype.fetchTeamDetail = function (teamId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    // TODO: Implement when team/detail endpoint is available
                    // const response = await this.client.get('/team/detail', { team_id: teamId });
                    // return { logo_url: response.logo_url };
                    return [2 /*return*/, null];
                }
                catch (error) {
                    return [2 /*return*/, null];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Build fallback logo URL pattern
     */
    TeamLogoService.prototype.buildFallbackLogoUrl = function (teamId) {
        var _a;
        var baseUrl = ((_a = config_1.config.thesports) === null || _a === void 0 ? void 0 : _a.baseUrl) || 'https://api.thesports.com/v1/football';
        var logoBaseUrl = baseUrl.replace('/v1/football', '');
        return "".concat(logoBaseUrl, "/logo/team/").concat(teamId, ".png");
    };
    /**
     * Validate logo URL (HEAD request)
     */
    TeamLogoService.prototype.validateLogoUrl = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var response, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.head(url, { timeout: 5000 })];
                    case 1:
                        response = _b.sent();
                        return [2 /*return*/, response.status === 200];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return TeamLogoService;
}());
exports.TeamLogoService = TeamLogoService;
