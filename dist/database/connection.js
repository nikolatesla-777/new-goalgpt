"use strict";
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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.safeQuery = safeQuery;
exports.connectDatabase = connectDatabase;
var pg_1 = require("pg");
var dotenv_1 = require("dotenv");
var logger_1 = require("../utils/logger");
dotenv_1.default.config();
// CRITICAL: Supabase connection configuration
var isSupabase = ((_a = process.env.DB_HOST) === null || _a === void 0 ? void 0 : _a.includes('supabase')) || ((_b = process.env.DB_HOST) === null || _b === void 0 ? void 0 : _b.includes('pooler'));
var pool = new pg_1.Pool(__assign({ host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT || '5432'), database: process.env.DB_NAME || 'goalgpt', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '', max: parseInt(process.env.DB_MAX_CONNECTIONS || '25'), min: 5, idleTimeoutMillis: 60000, connectionTimeoutMillis: 15000, 
    // CRITICAL: Keep-alive settings to prevent connection drops
    keepAlive: true, keepAliveInitialDelayMillis: 10000, 
    // CRITICAL: Statement timeout to prevent hanging queries
    statement_timeout: 30000, query_timeout: 30000, 
    // CRITICAL: Supabase requires SSL
    ssl: isSupabase
        ? {
            rejectUnauthorized: false, // Supabase uses self-signed certificates
        }
        : false }, (isSupabase && {
    application_name: 'goalgpt-backend',
})));
exports.pool = pool;
// CRITICAL: Global error handler - prevents crash on connection errors
pool.on('error', function (err, client) {
    // Log but don't crash - pool will auto-reconnect
    logger_1.logger.warn('Database pool error (non-fatal, pool will reconnect):', {
        message: err.message,
        name: err.name,
    });
    // Release the errored client if possible
    try {
        if (client) {
            client.release(true); // true = destroy client, don't return to pool
        }
    }
    catch (releaseErr) {
        // Ignore release errors
    }
});
// CRITICAL: Handle client errors before they become unhandled
pool.on('connect', function (client) {
    client.on('error', function (err) {
        logger_1.logger.warn('PostgreSQL client error (connection will be recreated):', {
            message: err.message,
        });
    });
});
// CRITICAL: Log when connections are removed from pool
pool.on('remove', function () {
    logger_1.logger.debug('PostgreSQL client removed from pool, will create new if needed');
});
/**
 * Safe query wrapper with auto-retry on connection errors
 */
function safeQuery(text_1, params_1) {
    return __awaiter(this, arguments, void 0, function (text, params, retries) {
        var lastError, _loop_1, attempt, state_1;
        var _a, _b, _c;
        if (retries === void 0) { retries = 2; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    lastError = null;
                    _loop_1 = function (attempt) {
                        var client, result, err_1, isConnectionError;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    client = null;
                                    _e.label = 1;
                                case 1:
                                    _e.trys.push([1, 4, , 6]);
                                    return [4 /*yield*/, pool.connect()];
                                case 2:
                                    client = _e.sent();
                                    return [4 /*yield*/, client.query(text, params)];
                                case 3:
                                    result = _e.sent();
                                    client.release();
                                    return [2 /*return*/, { value: result.rows }];
                                case 4:
                                    err_1 = _e.sent();
                                    lastError = err_1;
                                    // Release client with error flag (destroys connection)
                                    if (client) {
                                        try {
                                            client.release(true);
                                        }
                                        catch (releaseErr) {
                                            logger_1.logger.warn('[DB] Client release error:', releaseErr);
                                        }
                                    }
                                    isConnectionError = err_1.code === 'ECONNRESET' ||
                                        err_1.code === 'ETIMEDOUT' ||
                                        err_1.code === 'ENOTFOUND' ||
                                        ((_a = err_1.message) === null || _a === void 0 ? void 0 : _a.includes('Connection terminated')) ||
                                        ((_b = err_1.message) === null || _b === void 0 ? void 0 : _b.includes('timeout')) ||
                                        ((_c = err_1.message) === null || _c === void 0 ? void 0 : _c.includes('connect'));
                                    if (!isConnectionError || attempt === retries) {
                                        throw err_1;
                                    }
                                    logger_1.logger.warn("Database query failed (attempt ".concat(attempt + 1, "/").concat(retries + 1, "), retrying..."));
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 500 * (attempt + 1)); })];
                                case 5:
                                    _e.sent(); // Backoff
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _d.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _d.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: throw lastError;
            }
        });
    });
}
function connectDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var client, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, pool.connect()];
                case 1:
                    client = _a.sent();
                    return [4 /*yield*/, client.query('SELECT NOW()')];
                case 2:
                    result = _a.sent();
                    logger_1.logger.info('Database connection test:', result.rows[0]);
                    client.release();
                    return [2 /*return*/, true];
                case 3:
                    error_1 = _a.sent();
                    logger_1.logger.error('Database connection failed:', error_1);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
