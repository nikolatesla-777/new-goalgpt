"use strict";
/**
 * FootyStats Repository
 *
 * All database access for FootyStats integration entities.
 * This is the ONLY place where DB access is allowed for FootyStats operations.
 *
 * PR-4: Repository Layer Lockdown
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
exports.getLeagues = getLeagues;
exports.getVerifiedLeagueMappings = getVerifiedLeagueMappings;
exports.searchMappings = searchMappings;
exports.clearAllMappings = clearAllMappings;
exports.getTeamMapping = getTeamMapping;
exports.getMatchDetails = getMatchDetails;
exports.runMigrations = runMigrations;
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
// ============================================================
// LEAGUE OPERATIONS
// ============================================================
/**
 * Search leagues by query string
 * Supports both name and country searches
 *
 * @param query - SQL query string with placeholders
 * @param params - Query parameters
 * @returns Array of leagues with country names
 */
function getLeagues(query, params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, connection_1.safeQuery)(query, params)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// ============================================================
// MAPPING OPERATIONS
// ============================================================
/**
 * Get all verified league mappings
 * Returns leagues that have been manually verified for integration
 *
 * @returns Array of verified league mappings
 */
function getVerifiedLeagueMappings() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT ts_id, ts_name, fs_id, fs_name, confidence_score\n         FROM integration_mappings\n         WHERE entity_type = 'league' AND is_verified = true\n         ORDER BY confidence_score DESC\n         LIMIT 50")];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Search mappings by name (case-insensitive)
 * Searches both TheSports and FootyStats names
 *
 * @param searchTerm - Search string
 * @returns Array of matching mappings across all entity types
 */
function searchMappings(searchTerm) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT ts_id, ts_name, fs_id, fs_name, confidence_score, is_verified, entity_type\n         FROM integration_mappings\n         WHERE LOWER(ts_name) LIKE $1 OR LOWER(fs_name) LIKE $1\n         ORDER BY confidence_score DESC\n         LIMIT 50", ["%".concat(searchTerm.toLowerCase(), "%")])];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Clear all integration mappings
 * Used for re-running mapping operations
 */
function clearAllMappings() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, connection_1.safeQuery)('DELETE FROM integration_mappings')];
                case 1:
                    _a.sent();
                    logger_1.logger.info('[FootyStatsRepository] All mappings cleared');
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Get team mapping by name
 * Used to find FootyStats team ID from TheSports team name
 *
 * @param teamName - TheSports team name
 * @param entityType - Entity type (default: 'team')
 * @returns Team mapping or empty array
 */
function getTeamMapping(teamName_1) {
    return __awaiter(this, arguments, void 0, function (teamName, entityType) {
        if (entityType === void 0) { entityType = 'team'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT fs_id FROM integration_mappings\n         WHERE entity_type = $1 AND ts_name = $2", [entityType, teamName])];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// ============================================================
// MATCH OPERATIONS
// ============================================================
/**
 * Get match details with team and league information
 * Includes LEFT JOINs for teams and competition data
 *
 * @param matchId - TheSports external match ID
 * @returns Match details with team/league names, or empty array if not found
 */
function getMatchDetails(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT m.id, m.external_id, m.home_team_id, m.away_team_id,\n                m.competition_id, m.match_time, m.status_id,\n                m.home_scores, m.away_scores,\n                ht.name as home_team_name, ht.logo_url as home_logo,\n                at.name as away_team_name, at.logo_url as away_logo,\n                c.name as league_name\n         FROM ts_matches m\n         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id::varchar\n         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id::varchar\n         LEFT JOIN ts_competitions c ON m.competition_id = c.id\n         WHERE m.external_id = $1", [matchId])];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// ============================================================
// MIGRATION OPERATIONS
// ============================================================
/**
 * Run FootyStats table migrations
 * Creates necessary tables if they don't exist
 */
function runMigrations() {
    return __awaiter(this, void 0, void 0, function () {
        var migrations, i, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    migrations = [
                        // integration_mappings
                        "CREATE TABLE IF NOT EXISTS integration_mappings (\n          id SERIAL PRIMARY KEY,\n          entity_type VARCHAR(50) NOT NULL,\n          ts_id VARCHAR(100) NOT NULL,\n          ts_name VARCHAR(255),\n          fs_id INTEGER NOT NULL,\n          fs_name VARCHAR(255),\n          confidence_score DECIMAL(5,2),\n          is_verified BOOLEAN DEFAULT FALSE,\n          verified_by VARCHAR(100),\n          verified_at TIMESTAMP,\n          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n          UNIQUE(entity_type, ts_id),\n          UNIQUE(entity_type, fs_id)\n        )",
                        // fs_match_stats
                        "CREATE TABLE IF NOT EXISTS fs_match_stats (\n          id SERIAL PRIMARY KEY,\n          match_id VARCHAR(100) NOT NULL UNIQUE,\n          fs_match_id INTEGER,\n          btts_potential INTEGER,\n          o25_potential INTEGER,\n          avg_potential DECIMAL(4,2),\n          corners_potential DECIMAL(5,2),\n          cards_potential DECIMAL(5,2),\n          xg_home_prematch DECIMAL(4,2),\n          xg_away_prematch DECIMAL(4,2),\n          trends JSONB,\n          h2h_data JSONB,\n          odds_comparison JSONB,\n          risk_level VARCHAR(20),\n          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n        )",
                        // fs_team_form
                        "CREATE TABLE IF NOT EXISTS fs_team_form (\n          id SERIAL PRIMARY KEY,\n          team_id VARCHAR(100) NOT NULL,\n          fs_team_id INTEGER,\n          season_id VARCHAR(50),\n          form_string_overall VARCHAR(20),\n          form_string_home VARCHAR(20),\n          form_string_away VARCHAR(20),\n          ppg_overall DECIMAL(4,2),\n          ppg_home DECIMAL(4,2),\n          ppg_away DECIMAL(4,2),\n          xg_for_avg DECIMAL(4,2),\n          xg_against_avg DECIMAL(4,2),\n          btts_percentage INTEGER,\n          over25_percentage INTEGER,\n          clean_sheet_percentage INTEGER,\n          failed_to_score_percentage INTEGER,\n          corners_avg DECIMAL(4,2),\n          cards_avg DECIMAL(4,2),\n          goal_timing JSONB,\n          last_x_matches INTEGER DEFAULT 5,\n          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n          UNIQUE(team_id, season_id, last_x_matches)\n        )",
                    ];
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < migrations.length)) return [3 /*break*/, 6];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, connection_1.safeQuery)(migrations[i])];
                case 3:
                    _a.sent();
                    logger_1.logger.debug("[FootyStatsRepository] Created table ".concat(i + 1, "/").concat(migrations.length));
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    logger_1.logger.error("[FootyStatsRepository] Failed to create table ".concat(i + 1, ":"), error_1);
                    throw error_1;
                case 5:
                    i++;
                    return [3 /*break*/, 1];
                case 6:
                    logger_1.logger.info('[FootyStatsRepository] FootyStats tables created successfully');
                    return [2 /*return*/];
            }
        });
    });
}
