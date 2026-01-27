"use strict";
/**
 * Match Enricher Service
 *
 * Enriches match data with team names and logos
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
exports.MatchEnricherService = void 0;
var logger_1 = require("../../../utils/logger");
var MatchEnricherService = /** @class */ (function () {
    function MatchEnricherService(teamDataService, teamLogoService, competitionService) {
        this.teamDataService = teamDataService;
        this.teamLogoService = teamLogoService;
        this.competitionService = competitionService;
    }
    /**
     * Enrich matches with team names, logos, and competition data
     */
    MatchEnricherService.prototype.enrichMatches = function (matches) {
        return __awaiter(this, void 0, void 0, function () {
            var teamIds, competitionIds, teams, competitions, missingTeamIds, fetchPromises, enrichedMatches;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (matches.length === 0)
                            return [2 /*return*/, []];
                        teamIds = new Set();
                        competitionIds = new Set();
                        matches.forEach(function (match) {
                            if (match.home_team_id)
                                teamIds.add(match.home_team_id);
                            if (match.away_team_id)
                                teamIds.add(match.away_team_id);
                            if (match.competition_id)
                                competitionIds.add(match.competition_id);
                        });
                        return [4 /*yield*/, this.teamDataService.getTeamsByIds(Array.from(teamIds))];
                    case 1:
                        teams = _a.sent();
                        return [4 /*yield*/, this.competitionService.getCompetitionsByIds(Array.from(competitionIds))];
                    case 2:
                        competitions = _a.sent();
                        missingTeamIds = Array.from(teamIds).filter(function (id) { return !teams.has(id); });
                        if (!(missingTeamIds.length > 0)) return [3 /*break*/, 4];
                        logger_1.logger.debug("Fetching ".concat(missingTeamIds.length, " missing teams from API"));
                        fetchPromises = missingTeamIds.slice(0, 10).map(function (teamId) { return __awaiter(_this, void 0, void 0, function () {
                            var team, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this.teamDataService.getTeamById(teamId)];
                                    case 1:
                                        team = _a.sent();
                                        if (team && team.name && team.name !== 'Unknown Team') {
                                            teams.set(teamId, team);
                                            logger_1.logger.debug("Successfully fetched team ".concat(teamId, ": ").concat(team.name));
                                        }
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_1 = _a.sent();
                                        logger_1.logger.warn("Failed to fetch team ".concat(teamId, " from API:"), error_1.message);
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(fetchPromises)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        enrichedMatches = matches.map(function (match) {
                            // Try to get team from map, or fetch individually as last resort
                            var homeTeam = teams.get(match.home_team_id);
                            if (!homeTeam || homeTeam.name === 'Unknown Team') {
                                // Try to fetch individually
                                _this.teamDataService.getTeamById(match.home_team_id)
                                    .then(function (team) {
                                    if (team && team.name && team.name !== 'Unknown Team') {
                                        logger_1.logger.debug("Fetched home team ".concat(match.home_team_id, ": ").concat(team.name));
                                    }
                                })
                                    .catch(function () { });
                                homeTeam = {
                                    id: match.home_team_id,
                                    name: 'Unknown Team',
                                    short_name: null,
                                    logo_url: null,
                                };
                            }
                            var awayTeam = teams.get(match.away_team_id);
                            if (!awayTeam || awayTeam.name === 'Unknown Team') {
                                // Try to fetch individually
                                _this.teamDataService.getTeamById(match.away_team_id)
                                    .then(function (team) {
                                    if (team && team.name && team.name !== 'Unknown Team') {
                                        logger_1.logger.debug("Fetched away team ".concat(match.away_team_id, ": ").concat(team.name));
                                    }
                                })
                                    .catch(function () { });
                                awayTeam = {
                                    id: match.away_team_id,
                                    name: 'Unknown Team',
                                    short_name: null,
                                    logo_url: null,
                                };
                            }
                            var competition = match.competition_id
                                ? competitions.get(match.competition_id) || null
                                : null;
                            // Fetch logos if missing (non-blocking)
                            if (!homeTeam.logo_url) {
                                _this.teamLogoService.getTeamLogoUrl(match.home_team_id)
                                    .then(function (logoUrl) {
                                    if (logoUrl) {
                                        logger_1.logger.debug("Fetched logo for home team: ".concat(match.home_team_id));
                                    }
                                })
                                    .catch(function (err) { return logger_1.logger.warn("Failed to fetch logo for ".concat(match.home_team_id, ":"), err); });
                            }
                            if (!awayTeam.logo_url) {
                                _this.teamLogoService.getTeamLogoUrl(match.away_team_id)
                                    .then(function (logoUrl) {
                                    if (logoUrl) {
                                        logger_1.logger.debug("Fetched logo for away team: ".concat(match.away_team_id));
                                    }
                                })
                                    .catch(function (err) { return logger_1.logger.warn("Failed to fetch logo for ".concat(match.away_team_id, ":"), err); });
                            }
                            return __assign(__assign({}, match), { home_team: homeTeam, away_team: awayTeam, competition: competition || undefined });
                        });
                        return [2 /*return*/, enrichedMatches];
                }
            });
        });
    };
    /**
     * Get team data or create placeholder
     */
    MatchEnricherService.prototype.getOrFetchTeam = function (teamId, teams) {
        return __awaiter(this, void 0, void 0, function () {
            var team_1, team;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (teams.has(teamId)) {
                            team_1 = teams.get(teamId);
                            // If team has name, return it; otherwise try to fetch
                            if (team_1.name && team_1.name !== 'Unknown Team') {
                                return [2 /*return*/, team_1];
                            }
                        }
                        return [4 /*yield*/, this.teamDataService.getTeamById(teamId)];
                    case 1:
                        team = _a.sent();
                        if (team && team.name && team.name !== 'Unknown Team') {
                            teams.set(teamId, team);
                            return [2 /*return*/, team];
                        }
                        // If we have a team from map but it's unknown, return it
                        if (teams.has(teamId)) {
                            return [2 /*return*/, teams.get(teamId)];
                        }
                        // Return placeholder
                        return [2 /*return*/, {
                                id: teamId,
                                name: 'Unknown Team',
                                short_name: null,
                                logo_url: null,
                            }];
                }
            });
        });
    };
    return MatchEnricherService;
}());
exports.MatchEnricherService = MatchEnricherService;
