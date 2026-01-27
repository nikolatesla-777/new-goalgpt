"use strict";
/**
 * Competition Repository
 *
 * Data access layer for ts_competitions table
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
exports.CompetitionRepository = void 0;
var BaseRepository_1 = require("../base/BaseRepository");
var connection_1 = require("../../database/connection");
var CompetitionRepository = /** @class */ (function (_super) {
    __extends(CompetitionRepository, _super);
    function CompetitionRepository() {
        return _super.call(this, 'ts_competitions', 'external_id') || this;
    }
    /**
     * Find competitions by external IDs (batch)
     */
    CompetitionRepository.prototype.findByExternalIds = function (externalIds) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                if (externalIds.length === 0)
                    return [2 /*return*/, []];
                query = "\n      SELECT c.*, co.name as country_name \n      FROM ".concat(this.tableName, " c\n      LEFT JOIN ts_countries co ON c.country_id = co.external_id\n      WHERE c.external_id = ANY($1)\n    ");
                return [2 /*return*/, this.executeQuery(query, [externalIds])];
            });
        });
    };
    /**
     * Find single competition by external ID (with country JOIN)
     */
    CompetitionRepository.prototype.findByExternalId = function (externalId) {
        return __awaiter(this, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n      SELECT c.*, co.name as country_name \n      FROM ".concat(this.tableName, " c\n      LEFT JOIN ts_countries co ON c.country_id = co.external_id\n      WHERE c.external_id = $1\n    ");
                        return [4 /*yield*/, this.executeQuery(query, [externalId])];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, results.length > 0 ? results[0] : null];
                }
            });
        });
    };
    /**
     * Create or update competition (idempotent)
     * CRITICAL: Removes id field to prevent NOT NULL constraint violation
     */
    CompetitionRepository.prototype.createOrUpdate = function (competitionData) {
        return __awaiter(this, void 0, void 0, function () {
            var cleanData;
            return __generator(this, function (_a) {
                if (!competitionData.external_id) {
                    throw new Error('external_id is required');
                }
                cleanData = {
                    external_id: competitionData.external_id,
                    name: competitionData.name || 'Unknown Competition',
                    short_name: competitionData.short_name || null,
                    logo_url: competitionData.logo_url || null,
                    type: competitionData.type || null,
                    category_id: competitionData.category_id || null,
                    country_id: competitionData.country_id || null,
                    cur_season_id: competitionData.cur_season_id || null,
                    cur_stage_id: competitionData.cur_stage_id || null,
                    primary_color: competitionData.primary_color || null,
                    secondary_color: competitionData.secondary_color || null,
                    uid: competitionData.uid || null,
                    is_duplicate: competitionData.is_duplicate || false,
                };
                // TRIPLE-CHECK: Ensure id is NEVER in the object
                if ('id' in cleanData) {
                    delete cleanData.id;
                }
                if ('created_at' in cleanData) {
                    delete cleanData.created_at;
                }
                // Final safety check: explicitly set id to undefined
                cleanData.id = undefined;
                delete cleanData.id;
                return [2 /*return*/, this.upsert(cleanData, 'external_id')];
            });
        });
    };
    /**
     * Batch upsert competitions
     * CRITICAL: Triple-check ID stripping to prevent NOT NULL constraint violation
     */
    CompetitionRepository.prototype.batchUpsert = function (competitions) {
        return __awaiter(this, void 0, void 0, function () {
            var client, results, _i, competitions_1, comp, isDuplicate, cleanComp, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (competitions.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, 11, 12]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _a.sent();
                        results = [];
                        _i = 0, competitions_1 = competitions;
                        _a.label = 4;
                    case 4:
                        if (!(_i < competitions_1.length)) return [3 /*break*/, 7];
                        comp = competitions_1[_i];
                        isDuplicate = !!(comp.uid && comp.uid.trim() !== '');
                        cleanComp = {
                            external_id: comp.external_id,
                            name: comp.name,
                            short_name: comp.short_name || null,
                            logo_url: comp.logo_url || null,
                            type: comp.type || null,
                            category_id: comp.category_id || null,
                            country_id: comp.country_id || null,
                            cur_season_id: comp.cur_season_id || null,
                            cur_stage_id: comp.cur_stage_id || null,
                            primary_color: comp.primary_color || null,
                            secondary_color: comp.secondary_color || null,
                            uid: comp.uid || null,
                            is_duplicate: isDuplicate,
                        };
                        // TRIPLE-CHECK: Ensure id is NEVER in the object
                        if ('id' in cleanComp) {
                            delete cleanComp.id;
                        }
                        if ('created_at' in cleanComp) {
                            delete cleanComp.created_at;
                        }
                        // Final safety check: explicitly set id to undefined
                        cleanComp.id = undefined;
                        delete cleanComp.id;
                        return [4 /*yield*/, this.upsert(cleanComp, 'external_id')];
                    case 5:
                        result = _a.sent();
                        results.push(result);
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7: return [4 /*yield*/, client.query('COMMIT')];
                    case 8:
                        _a.sent();
                        return [2 /*return*/, results];
                    case 9:
                        error_1 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 10:
                        _a.sent();
                        throw error_1;
                    case 11:
                        client.release();
                        return [7 /*endfinally*/];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    return CompetitionRepository;
}(BaseRepository_1.BaseRepository));
exports.CompetitionRepository = CompetitionRepository;
