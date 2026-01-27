"use strict";
/**
 * Team Repository
 *
 * Data access layer for ts_teams table
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamRepository = void 0;
var BaseRepository_1 = require("../base/BaseRepository");
var TeamRepository = /** @class */ (function (_super) {
    __extends(TeamRepository, _super);
    function TeamRepository() {
        return _super.call(this, 'ts_teams', 'external_id') || this;
    }
    /**
     * Find teams by external IDs (batch)
     */
    TeamRepository.prototype.findByExternalIds = function (externalIds) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                if (externalIds.length === 0)
                    return [2 /*return*/, []];
                query = "SELECT * FROM ".concat(this.tableName, " WHERE external_id = ANY($1)");
                return [2 /*return*/, this.executeQuery(query, [externalIds])];
            });
        });
    };
    /**
     * Create or update team (idempotent)
     * CRITICAL: Removes id field to prevent NOT NULL constraint violation
     */
    TeamRepository.prototype.createOrUpdate = function (teamData) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, id, created_at, cleanData;
            return __generator(this, function (_b) {
                if (!teamData.external_id) {
                    throw new Error('external_id is required');
                }
                _a = teamData, id = _a.id, created_at = _a.created_at, cleanData = __rest(_a, ["id", "created_at"]);
                // Double-check: ensure id is not in the object
                if ('id' in cleanData) {
                    delete cleanData.id;
                }
                if ('created_at' in cleanData) {
                    delete cleanData.created_at;
                }
                return [2 /*return*/, this.upsert(cleanData, 'external_id')];
            });
        });
    };
    /**
     * Find incomplete teams (missing name or logo)
     */
    TeamRepository.prototype.findIncomplete = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var query;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_a) {
                query = "\n      SELECT * FROM ".concat(this.tableName, " \n      WHERE name IS NULL OR logo_url IS NULL\n      ORDER BY updated_at ASC\n      LIMIT $1\n    ");
                return [2 /*return*/, this.executeQuery(query, [limit])];
            });
        });
    };
    /**
     * Find teams without logo
     */
    TeamRepository.prototype.findWithoutLogo = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var query;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_a) {
                query = "\n      SELECT * FROM ".concat(this.tableName, " \n      WHERE logo_url IS NULL\n      ORDER BY updated_at ASC\n      LIMIT $1\n    ");
                return [2 /*return*/, this.executeQuery(query, [limit])];
            });
        });
    };
    /**
     * Batch upsert teams
     */
    TeamRepository.prototype.batchUpsert = function (teams) {
        return __awaiter(this, void 0, void 0, function () {
            var pool, client, results, _i, teams_1, team, isDuplicate, teamData, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (teams.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../../database/connection')); })];
                    case 1:
                        pool = (_a.sent()).pool;
                        return [4 /*yield*/, pool.connect()];
                    case 2:
                        client = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 10, 12, 13]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 4:
                        _a.sent();
                        results = [];
                        _i = 0, teams_1 = teams;
                        _a.label = 5;
                    case 5:
                        if (!(_i < teams_1.length)) return [3 /*break*/, 8];
                        team = teams_1[_i];
                        isDuplicate = !!(team.uid && team.uid.trim() !== '');
                        teamData = {
                            external_id: team.external_id,
                            name: team.name,
                            short_name: team.short_name || null,
                            logo_url: team.logo_url || null,
                            website: team.website || null,
                            national: team.national !== undefined ? team.national : null,
                            foundation_time: team.foundation_time || null,
                            competition_id: team.competition_id || null,
                            country_id: team.country_id || null,
                            venue_id: team.venue_id || null,
                            coach_id: team.coach_id || null,
                            uid: team.uid || null,
                            is_duplicate: isDuplicate,
                        };
                        // Convert updated_at timestamp to Date if provided
                        if (team.updated_at) {
                            teamData.updated_at = new Date(team.updated_at * 1000);
                        }
                        return [4 /*yield*/, this.upsert(teamData, 'external_id')];
                    case 6:
                        result = _a.sent();
                        results.push(result);
                        _a.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 5];
                    case 8: return [4 /*yield*/, client.query('COMMIT')];
                    case 9:
                        _a.sent();
                        return [2 /*return*/, results];
                    case 10:
                        error_1 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 11:
                        _a.sent();
                        throw error_1;
                    case 12:
                        client.release();
                        return [7 /*endfinally*/];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    return TeamRepository;
}(BaseRepository_1.BaseRepository));
exports.TeamRepository = TeamRepository;
