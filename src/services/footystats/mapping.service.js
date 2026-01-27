"use strict";
/**
 * FootyStats Mapping Service
 *
 * Handles the mapping between TheSports IDs and FootyStats IDs
 * using fuzzy string matching (Levenshtein distance).
 *
 * @author GoalGPT Team
 * @version 1.0.0
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
exports.FootyStatsMappingService = exports.mappingService = void 0;
exports.normalizeString = normalizeString;
exports.stringSimilarity = stringSimilarity;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var footystats_client_1 = require("./footystats.client");
// ============================================================================
// STRING SIMILARITY (Levenshtein Distance)
// ============================================================================
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    var m = str1.length;
    var n = str2.length;
    var dp = Array(m + 1)
        .fill(null)
        .map(function () { return Array(n + 1).fill(0); });
    for (var i = 0; i <= m; i++)
        dp[i][0] = i;
    for (var j = 0; j <= n; j++)
        dp[0][j] = j;
    for (var i = 1; i <= m; i++) {
        for (var j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}
/**
 * Calculate similarity score (0-100) between two strings
 */
function stringSimilarity(str1, str2) {
    var maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0)
        return 100;
    var distance = levenshteinDistance(str1, str2);
    return ((maxLength - distance) / maxLength) * 100;
}
/**
 * Normalize string for comparison
 * - Lowercase
 * - Remove special characters
 * - Common abbreviation replacements
 */
