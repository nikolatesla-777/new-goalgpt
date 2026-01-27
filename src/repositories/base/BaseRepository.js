"use strict";
/**
 * Base Repository
 *
 * Generic base class for repositories with common CRUD logic and idempotency
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var BaseRepository = /** @class */ (function () {
    function BaseRepository(tableName, externalIdColumn) {
        if (externalIdColumn === void 0) { externalIdColumn = 'external_id'; }
        this.tableName = tableName;
        this.externalIdColumn = externalIdColumn;
    }
    /**
     * Execute query with error handling
     */
    BaseRepository.prototype.executeQuery = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, params, client) {
            var dbClient, _a, result, error_1;
            if (params === void 0) { params = []; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = client;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        dbClient = _a;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, 6, 7]);
                        return [4 /*yield*/, dbClient.query(query, params)];
                    case 4:
                        result = _b.sent();
                        return [2 /*return*/, result.rows];
                    case 5:
                        error_1 = _b.sent();
                        logger_1.logger.error("Database error in ".concat(this.tableName, ":"), {
                            message: error_1.message,
                            query: query,
                            params: params,
                        });
                        throw error_1;
                    case 6:
                        if (!client) {
                            dbClient.release();
                        }
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Find by ID
     */
    BaseRepository.prototype.findById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var query, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "SELECT * FROM ".concat(this.tableName, " WHERE id = $1");
                        return [4 /*yield*/, this.executeQuery(query, [id])];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows.length > 0 ? rows[0] : null];
                }
            });
        });
    };
    /**
     * Find by external ID (TheSports ID)
     */
    BaseRepository.prototype.findByExternalId = function (externalId) {
        return __awaiter(this, void 0, void 0, function () {
            var query, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "SELECT * FROM ".concat(this.tableName, " WHERE ").concat(this.externalIdColumn, " = $1");
                        return [4 /*yield*/, this.executeQuery(query, [externalId])];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows.length > 0 ? rows[0] : null];
                }
            });
        });
    };
    /**
     * Find all
     */
    BaseRepository.prototype.findAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                query = "SELECT * FROM ".concat(this.tableName);
                return [2 /*return*/, this.executeQuery(query)];
            });
        });
    };
    /**
     * Create new record
     */
    BaseRepository.prototype.create = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var columns, placeholders, values, query, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        columns = Object.keys(item).join(', ');
                        placeholders = Object.keys(item)
                            .map(function (_, index) { return "$".concat(index + 1); })
                            .join(', ');
                        values = Object.values(item);
                        query = "INSERT INTO ".concat(this.tableName, " (").concat(columns, ") VALUES (").concat(placeholders, ") RETURNING *");
                        return [4 /*yield*/, this.executeQuery(query, values)];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows[0]];
                }
            });
        });
    };
    /**
     * Update record
     */
    BaseRepository.prototype.update = function (id, item) {
        return __awaiter(this, void 0, void 0, function () {
            var setClause, values, query, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setClause = Object.keys(item)
                            .map(function (key, index) { return "".concat(key, " = $").concat(index + 2); })
                            .join(', ');
                        values = __spreadArray([id], Object.values(item), true);
                        query = "UPDATE ".concat(this.tableName, " SET ").concat(setClause, ", updated_at = NOW() WHERE id = $1 RETURNING *");
                        return [4 /*yield*/, this.executeQuery(query, values)];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows.length > 0 ? rows[0] : null];
                }
            });
        });
    };
    /**
     * Upsert (Insert or Update) - Idempotent operation
     * Uses ON CONFLICT DO UPDATE to prevent duplicates
     * CRITICAL: Triple-check ID stripping to prevent NOT NULL constraint violation
     */
    BaseRepository.prototype.upsert = function (item_1) {
        return __awaiter(this, arguments, void 0, function (item, conflictKey) {
            var itemAny, insertData, key, columns, placeholders, values, updateClause, query, rows;
            if (conflictKey === void 0) { conflictKey = this.externalIdColumn; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        itemAny = item;
                        insertData = {};
                        // Only copy allowed fields (explicitly exclude id and created_at)
                        for (key in itemAny) {
                            if (key !== 'id' && key !== 'created_at' && itemAny.hasOwnProperty(key)) {
                                insertData[key] = itemAny[key];
                            }
                        }
                        // FINAL SAFETY CHECK: Explicitly remove id if it somehow got in
                        delete insertData.id;
                        delete insertData.created_at;
                        columns = Object.keys(insertData).filter(function (k) { return k !== 'id' && k !== 'created_at'; }).join(', ');
                        placeholders = Object.keys(insertData)
                            .filter(function (k) { return k !== 'id' && k !== 'created_at'; })
                            .map(function (_, index) { return "$".concat(index + 1); })
                            .join(', ');
                        values = Object.keys(insertData)
                            .filter(function (k) { return k !== 'id' && k !== 'created_at'; })
                            .map(function (k) { return insertData[k]; });
                        updateClause = Object.keys(insertData)
                            .filter(function (key) { return key !== conflictKey && key !== 'updated_at'; }) // Exclude updated_at - we set it manually
                            .map(function (key, index) {
                            var valueIndex = Object.keys(insertData).indexOf(key) + 1;
                            return "".concat(key, " = $").concat(valueIndex);
                        })
                            .join(', ');
                        query = "\n      INSERT INTO ".concat(this.tableName, " (").concat(columns, ")\n      VALUES (").concat(placeholders, ")\n      ON CONFLICT (").concat(conflictKey, ") \n      DO UPDATE SET ").concat(updateClause, ", updated_at = NOW()\n      RETURNING *\n    ");
                        return [4 /*yield*/, this.executeQuery(query, values)];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows[0]];
                }
            });
        });
    };
    /**
     * Delete record
     */
    BaseRepository.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var query, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "DELETE FROM ".concat(this.tableName, " WHERE id = $1");
                        return [4 /*yield*/, this.executeQuery(query, [id])];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, rows.length > 0];
                }
            });
        });
    };
    /**
     * Batch upsert - Idempotent bulk operation
     */
    BaseRepository.prototype.batchUpsert = function (items_1) {
        return __awaiter(this, arguments, void 0, function (items, conflictKey) {
            var client, results, _i, items_2, item, result, error_2;
            if (conflictKey === void 0) { conflictKey = this.externalIdColumn; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (items.length === 0)
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
                        _i = 0, items_2 = items;
                        _a.label = 4;
                    case 4:
                        if (!(_i < items_2.length)) return [3 /*break*/, 7];
                        item = items_2[_i];
                        return [4 /*yield*/, this.upsert(item, conflictKey)];
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
                        error_2 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 10:
                        _a.sent();
                        throw error_2;
                    case 11:
                        client.release();
                        return [7 /*endfinally*/];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    return BaseRepository;
}());
exports.BaseRepository = BaseRepository;