function normalizeString(str) {
    var normalized = str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special chars
        .replace(/\s+/g, ' '); // Normalize spaces
    // Common football team/league name replacements
    var replacements = {
        // Nationality adjectives to country names
        'english': 'england',
        'french': 'france',
        'german': 'germany',
        'spanish': 'spain',
        'italian': 'italy',
        'dutch': 'netherlands',
        'portuguese': 'portugal',
        'belgian': 'belgium',
        'scottish': 'scotland',
        'welsh': 'wales',
        'irish': 'ireland',
        'turkish': 'turkey',
        'greek': 'greece',
        'austrian': 'austria',
        'swiss': 'switzerland',
        'brazilian': 'brazil',
        'argentine': 'argentina',
        'mexican': 'mexico',
        'american': 'usa',
        'japanese': 'japan',
        'korean': 'korea',
        'chinese': 'china',
        'australian': 'australia',
        // Football abbreviations
        'fc': '',
        'sc': '',
        'cf': '',
        'ac': '',
        'as': '',
        'ss': '',
        'sd': '',
        'cd': '',
        'rcd': '',
        'rc': '',
        'real': '',
        'athletic': 'atletico',
        'united': 'utd',
        'city': '',
        'town': '',
        'wanderers': '',
        'rovers': '',
        'hotspur': '',
        'albion': '',
        'villa': '',
        'palace': '',
        'forest': '',
        'ham': '',
        '1899': '',
        '1900': '',
        '1904': '',
        '1909': '',
    };
    for (var _i = 0, _a = Object.entries(replacements); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        normalized = normalized.replace(new RegExp("\\b".concat(key, "\\b"), 'g'), value);
    }
    return normalized.replace(/\s+/g, ' ').trim();
}
// ============================================================================
// MAPPING SERVICE
// ============================================================================
var FootyStatsMappingService = /** @class */ (function () {
    function FootyStatsMappingService() {
        this.AUTO_VERIFY_THRESHOLD = 90; // 90%+ = auto verify
        this.REVIEW_THRESHOLD = 60; // 60-90% = needs review
    }
    FootyStatsMappingService.getInstance = function () {
        if (!FootyStatsMappingService.instance) {
            FootyStatsMappingService.instance = new FootyStatsMappingService();
        }
        return FootyStatsMappingService.instance;
    };
    // ============================================================================
    // LEAGUE MAPPING
    // ============================================================================
    /**
     * Map all TheSports leagues to FootyStats leagues
     */
    FootyStatsMappingService.prototype.mapLeagues = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stats, tsLeagues, fsResponse, fsLeagues, _i, tsLeagues_1, tsLeague, normalizedTsName, bestMatch, highestScore, _a, fsLeagues_1, fsLeague, countryMatch, normalizedFullName, normalizedLeagueName, fullNameScore, leagueNameScore, score, isAutoVerified, seasons, latestSeason, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        logger_1.logger.info('[Mapping] Starting league mapping...');
                        stats = {
                            total: 0,
                            auto_verified: 0,
                            pending_review: 0,
                            no_match: 0,
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT c.id, c.name, COALESCE(co.name, 'International') as country_name\n         FROM ts_competitions c\n         LEFT JOIN ts_countries co ON c.country_id = co.external_id\n         ORDER BY co.name NULLS LAST, c.name\n         LIMIT 3000")];
                    case 2:
                        tsLeagues = _b.sent();
                        if (tsLeagues.length === 0) {
                            logger_1.logger.warn('[Mapping] No active leagues found in ts_competitions');
                            return [2 /*return*/, stats];
                        }
                        return [4 /*yield*/, footystats_client_1.footyStatsAPI.getLeagueList()];
                    case 3:
                        fsResponse = _b.sent();
                        fsLeagues = fsResponse.data;
                        if (!fsLeagues || fsLeagues.length === 0) {
                            logger_1.logger.warn('[Mapping] No leagues returned from FootyStats API');
                            return [2 /*return*/, stats];
                        }
                        logger_1.logger.info("[Mapping] Matching ".concat(tsLeagues.length, " TheSports leagues with ").concat(fsLeagues.length, " FootyStats leagues"));
                        _i = 0, tsLeagues_1 = tsLeagues;
                        _b.label = 4;
                    case 4:
                        if (!(_i < tsLeagues_1.length)) return [3 /*break*/, 8];
                        tsLeague = tsLeagues_1[_i];
                        stats.total++;
                        normalizedTsName = normalizeString(tsLeague.name);
                        bestMatch = null;
                        highestScore = 0;
                        // Find best match among FootyStats leagues (same country preferred)
                        for (_a = 0, fsLeagues_1 = fsLeagues; _a < fsLeagues_1.length; _a++) {
                            fsLeague = fsLeagues_1[_a];
                            countryMatch = normalizeString(fsLeague.country) === normalizeString(tsLeague.country_name) ||
                                stringSimilarity(normalizeString(fsLeague.country), normalizeString(tsLeague.country_name)) > 80;
                            if (!countryMatch)
                                continue;
                            normalizedFullName = normalizeString(fsLeague.name);
                            normalizedLeagueName = normalizeString(fsLeague.league_name || '');
                            fullNameScore = stringSimilarity(normalizedTsName, normalizedFullName);
                            leagueNameScore = normalizedLeagueName
                                ? stringSimilarity(normalizedTsName, normalizedLeagueName)
                                : 0;
                            score = Math.max(fullNameScore, leagueNameScore);
                            if (score > highestScore) {
                                highestScore = score;
                                bestMatch = fsLeague;
                            }
                        }
                        if (!(bestMatch && highestScore >= this.REVIEW_THRESHOLD)) return [3 /*break*/, 6];
                        isAutoVerified = highestScore >= this.AUTO_VERIFY_THRESHOLD;
                        seasons = bestMatch.season || [];
                        latestSeason = seasons.length > 0
                            ? seasons.reduce(function (a, b) { return (a.year > b.year ? a : b); })
                            : null;
                        if (!latestSeason) {
                            logger_1.logger.warn("[Mapping] No seasons found for ".concat(bestMatch.name));
                            stats.no_match++;
                            return [3 /*break*/, 7];
                        }
                        return [4 /*yield*/, this.saveMapping({
                                entity_type: 'league',
                                ts_id: tsLeague.id,
                                ts_name: tsLeague.name,
                                fs_id: latestSeason.id,
                                fs_name: "".concat(bestMatch.name, " (").concat(latestSeason.year, ")"),
                                confidence_score: highestScore,
                                is_verified: isAutoVerified,
                            })];
                    case 5:
                        _b.sent();
                        if (isAutoVerified) {
                            stats.auto_verified++;
                            logger_1.logger.debug("[Mapping] \u2713 Auto-verified: ".concat(tsLeague.name, " \u2192 ").concat(bestMatch.name, " (").concat(highestScore.toFixed(1), "%)"));
                        }
                        else {
                            stats.pending_review++;
                            logger_1.logger.debug("[Mapping] ? Needs review: ".concat(tsLeague.name, " \u2192 ").concat(bestMatch.name, " (").concat(highestScore.toFixed(1), "%)"));
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        stats.no_match++;
                        logger_1.logger.warn("[Mapping] \u2717 No match for: ".concat(tsLeague.name, " (best: ").concat(highestScore.toFixed(1), "%)"));
                        _b.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 4];
                    case 8:
                        logger_1.logger.info("[Mapping] League mapping complete: ".concat(stats.auto_verified, " verified, ").concat(stats.pending_review, " pending, ").concat(stats.no_match, " no match"));
                        return [2 /*return*/, stats];
                    case 9:
                        error_1 = _b.sent();
                        logger_1.logger.error('[Mapping] League mapping failed:', error_1);
                        throw error_1;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    // ============================================================================
    // TEAM MAPPING
    // ============================================================================
    /**
     * Map teams for a specific league
     */
    FootyStatsMappingService.prototype.mapTeamsForLeague = function (tsLeagueId) {
        return __awaiter(this, void 0, void 0, function () {
            var stats, leagueMapping, tsTeams, fsTeams, fsResponse, apiError_1, _i, tsTeams_1, tsTeam, normalizedTsName, bestMatch, highestScore, _a, fsTeams_1, fsTeam, normalizedFsName, score, isAutoVerified, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        logger_1.logger.info("[Mapping] Starting team mapping for league ".concat(tsLeagueId, "..."));
                        stats = {
                            total: 0,
                            auto_verified: 0,
                            pending_review: 0,
                            no_match: 0,
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 13, , 14]);
                        return [4 /*yield*/, this.getMapping('league', tsLeagueId)];
                    case 2:
                        leagueMapping = _b.sent();
                        if (!leagueMapping) {
                            logger_1.logger.warn("[Mapping] No FootyStats mapping found for league ".concat(tsLeagueId));
                            return [2 /*return*/, stats];
                        }
                        return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT DISTINCT t.id, t.name\n         FROM ts_teams t\n         JOIN ts_matches m ON (t.external_id = m.home_team_id OR t.external_id = m.away_team_id)\n         JOIN ts_competitions c ON m.competition_id = c.external_id\n         WHERE c.id = $1\n         ORDER BY t.name", [tsLeagueId])];
                    case 3:
                        tsTeams = _b.sent();
                        if (tsTeams.length === 0) {
                            logger_1.logger.warn("[Mapping] No teams found for league ".concat(tsLeagueId));
                            return [2 /*return*/, stats];
                        }
                        fsTeams = [];
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, footystats_client_1.footyStatsAPI.getLeagueTeams(leagueMapping.fs_id)];
                    case 5:
                        fsResponse = _b.sent();
                        fsTeams = fsResponse.data || [];
                        return [3 /*break*/, 7];
                    case 6:
                        apiError_1 = _b.sent();
                        logger_1.logger.warn("[Mapping] FootyStats API error for season ".concat(leagueMapping.fs_id, ": ").concat(apiError_1.message || 'Unknown error'));
                        return [2 /*return*/, stats];
                    case 7:
                        if (!fsTeams || fsTeams.length === 0) {
                            logger_1.logger.warn("[Mapping] No teams returned from FootyStats for season ".concat(leagueMapping.fs_id));
                            return [2 /*return*/, stats];
                        }
                        logger_1.logger.info("[Mapping] Matching ".concat(tsTeams.length, " TheSports teams with ").concat(fsTeams.length, " FootyStats teams"));
                        _i = 0, tsTeams_1 = tsTeams;
                        _b.label = 8;
                    case 8:
                        if (!(_i < tsTeams_1.length)) return [3 /*break*/, 12];
                        tsTeam = tsTeams_1[_i];
                        stats.total++;
                        normalizedTsName = normalizeString(tsTeam.name);
                        bestMatch = null;
                        highestScore = 0;
                        for (_a = 0, fsTeams_1 = fsTeams; _a < fsTeams_1.length; _a++) {
                            fsTeam = fsTeams_1[_a];
                            normalizedFsName = normalizeString(fsTeam.cleanName || fsTeam.name);
                            score = stringSimilarity(normalizedTsName, normalizedFsName);
                            if (score > highestScore) {
                                highestScore = score;
                                bestMatch = fsTeam;
                            }
                        }
                        if (!(bestMatch && highestScore >= this.REVIEW_THRESHOLD)) return [3 /*break*/, 10];
                        isAutoVerified = highestScore >= this.AUTO_VERIFY_THRESHOLD;
                        return [4 /*yield*/, this.saveMapping({
                                entity_type: 'team',
                                ts_id: tsTeam.id,
                                ts_name: tsTeam.name,
                                fs_id: bestMatch.id,
                                fs_name: bestMatch.name,
                                confidence_score: highestScore,
                                is_verified: isAutoVerified,
                            })];
                    case 9:
                        _b.sent();
                        if (isAutoVerified) {
                            stats.auto_verified++;
                        }
                        else {
                            stats.pending_review++;
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        stats.no_match++;
                        logger_1.logger.warn("[Mapping] \u2717 No match for team: ".concat(tsTeam.name));
                        _b.label = 11;
                    case 11:
                        _i++;
                        return [3 /*break*/, 8];
                    case 12:
                        logger_1.logger.info("[Mapping] Team mapping complete for league ".concat(tsLeagueId));
                        return [2 /*return*/, stats];
                    case 13:
                        error_2 = _b.sent();
                        logger_1.logger.error("[Mapping] Team mapping failed for league ".concat(tsLeagueId, ":"), error_2);
                        throw error_2;
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Map teams for all mapped leagues
     */
    FootyStatsMappingService.prototype.mapAllTeams = function () {
        return __awaiter(this, void 0, void 0, function () {
            var totalStats, leagueMappings, _i, leagueMappings_1, mapping, stats;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info('[Mapping] Starting team mapping for all leagues...');
                        totalStats = {
                            total: 0,
                            auto_verified: 0,
                            pending_review: 0,
                            no_match: 0,
                        };
                        return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT ts_id FROM integration_mappings\n       WHERE entity_type = 'league' AND is_verified = true")];
                    case 1:
                        leagueMappings = _a.sent();
                        _i = 0, leagueMappings_1 = leagueMappings;
                        _a.label = 2;
                    case 2:
                        if (!(_i < leagueMappings_1.length)) return [3 /*break*/, 5];
                        mapping = leagueMappings_1[_i];
                        return [4 /*yield*/, this.mapTeamsForLeague(mapping.ts_id)];
                    case 3:
                        stats = _a.sent();
                        totalStats.total += stats.total;
                        totalStats.auto_verified += stats.auto_verified;
                        totalStats.pending_review += stats.pending_review;
                        totalStats.no_match += stats.no_match;
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        logger_1.logger.info("[Mapping] All team mapping complete: ".concat(totalStats.auto_verified, " verified, ").concat(totalStats.pending_review, " pending"));
                        return [2 /*return*/, totalStats];
                }
            });
        });
    };
    // ============================================================================
    // DATABASE OPERATIONS
    // ============================================================================
    /**
     * Save or update a mapping
     */
    FootyStatsMappingService.prototype.saveMapping = function (mapping) {
        return __awaiter(this, void 0, void 0, function () {
            var err_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, connection_1.safeQuery)("INSERT INTO integration_mappings\n          (entity_type, ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified, updated_at)\n         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())\n         ON CONFLICT (entity_type, ts_id)\n         DO UPDATE SET\n          fs_id = EXCLUDED.fs_id,\n          fs_name = EXCLUDED.fs_name,\n          confidence_score = EXCLUDED.confidence_score,\n          is_verified = EXCLUDED.is_verified,\n          updated_at = NOW()", [
                                mapping.entity_type,
                                mapping.ts_id,
                                mapping.ts_name,
                                mapping.fs_id,
                                mapping.fs_name,
                                mapping.confidence_score,
                                mapping.is_verified,
                            ])];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _b.sent();
                        // Skip duplicate fs_id errors (multiple TheSports leagues may map to same FootyStats season)
                        if (err_1.code === '23505' && ((_a = err_1.constraint) === null || _a === void 0 ? void 0 : _a.includes('fs_id'))) {
                            logger_1.logger.debug("[Mapping] Skipping duplicate fs_id ".concat(mapping.fs_id, " for ").concat(mapping.ts_name));
                            return [2 /*return*/];
                        }
                        throw err_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get mapping for a specific entity
     */
    FootyStatsMappingService.prototype.getMapping = function (entityType, tsId) {
        return __awaiter(this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified\n       FROM integration_mappings\n       WHERE entity_type = $1 AND ts_id = $2", [entityType, tsId])];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, results[0] || null];
                }
            });
        });
    };
    /**
     * Get FootyStats ID for a TheSports entity
     */
    FootyStatsMappingService.prototype.getFootyStatsId = function (entityType, tsId) {
        return __awaiter(this, void 0, void 0, function () {
            var mapping;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getMapping(entityType, tsId)];
                    case 1:
                        mapping = _a.sent();
                        return [2 /*return*/, (mapping === null || mapping === void 0 ? void 0 : mapping.fs_id) || null];
                }
            });
        });
    };
    /**
     * Get all unverified mappings for admin review
     */
    FootyStatsMappingService.prototype.getUnverifiedMappings = function (entityType) {
        return __awaiter(this, void 0, void 0, function () {
            var query, params;
            return __generator(this, function (_a) {
                query = "\n      SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified\n      FROM integration_mappings\n      WHERE is_verified = false\n    ";
                params = [];
                if (entityType) {
                    query += " AND entity_type = $1";
                    params.push(entityType);
                }
                query += " ORDER BY confidence_score DESC";
                return [2 /*return*/, (0, connection_1.safeQuery)(query, params)];
            });
        });
    };
    /**
     * Manually verify a mapping
     */
    FootyStatsMappingService.prototype.verifyMapping = function (entityType_1, tsId_1) {
        return __awaiter(this, arguments, void 0, function (entityType, tsId, verifiedBy) {
            if (verifiedBy === void 0) { verifiedBy = 'admin'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("UPDATE integration_mappings\n       SET is_verified = true, verified_by = $3, verified_at = NOW(), updated_at = NOW()\n       WHERE entity_type = $1 AND ts_id = $2", [entityType, tsId, verifiedBy])];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("[Mapping] Verified: ".concat(entityType, " ").concat(tsId));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update mapping with correct FootyStats ID
     */
    FootyStatsMappingService.prototype.updateMapping = function (entityType, tsId, newFsId, newFsName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("UPDATE integration_mappings\n       SET fs_id = $3, fs_name = $4, confidence_score = 100, is_verified = true, updated_at = NOW()\n       WHERE entity_type = $1 AND ts_id = $2", [entityType, tsId, newFsId, newFsName])];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("[Mapping] Updated: ".concat(entityType, " ").concat(tsId, " \u2192 ").concat(newFsId));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get mapping statistics
     */
    FootyStatsMappingService.prototype.getStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var leagueStats, teamStats, parseStats;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT is_verified, COUNT(*) as count\n       FROM integration_mappings\n       WHERE entity_type = 'league'\n       GROUP BY is_verified")];
                    case 1:
                        leagueStats = _a.sent();
                        return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT is_verified, COUNT(*) as count\n       FROM integration_mappings\n       WHERE entity_type = 'team'\n       GROUP BY is_verified")];
                    case 2:
                        teamStats = _a.sent();
                        parseStats = function (rows) {
                            var verified = 0;
                            var pending = 0;
                            for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                                var row = rows_1[_i];
                                if (row.is_verified) {
                                    verified = parseInt(row.count);
                                }
                                else {
                                    pending = parseInt(row.count);
                                }
                            }
                            return {
                                total: verified + pending,
                                auto_verified: verified,
                                pending_review: pending,
                                no_match: 0,
                            };
                        };
                        return [2 /*return*/, {
                                leagues: parseStats(leagueStats),
                                teams: parseStats(teamStats),
                            }];
                }
            });
        });
    };
    FootyStatsMappingService.instance = null;
    return FootyStatsMappingService;
}());
exports.FootyStatsMappingService = FootyStatsMappingService;
// ============================================================================
// EXPORTS
// ============================================================================
exports.mappingService = FootyStatsMappingService.getInstance();
