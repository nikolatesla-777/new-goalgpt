"use strict";
/**
 * Telegram Routes - PHASE-1 HARDENED
 *
 * Fastify route definitions for Telegram publishing system
 *
 * PHASE-1 GUARANTEES:
 * 1. IDEMPOTENCY: Same match+channel can only be published once
 * 2. TRANSACTION SAFETY: DB and Telegram state cannot diverge
 * 3. STATE MACHINE: DRAFT → PUBLISHED or FAILED
 * 4. ERROR RECOVERY: Max 3 retries with exponential backoff
 * 5. OBSERVABILITY: Structured logging for all operations
 *
 * SECURITY:
 * - All endpoints require authentication
 * - Publishing requires admin role
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
exports.telegramRoutes = telegramRoutes;
var telegram_client_1 = require("../services/telegram/telegram.client");
var turkish_formatter_v2_1 = require("../services/telegram/turkish.formatter.v2");
var footystats_client_1 = require("../services/footystats/footystats.client");
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
var matchStateValidator_1 = require("../services/telegram/validators/matchStateValidator");
var matchStateFetcher_service_1 = require("../services/telegram/matchStateFetcher.service");
var pickValidator_1 = require("../services/telegram/validators/pickValidator");
var confidenceScorer_service_1 = require("../services/telegram/confidenceScorer.service");
var dailyLists_service_1 = require("../services/telegram/dailyLists.service");
// PHASE-1: Configuration constants
var MAX_RETRY_ATTEMPTS = 3;
var RETRY_BACKOFF_MS = [1000, 3000, 9000]; // Exponential backoff: 1s, 3s, 9s
/**
 * PHASE-1: Idempotency check
 * Returns existing post if match+channel already published
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
function checkExistingPost(matchId, channelId, client) {
    return __awaiter(this, void 0, void 0, function () {
        var shouldReleaseClient, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    shouldReleaseClient = !client;
                    if (!!client) return [3 /*break*/, 2];
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, client.query("SELECT id, telegram_message_id, status, retry_count\n       FROM telegram_posts\n       WHERE match_id = $1 AND channel_id = $2\n       LIMIT 1", [matchId, channelId])];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, result.rows[0] || null];
                case 4:
                    if (shouldReleaseClient) {
                        client.release();
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * PHASE-1: Create draft post in transaction
 * Reserves the idempotency slot before Telegram send
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
function createDraftPost(matchId, fsMatchId, channelId, content, client) {
    return __awaiter(this, void 0, void 0, function () {
        var shouldReleaseClient, result, err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    shouldReleaseClient = !client;
                    if (!!client) return [3 /*break*/, 2];
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 6, 8, 9]);
                    return [4 /*yield*/, client.query('BEGIN')];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, client.query("INSERT INTO telegram_posts (match_id, fs_match_id, channel_id, content, status)\n       VALUES ($1, $2, $3, $4, 'draft')\n       RETURNING id", [matchId, fsMatchId, channelId, content])];
                case 4:
                    result = _b.sent();
                    return [4 /*yield*/, client.query('COMMIT')];
                case 5:
                    _b.sent();
                    return [2 /*return*/, ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.id) || null];
                case 6:
                    err_1 = _b.sent();
                    return [4 /*yield*/, client.query('ROLLBACK')];
                case 7:
                    _b.sent();
                    throw err_1;
                case 8:
                    if (shouldReleaseClient) {
                        client.release();
                    }
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * PHASE-1: Mark post as published with message_id
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
function markPublished(postId, messageId, client) {
    return __awaiter(this, void 0, void 0, function () {
        var shouldReleaseClient;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    shouldReleaseClient = !client;
                    if (!!client) return [3 /*break*/, 2];
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, client.query("UPDATE telegram_posts\n       SET status = 'published',\n           telegram_message_id = $2,\n           posted_at = NOW()\n       WHERE id = $1", [postId, messageId])];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    if (shouldReleaseClient) {
                        client.release();
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * PHASE-1: Mark post as failed with error details
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
function markFailed(postId, error, retryCount, client) {
    return __awaiter(this, void 0, void 0, function () {
        var shouldReleaseClient;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    shouldReleaseClient = !client;
                    if (!!client) return [3 /*break*/, 2];
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, client.query("UPDATE telegram_posts\n       SET status = 'failed',\n           error_log = $2,\n           last_error_at = NOW(),\n           retry_count = $3\n       WHERE id = $1", [postId, error, retryCount])];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    if (shouldReleaseClient) {
                        client.release();
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * PHASE-1: Retry logic with exponential backoff
 * Attempts Telegram send up to MAX_RETRY_ATTEMPTS times
 *
 * FIX: Accepts optional client parameter, NO connection held during Telegram API call
 */
function sendWithRetry(channelId, messageText, postId, client) {
    return __awaiter(this, void 0, void 0, function () {
        var lastError, _loop_1, attempt, state_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lastError = null;
                    _loop_1 = function (attempt) {
                        var result, err_2, shouldReleaseClient, updateClient, backoffMs_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 10]);
                                    logger_1.logger.info("[Telegram] Send attempt ".concat(attempt + 1, "/").concat(MAX_RETRY_ATTEMPTS, " for post ").concat(postId));
                                    return [4 /*yield*/, telegram_client_1.telegramBot.sendMessage({
                                            chat_id: channelId,
                                            text: messageText,
                                            parse_mode: 'HTML',
                                            disable_web_page_preview: true,
                                        })];
                                case 1:
                                    result = _b.sent();
                                    if (!result.ok) {
                                        throw new Error("Telegram API returned ok=false: ".concat(JSON.stringify(result)));
                                    }
                                    logger_1.logger.info("[Telegram] \u2705 Send successful on attempt ".concat(attempt + 1, " for post ").concat(postId));
                                    return [2 /*return*/, { value: result.result.message_id }];
                                case 2:
                                    err_2 = _b.sent();
                                    lastError = err_2;
                                    logger_1.logger.warn("[Telegram] \u26A0\uFE0F Send failed attempt ".concat(attempt + 1, "/").concat(MAX_RETRY_ATTEMPTS, ":"), {
                                        post_id: postId,
                                        error: err_2.message,
                                        attempt: attempt + 1,
                                    });
                                    shouldReleaseClient = !client;
                                    updateClient = client;
                                    if (!!updateClient) return [3 /*break*/, 4];
                                    return [4 /*yield*/, connection_1.pool.connect()];
                                case 3:
                                    updateClient = _b.sent();
                                    _b.label = 4;
                                case 4:
                                    _b.trys.push([4, , 6, 7]);
                                    return [4 /*yield*/, updateClient.query("UPDATE telegram_posts\n           SET retry_count = $1,\n               error_log = $2,\n               last_error_at = NOW()\n           WHERE id = $3", [attempt + 1, err_2.message, postId])];
                                case 5:
                                    _b.sent();
                                    return [3 /*break*/, 7];
                                case 6:
                                    if (shouldReleaseClient) {
                                        updateClient.release();
                                    }
                                    return [7 /*endfinally*/];
                                case 7:
                                    if (!(attempt < MAX_RETRY_ATTEMPTS - 1)) return [3 /*break*/, 9];
                                    backoffMs_1 = RETRY_BACKOFF_MS[attempt];
                                    logger_1.logger.info("[Telegram] Waiting ".concat(backoffMs_1, "ms before retry..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, backoffMs_1); })];
                                case 8:
                                    _b.sent();
                                    _b.label = 9;
                                case 9: return [3 /*break*/, 10];
                                case 10: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < MAX_RETRY_ATTEMPTS)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    // All retries exhausted
                    logger_1.logger.error("[Telegram] \u274C All ".concat(MAX_RETRY_ATTEMPTS, " retry attempts exhausted for post ").concat(postId));
                    throw lastError || new Error('Send failed after max retries');
            }
        });
    });
}
function telegramRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        /**
         * Get live scores for multiple matches (bulk query)
         */
        function getLiveScoresForMatches(matches) {
            return __awaiter(this, void 0, void 0, function () {
                var liveScores, conditions_1, params_1, paramIndex_1, query, results, err_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            liveScores = new Map();
                            if (matches.length === 0)
                                return [2 /*return*/, liveScores];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            conditions_1 = [];
                            params_1 = [];
                            paramIndex_1 = 1;
                            matches.forEach(function (match) {
                                var homeFirstWord = match.home_name.split(' ')[0].toLowerCase();
                                var awayFirstWord = match.away_name.split(' ')[0].toLowerCase();
                                var timeWindow = 3600; // +/- 1 hour
                                conditions_1.push("(\n          (LOWER(t1.name) LIKE $".concat(paramIndex_1, " OR LOWER(t1.name) LIKE $").concat(paramIndex_1 + 1, ")\n          AND (LOWER(t2.name) LIKE $").concat(paramIndex_1 + 2, " OR LOWER(t2.name) LIKE $").concat(paramIndex_1 + 3, ")\n          AND m.match_time >= $").concat(paramIndex_1 + 4, "\n          AND m.match_time <= $").concat(paramIndex_1 + 5, "\n        )"));
                                params_1.push("%".concat(homeFirstWord, "%"), "".concat(homeFirstWord, "%"), "%".concat(awayFirstWord, "%"), "".concat(awayFirstWord, "%"), match.date_unix - timeWindow, match.date_unix + timeWindow);
                                paramIndex_1 += 6;
                            });
                            query = "\n        SELECT\n          m.home_score_display, m.away_score_display, m.status_id,\n          m.current_time, m.match_time,\n          t1.name as home_team_name, t2.name as away_team_name\n        FROM ts_matches m\n        INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id::varchar\n        INNER JOIN ts_teams t2 ON m.away_team_id = t2.external_id::varchar\n        WHERE m.status_id IN (2, 3, 4, 5, 7, 8)\n          AND (".concat(conditions_1.join(' OR '), ")\n      ");
                            return [4 /*yield*/, (0, connection_1.safeQuery)(query, params_1)];
                        case 2:
                            results = _a.sent();
                            // Match results back to FootyStats matches
                            results.forEach(function (row) {
                                var matchingFsMatch = matches.find(function (m) {
                                    var homeFirstWord = m.home_name.split(' ')[0].toLowerCase();
                                    var awayFirstWord = m.away_name.split(' ')[0].toLowerCase();
                                    return (row.home_team_name.toLowerCase().includes(homeFirstWord) &&
                                        row.away_team_name.toLowerCase().includes(awayFirstWord) &&
                                        Math.abs(row.match_time - m.date_unix) <= 3600);
                                });
                                if (matchingFsMatch) {
                                    var statusMap = {
                                        2: 'İlk Yarı',
                                        3: 'Devre Arası',
                                        4: 'İkinci Yarı',
                                        5: 'Uzatma',
                                        7: 'Penaltılar',
                                        8: 'Bitti',
                                    };
                                    liveScores.set(matchingFsMatch.fs_id, {
                                        home: parseInt(row.home_score_display) || 0,
                                        away: parseInt(row.away_score_display) || 0,
                                        minute: row.current_time || '',
                                        status: statusMap[row.status_id] || 'Canlı',
                                    });
                                }
                            });
                            logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCFA Found live scores for ".concat(liveScores.size, "/").concat(matches.length, " matches"));
                            return [3 /*break*/, 4];
                        case 3:
                            err_3 = _a.sent();
                            logger_1.logger.error('[TelegramDailyLists] Error fetching live scores:', err_3);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/, liveScores];
                    }
                });
            });
        }
        /**
         * Calculate performance for a daily list (check finished matches)
         */
        function calculateListPerformance(list) {
            return __awaiter(this, void 0, void 0, function () {
                var now, won, lost, pending, _i, _a, candidate, match, marketType, matchFinished, homeFirstWord, awayFirstWord, timeWindow, result, homeScore, awayScore, totalGoals, isWin, homeScores, awayScores, htHomeScore, htAwayScore, htTotalGoals, err_4, total, settled, win_rate;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            now = Math.floor(Date.now() / 1000);
                            won = 0;
                            lost = 0;
                            pending = 0;
                            _i = 0, _a = list.matches;
                            _d.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            candidate = _a[_i];
                            match = candidate.match;
                            marketType = list.market;
                            matchFinished = match.date_unix <= (now - 2 * 60 * 60);
                            if (!matchFinished) {
                                pending++;
                                return [3 /*break*/, 5];
                            }
                            _d.label = 2;
                        case 2:
                            _d.trys.push([2, 4, , 5]);
                            homeFirstWord = match.home_name.split(' ')[0].toLowerCase();
                            awayFirstWord = match.away_name.split(' ')[0].toLowerCase();
                            timeWindow = 3600;
                            return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT m.home_score_display, m.away_score_display, m.status_id,\n                  m.home_scores, m.away_scores,\n                  t1.name as home_team_name, t2.name as away_team_name\n           FROM ts_matches m\n           INNER JOIN ts_teams t1 ON m.home_team_id = t1.external_id::varchar\n           INNER JOIN ts_teams t2 ON m.away_team_id = t2.external_id::varchar\n           WHERE (LOWER(t1.name) LIKE $1 OR LOWER(t1.name) LIKE $2)\n             AND (LOWER(t2.name) LIKE $3 OR LOWER(t2.name) LIKE $4)\n             AND m.match_time >= $5\n             AND m.match_time <= $6\n             AND m.status_id = 8\n           LIMIT 1", [
                                    "%".concat(homeFirstWord, "%"),
                                    "".concat(homeFirstWord, "%"),
                                    "%".concat(awayFirstWord, "%"),
                                    "".concat(awayFirstWord, "%"),
                                    match.date_unix - timeWindow,
                                    match.date_unix + timeWindow
                                ])];
                        case 3:
                            result = _d.sent();
                            if (result.length === 0) {
                                pending++; // No result yet or not finished
                                return [3 /*break*/, 5];
                            }
                            homeScore = parseInt(result[0].home_score_display) || 0;
                            awayScore = parseInt(result[0].away_score_display) || 0;
                            totalGoals = homeScore + awayScore;
                            logger_1.logger.info("[TelegramDailyLists] Match found: ".concat(result[0].home_team_name, " ").concat(homeScore, "-").concat(awayScore, " ").concat(result[0].away_team_name), {
                                fs_id: match.fs_id,
                                footystats_teams: "".concat(match.home_name, " vs ").concat(match.away_name),
                                thesports_teams: "".concat(result[0].home_team_name, " vs ").concat(result[0].away_team_name),
                            });
                            isWin = false;
                            switch (marketType) {
                                case 'OVER_25':
                                    isWin = totalGoals >= 3;
                                    break;
                                case 'OVER_15':
                                    isWin = totalGoals >= 2;
                                    break;
                                case 'BTTS':
                                    isWin = homeScore > 0 && awayScore > 0;
                                    break;
                                case 'HT_OVER_05':
                                    // Extract HT score from JSON arrays
                                    try {
                                        homeScores = JSON.parse(result[0].home_scores || '[]');
                                        awayScores = JSON.parse(result[0].away_scores || '[]');
                                        htHomeScore = ((_b = homeScores[0]) === null || _b === void 0 ? void 0 : _b.score) || 0;
                                        htAwayScore = ((_c = awayScores[0]) === null || _c === void 0 ? void 0 : _c.score) || 0;
                                        htTotalGoals = htHomeScore + htAwayScore;
                                        isWin = htTotalGoals >= 1;
                                        logger_1.logger.info("[TelegramDailyLists] HT Score: ".concat(htHomeScore, "-").concat(htAwayScore, ", Result: ").concat(isWin ? 'WON' : 'LOST'), {
                                            fs_id: match.fs_id,
                                        });
                                    }
                                    catch (err) {
                                        logger_1.logger.warn('[TelegramDailyLists] Failed to parse HT scores, marking as pending', { fs_id: match.fs_id });
                                        pending++;
                                        return [3 /*break*/, 5];
                                    }
                                    break;
                                case 'CORNERS':
                                case 'CARDS':
                                    // Would need detailed stats, skip for now
                                    pending++;
                                    return [3 /*break*/, 5];
                            }
                            if (isWin) {
                                won++;
                            }
                            else {
                                lost++;
                            }
                            return [3 /*break*/, 5];
                        case 4:
                            err_4 = _d.sent();
                            logger_1.logger.error('[TelegramDailyLists] Error checking match result:', err_4);
                            pending++;
                            return [3 /*break*/, 5];
                        case 5:
                            _i++;
                            return [3 /*break*/, 1];
                        case 6:
                            total = list.matches.length;
                            settled = won + lost;
                            win_rate = settled > 0 ? Math.round((won / settled) * 100) : 0;
                            return [2 /*return*/, { total: total, won: won, lost: lost, pending: pending, win_rate: win_rate }];
                    }
                });
            });
        }
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * GET /telegram/health
             * Health check for Telegram bot
             */
            fastify.get('/telegram/health', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var health;
                return __generator(this, function (_a) {
                    health = telegram_client_1.telegramBot.getHealth();
                    // PHASE-1: Add retry config to health response
                    return [2 /*return*/, __assign(__assign({}, health), { retry_config: {
                                max_attempts: MAX_RETRY_ATTEMPTS,
                                backoff_ms: RETRY_BACKOFF_MS,
                            } })];
                });
            }); });
            /**
             * POST /telegram/publish/match/:fsMatchId
             * Publish a match to Telegram channel
             *
             * PHASE-1 GUARANTEES:
             * - Idempotent: Duplicate publishes return existing data
             * - Transactional: DB state matches Telegram state
             * - Resilient: Retries on failures
             * - Observable: Structured logs at every step
             */
            fastify.post('/telegram/publish/match/:fsMatchId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var startTime, fsMatchId, _a, match_id, _b, picks, logContext, channelId, pickValidation, matchStatusId, stateSource, isFootyStatsPlaceholder, matchStateResult, stateValidation, fetchError_1, fsIdNum, matchResponse, fsMatch, homeStats, awayStats, homeResponse, err_5, awayResponse, err_6, leagueName, leagueResult, leagueErr_1, matchData, confidenceScore, messageText, dbClient, postId, racedPost, telegramMessageId, err_7, picksClient, _i, picks_1, pick, elapsedMs, error_1, elapsedMs;
                var _c, _d, _e, _f, _g, _h, _j, _k, _l;
                return __generator(this, function (_m) {
                    switch (_m.label) {
                        case 0:
                            startTime = Date.now();
                            fsMatchId = request.params.fsMatchId;
                            _a = request.body, match_id = _a.match_id, _b = _a.picks, picks = _b === void 0 ? [] : _b;
                            logContext = {
                                fs_match_id: fsMatchId,
                                match_id: match_id,
                                picks_count: picks.length,
                            };
                            // 🔍 DIAGNOSTIC: Route tracking
                            logger_1.logger.info('[Telegram] 🔍 ROUTE DIAGNOSTIC', __assign(__assign({}, logContext), { route: 'POST /telegram/publish/match/:fsMatchId', user_agent: request.headers['user-agent'], referer: request.headers['referer'], origin: request.headers['origin'], body: request.body }));
                            logger_1.logger.info('[Telegram] 📤 Publish request received', logContext);
                            _m.label = 1;
                        case 1:
                            _m.trys.push([1, 41, , 42]);
                            // 1. Validate required fields
                            if (!match_id) {
                                logger_1.logger.warn('[Telegram] ❌ Validation failed: match_id missing', logContext);
                                return [2 /*return*/, reply.status(400).send({ error: 'match_id (TheSports external_id) is required in body' })];
                            }
                            // 2. Check bot configuration
                            if (!telegram_client_1.telegramBot.isConfigured()) {
                                logger_1.logger.error('[Telegram] ❌ Bot not configured', logContext);
                                return [2 /*return*/, reply.status(503).send({ error: 'Telegram bot not configured' })];
                            }
                            channelId = process.env.TELEGRAM_CHANNEL_ID || '';
                            if (!channelId) {
                                logger_1.logger.error('[Telegram] ❌ Channel ID not set', logContext);
                                return [2 /*return*/, reply.status(503).send({ error: 'TELEGRAM_CHANNEL_ID not set' })];
                            }
                            // 3. PHASE-1: IDEMPOTENCY CHECK - DISABLED (User wants to publish same match multiple times)
                            // Note: User requested ability to publish same match as many times as desired
                            logger_1.logger.info('[Telegram] ⚠️ IDEMPOTENCY CHECK DISABLED - allowing duplicate publishes', logContext);
                            // 4. PHASE-2A: PICK VALIDATION
                            logger_1.logger.info('[Telegram] 🔍 Validating picks...', logContext);
                            pickValidation = (0, pickValidator_1.validatePicks)(picks);
                            if (!pickValidation.valid) {
                                logger_1.logger.warn('[Telegram] ❌ Pick validation failed', __assign(__assign({}, logContext), { error: pickValidation.error, invalid_picks: pickValidation.invalidPicks }));
                                return [2 /*return*/, reply.status(400).send({
                                        error: 'Invalid picks',
                                        details: pickValidation.error,
                                        invalid_picks: pickValidation.invalidPicks,
                                        supported_markets: ['BTTS_YES', 'O25_OVER', 'O15_OVER', 'HT_O05_OVER'],
                                    })];
                            }
                            logger_1.logger.info('[Telegram] ✅ Picks validated', logContext);
                            // 5. PHASE-2B-B1: MATCH STATE VALIDATION WITH API PRIMARY (OPTIONAL FOR FOOTYSTATS)
                            // PRIMARY: TheSports API (real-time status)
                            // FALLBACK: Database (stale but reliable)
                            // TEMPORARY FIX: Skip validation for FootyStats placeholder IDs (fs_*)
                            logger_1.logger.info('[Telegram] 🔍 Fetching match state (API primary)...', logContext);
                            matchStatusId = null;
                            stateSource = 'unknown';
                            isFootyStatsPlaceholder = match_id.startsWith('fs_');
                            if (!isFootyStatsPlaceholder) return [3 /*break*/, 2];
                            logger_1.logger.warn('[Telegram] ⚠️ Skipping match state validation (FootyStats placeholder ID)', logContext);
                            matchStatusId = 1; // Assume NOT_STARTED
                            stateSource = 'placeholder';
                            return [3 /*break*/, 5];
                        case 2:
                            _m.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, (0, matchStateFetcher_service_1.fetchMatchStateForPublish)(match_id)];
                        case 3:
                            matchStateResult = _m.sent();
                            matchStatusId = matchStateResult.statusId;
                            stateSource = matchStateResult.source;
                            logContext.match_status_id = matchStatusId;
                            logContext.state_source = stateSource;
                            logContext.state_latency_ms = matchStateResult.latencyMs;
                            logContext.state_cached = matchStateResult.cached;
                            // Log fallback usage for monitoring
                            if (matchStateResult.isFallback) {
                                logger_1.logger.warn('[Telegram] ⚠️ Using DB fallback for match state', logContext);
                            }
                            else {
                                logger_1.logger.info('[Telegram] ✅ Match state fetched from API', logContext);
                            }
                            stateValidation = (0, matchStateValidator_1.validateMatchStateForPublish)(matchStatusId, match_id);
                            if (!stateValidation.valid) {
                                logger_1.logger.warn('[Telegram] ❌ Match state validation failed', __assign(__assign({}, logContext), { error: stateValidation.error, error_code: stateValidation.errorCode }));
                                return [2 /*return*/, reply.status(400).send({
                                        error: 'Invalid match state',
                                        details: stateValidation.error,
                                        error_code: stateValidation.errorCode,
                                        match_status_id: matchStatusId,
                                        state_source: stateSource,
                                    })];
                            }
                            logger_1.logger.info('[Telegram] ✅ Match state validated (NOT_STARTED)', logContext);
                            return [3 /*break*/, 5];
                        case 4:
                            fetchError_1 = _m.sent();
                            // Both API and DB failed - cannot proceed
                            logger_1.logger.error('[Telegram] ❌ Failed to fetch match state (API + DB failed)', __assign(__assign({}, logContext), { error: fetchError_1 instanceof Error ? fetchError_1.message : String(fetchError_1) }));
                            return [2 /*return*/, reply.status(503).send({
                                    error: 'Service temporarily unavailable',
                                    details: 'Unable to verify match state. Please try again later.',
                                    error_code: 'MATCH_STATE_UNAVAILABLE',
                                })];
                        case 5:
                            // 6. Fetch match data from FootyStats
                            logger_1.logger.info('[Telegram] 📊 Fetching match data from FootyStats...', logContext);
                            fsIdNum = parseInt(fsMatchId);
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getMatchDetails(fsIdNum)];
                        case 6:
                            matchResponse = _m.sent();
                            fsMatch = matchResponse.data;
                            if (!fsMatch) {
                                logger_1.logger.error('[Telegram] ❌ Match not found in FootyStats', logContext);
                                return [2 /*return*/, reply.status(404).send({ error: 'Match not found in FootyStats' })];
                            }
                            // 🔍 DEBUG: Check if corners/cards potentials exist
                            logger_1.logger.info('[Telegram] 🔍 fsMatch potentials check:', __assign(__assign({}, logContext), { has_corners: !!fsMatch.corners_potential, has_cards: !!fsMatch.cards_potential, corners_value: fsMatch.corners_potential, cards_value: fsMatch.cards_potential, btts_value: fsMatch.btts_potential, over25_value: fsMatch.o25_potential }));
                            homeStats = null;
                            awayStats = null;
                            if (!fsMatch.homeID) return [3 /*break*/, 10];
                            _m.label = 7;
                        case 7:
                            _m.trys.push([7, 9, , 10]);
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTeamLastX(fsMatch.homeID)];
                        case 8:
                            homeResponse = _m.sent();
                            homeStats = (_c = homeResponse.data) === null || _c === void 0 ? void 0 : _c[0];
                            return [3 /*break*/, 10];
                        case 9:
                            err_5 = _m.sent();
                            logger_1.logger.error('[Telegram] Error fetching home team stats', __assign(__assign({}, logContext), { error: err_5.message }));
                            return [3 /*break*/, 10];
                        case 10:
                            if (!fsMatch.awayID) return [3 /*break*/, 14];
                            _m.label = 11;
                        case 11:
                            _m.trys.push([11, 13, , 14]);
                            return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTeamLastX(fsMatch.awayID)];
                        case 12:
                            awayResponse = _m.sent();
                            awayStats = (_d = awayResponse.data) === null || _d === void 0 ? void 0 : _d[0];
                            return [3 /*break*/, 14];
                        case 13:
                            err_6 = _m.sent();
                            logger_1.logger.error('[Telegram] Error fetching away team stats', __assign(__assign({}, logContext), { error: err_6.message }));
                            return [3 /*break*/, 14];
                        case 14:
                            leagueName = 'Unknown';
                            _m.label = 15;
                        case 15:
                            _m.trys.push([15, 17, , 18]);
                            logger_1.logger.info('[Telegram] 🔍 Fetching league name from DB...', __assign(__assign({}, logContext), { match_id: match_id }));
                            return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT c.name\n             FROM ts_matches m\n             JOIN ts_competitions c ON c.id = m.competition_id\n             WHERE m.external_id = $1\n             LIMIT 1", [match_id])];
                        case 16:
                            leagueResult = _m.sent();
                            logger_1.logger.info('[Telegram] 📊 League query result:', __assign(__assign({}, logContext), { rows_found: leagueResult.length, league_name: ((_e = leagueResult[0]) === null || _e === void 0 ? void 0 : _e.name) || null }));
                            if (leagueResult.length > 0 && leagueResult[0].name) {
                                leagueName = leagueResult[0].name;
                                logger_1.logger.info('[Telegram] ✅ League name found', __assign(__assign({}, logContext), { league_name: leagueName }));
                            }
                            else {
                                logger_1.logger.warn('[Telegram] ⚠️ No league found in DB for match', __assign(__assign({}, logContext), { match_id: match_id }));
                            }
                            return [3 /*break*/, 18];
                        case 17:
                            leagueErr_1 = _m.sent();
                            logger_1.logger.error('[Telegram] ❌ Error fetching league name from DB', __assign(__assign({}, logContext), { error: leagueErr_1 instanceof Error ? leagueErr_1.message : String(leagueErr_1) }));
                            return [3 /*break*/, 18];
                        case 18:
                            // 9. Build message data
                            logger_1.logger.info('[Telegram] 📊 Team stats loaded', __assign(__assign({}, logContext), { has_home_stats: !!homeStats, has_away_stats: !!awayStats }));
                            // 🔍 DEBUG: Log fsMatch corners and cards
                            console.error('\n🔍🔍🔍 [Telegram Publish] fsMatch data check:');
                            console.error('  fsMatch.corners_potential:', fsMatch.corners_potential);
                            console.error('  fsMatch.cards_potential:', fsMatch.cards_potential);
                            console.error('  fsMatch.btts_potential:', fsMatch.btts_potential);
                            console.error('  typeof corners:', typeof fsMatch.corners_potential);
                            console.error('  typeof cards:', typeof fsMatch.cards_potential);
                            matchData = {
                                home_name: fsMatch.home_name,
                                away_name: fsMatch.away_name,
                                league_name: leagueName,
                                date_unix: fsMatch.date_unix,
                                potentials: {
                                    btts: fsMatch.btts_potential,
                                    over25: fsMatch.o25_potential,
                                    over15: fsMatch.o15_potential,
                                    corners: fsMatch.corners_potential, // ✅ ADD: Match-level corner expectation
                                    cards: fsMatch.cards_potential, // ✅ ADD: Match-level card expectation
                                },
                                xg: {
                                    home: fsMatch.team_a_xg_prematch,
                                    away: fsMatch.team_b_xg_prematch,
                                },
                                form: {
                                    home: homeStats ? {
                                        ppg: homeStats.seasonPPG_overall,
                                        btts_pct: homeStats.seasonBTTSPercentage_overall,
                                        over25_pct: homeStats.seasonOver25Percentage_overall,
                                        corners_avg: homeStats.cornersAVG_overall,
                                        cards_avg: homeStats.cardsAVG_overall,
                                    } : null,
                                    away: awayStats ? {
                                        ppg: awayStats.seasonPPG_overall,
                                        btts_pct: awayStats.seasonBTTSPercentage_overall,
                                        over25_pct: awayStats.seasonOver25Percentage_overall,
                                        corners_avg: awayStats.cornersAVG_overall,
                                        cards_avg: awayStats.cardsAVG_overall,
                                    } : null,
                                },
                                h2h: fsMatch.h2h ? {
                                    total_matches: (_f = fsMatch.h2h.previous_matches_results) === null || _f === void 0 ? void 0 : _f.totalMatches,
                                    home_wins: (_g = fsMatch.h2h.previous_matches_results) === null || _g === void 0 ? void 0 : _g.team_a_wins,
                                    draws: (_h = fsMatch.h2h.previous_matches_results) === null || _h === void 0 ? void 0 : _h.draw,
                                    away_wins: (_j = fsMatch.h2h.previous_matches_results) === null || _j === void 0 ? void 0 : _j.team_b_wins,
                                    avg_goals: (_k = fsMatch.h2h.betting_stats) === null || _k === void 0 ? void 0 : _k.avg_goals,
                                    btts_pct: (_l = fsMatch.h2h.betting_stats) === null || _l === void 0 ? void 0 : _l.bttsPercentage,
                                } : null,
                                trends: fsMatch.trends,
                                odds: {
                                    home: fsMatch.odds_ft_1,
                                    draw: fsMatch.odds_ft_x,
                                    away: fsMatch.odds_ft_2,
                                },
                            };
                            // 🔍 DEBUG: Verify matchData.potentials has corners and cards
                            console.error('\n🔍🔍🔍 [Telegram Publish] matchData.potentials check:');
                            console.error('  matchData.potentials.corners:', matchData.potentials.corners);
                            console.error('  matchData.potentials.cards:', matchData.potentials.cards);
                            console.error('  matchData.potentials.btts:', matchData.potentials.btts);
                            console.error('  Full potentials:', JSON.stringify(matchData.potentials, null, 2));
                            // PHASE-2B: Calculate confidence score
                            logger_1.logger.info('[Telegram] 🎯 Calculating confidence score...', logContext);
                            confidenceScore = (0, confidenceScorer_service_1.calculateConfidenceScore)(fsMatch, homeStats, awayStats);
                            logContext.confidence_score = confidenceScore.score;
                            logContext.confidence_tier = confidenceScore.tier;
                            logContext.missing_count = confidenceScore.missingCount;
                            logger_1.logger.info('[Telegram] ✅ Confidence score calculated', __assign(__assign({}, logContext), { score: confidenceScore.score, tier: confidenceScore.tier, stars: confidenceScore.stars }));
                            // 🔍 DEBUG: Log matchData.potentials before formatting
                            console.error('\n🔍🔍🔍 [TELEGRAM DEBUG] matchData.potentials:', JSON.stringify(matchData.potentials, null, 2));
                            logger_1.logger.info('[Telegram] 🔍 matchData.potentials:', __assign(__assign({}, logContext), { potentials: matchData.potentials }));
                            messageText = (0, turkish_formatter_v2_1.formatTelegramMessageV2)(matchData, picks, confidenceScore);
                            // 🔍 DIAGNOSTIC: Formatter tracking
                            logger_1.logger.info('[Telegram] 🔍 FORMATTER DIAGNOSTIC', __assign(__assign({}, logContext), { formatter: 'formatTelegramMessageV2', template_version: 'V2-KART-KORNER-ENABLED', message_length: messageText.length, message_preview: messageText.substring(0, 200), has_kart: messageText.includes('🟨'), has_korner: messageText.includes('🚩') }));
                            // 🔍 DEBUG: Check if KART/KORNER sections are in message
                            console.error('🔍🔍🔍 [TELEGRAM DEBUG] Message has KART:', messageText.includes('KART'));
                            console.error('🔍🔍🔍 [TELEGRAM DEBUG] Message has KORNER:', messageText.includes('KORNER'));
                            // 🔍 DEBUG: Check formatted message
                            console.log('\n' + '='.repeat(80));
                            console.log('[TELEGRAM DEBUG] formatTelegramMessage RESULT:');
                            console.log('Match:', matchData.home_name, 'vs', matchData.away_name);
                            console.log('Message Length:', messageText.length, 'chars');
                            console.log('Has Trends:', messageText.includes('Trendler'));
                            console.log('Has Ev:', messageText.includes('Trendler (Ev)'));
                            console.log('Has Dep:', messageText.includes('Trendler (Dep)'));
                            console.log('\nFULL MESSAGE:');
                            console.log(messageText);
                            console.log('='.repeat(80) + '\n');
                            // 9. PHASE-1: TRANSACTION SAFETY - Create DRAFT post first
                            // FIX: Acquire connection for draft post, release BEFORE Telegram API call
                            logger_1.logger.info('[Telegram] 💾 Creating DRAFT post...', logContext);
                            return [4 /*yield*/, connection_1.pool.connect()];
                        case 19:
                            dbClient = _m.sent();
                            postId = void 0;
                            _m.label = 20;
                        case 20:
                            _m.trys.push([20, , 24, 25]);
                            return [4 /*yield*/, createDraftPost(match_id, fsIdNum, channelId, messageText, dbClient)];
                        case 21:
                            postId = _m.sent();
                            if (!!postId) return [3 /*break*/, 23];
                            // ON CONFLICT DO NOTHING triggered - race condition detected
                            logger_1.logger.warn('[Telegram] ⚠️ Race condition detected: Another request already created this post', logContext);
                            return [4 /*yield*/, checkExistingPost(match_id, channelId, dbClient)];
                        case 22:
                            racedPost = _m.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    telegram_message_id: racedPost === null || racedPost === void 0 ? void 0 : racedPost.telegram_message_id,
                                    post_id: racedPost === null || racedPost === void 0 ? void 0 : racedPost.id,
                                    status: racedPost === null || racedPost === void 0 ? void 0 : racedPost.status,
                                    idempotent: true,
                                    message: 'Race condition: Post created by concurrent request',
                                }];
                        case 23: return [3 /*break*/, 25];
                        case 24:
                            // FIX: Release connection BEFORE Telegram API call
                            dbClient.release();
                            dbClient = null;
                            return [7 /*endfinally*/];
                        case 25:
                            logger_1.logger.info('[Telegram] ✅ DRAFT post created', __assign(__assign({}, logContext), { post_id: postId }));
                            // 10. PHASE-1: ERROR RECOVERY - Send to Telegram with retry
                            // FIX: NO connection held during Telegram API call
                            logger_1.logger.info('[Telegram] 📡 Sending to Telegram with retry logic...', __assign(__assign({}, logContext), { post_id: postId }));
                            telegramMessageId = void 0;
                            _m.label = 26;
                        case 26:
                            _m.trys.push([26, 28, , 30]);
                            return [4 /*yield*/, sendWithRetry(channelId, messageText, postId)];
                        case 27:
                            // FIX: sendWithRetry does NOT hold connection during Telegram send
                            telegramMessageId = _m.sent();
                            return [3 /*break*/, 30];
                        case 28:
                            err_7 = _m.sent();
                            // All retries exhausted - mark as FAILED
                            logger_1.logger.error('[Telegram] ❌ Send failed after all retries, marking as FAILED', __assign(__assign({}, logContext), { post_id: postId, error: err_7.message }));
                            // FIX: Acquire NEW connection for markFailed
                            return [4 /*yield*/, markFailed(postId, err_7.message, MAX_RETRY_ATTEMPTS)];
                        case 29:
                            // FIX: Acquire NEW connection for markFailed
                            _m.sent();
                            return [2 /*return*/, reply.status(500).send({
                                    error: 'Failed to send to Telegram after retries',
                                    post_id: postId,
                                    status: 'failed',
                                    retry_count: MAX_RETRY_ATTEMPTS,
                                })];
                        case 30:
                            // 11. PHASE-1: STATE TRANSITION - Mark as PUBLISHED
                            // FIX: Acquire NEW connection for markPublished
                            logger_1.logger.info('[Telegram] ✅ Marking post as PUBLISHED', __assign(__assign({}, logContext), { post_id: postId, telegram_message_id: telegramMessageId }));
                            return [4 /*yield*/, markPublished(postId, telegramMessageId)];
                        case 31:
                            _m.sent();
                            if (!(picks.length > 0)) return [3 /*break*/, 40];
                            logger_1.logger.info("[Telegram] \uD83D\uDCBE Saving ".concat(picks.length, " picks..."), __assign(__assign({}, logContext), { post_id: postId }));
                            return [4 /*yield*/, connection_1.pool.connect()];
                        case 32:
                            picksClient = _m.sent();
                            _m.label = 33;
                        case 33:
                            _m.trys.push([33, , 38, 39]);
                            _i = 0, picks_1 = picks;
                            _m.label = 34;
                        case 34:
                            if (!(_i < picks_1.length)) return [3 /*break*/, 37];
                            pick = picks_1[_i];
                            return [4 /*yield*/, picksClient.query("INSERT INTO telegram_picks (post_id, market_type, odds, status)\n                 VALUES ($1, $2, $3, 'pending')", [postId, pick.market_type, pick.odds || null])];
                        case 35:
                            _m.sent();
                            _m.label = 36;
                        case 36:
                            _i++;
                            return [3 /*break*/, 34];
                        case 37: return [3 /*break*/, 39];
                        case 38:
                            picksClient.release();
                            return [7 /*endfinally*/];
                        case 39:
                            logger_1.logger.info('[Telegram] ✅ Picks saved', __assign(__assign({}, logContext), { post_id: postId }));
                            _m.label = 40;
                        case 40:
                            elapsedMs = Date.now() - startTime;
                            logger_1.logger.info('[Telegram] ✅ PUBLISH COMPLETE', __assign(__assign({}, logContext), { post_id: postId, telegram_message_id: telegramMessageId, elapsed_ms: elapsedMs, status: 'published' }));
                            return [2 /*return*/, {
                                    success: true,
                                    telegram_message_id: telegramMessageId,
                                    post_id: postId,
                                    picks_count: picks.length,
                                    status: 'published',
                                    elapsed_ms: elapsedMs,
                                }];
                        case 41:
                            error_1 = _m.sent();
                            elapsedMs = Date.now() - startTime;
                            logger_1.logger.error('[Telegram] ❌ PUBLISH ERROR', __assign(__assign({}, logContext), { error: error_1.message, stack: error_1.stack, elapsed_ms: elapsedMs }));
                            return [2 /*return*/, reply.status(500).send({ error: error_1.message })];
                        case 42: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /telegram/posts
             * Get published posts with pick statistics
             *
             * FIX: Acquire connection, execute query, release immediately
             */
            fastify.get('/telegram/posts', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var client, result, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, connection_1.pool.connect()];
                        case 1:
                            client = _a.sent();
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, 5, 6]);
                            return [4 /*yield*/, client.query("SELECT p.*,\n                COUNT(pk.id) as picks_count,\n                COUNT(CASE WHEN pk.status = 'won' THEN 1 END) as won_count,\n                COUNT(CASE WHEN pk.status = 'lost' THEN 1 END) as lost_count,\n                COUNT(CASE WHEN pk.status = 'void' THEN 1 END) as void_count\n         FROM telegram_posts p\n         LEFT JOIN telegram_picks pk ON pk.post_id = p.id\n         WHERE p.status IN ('published', 'settled')\n         GROUP BY p.id\n         ORDER BY p.posted_at DESC\n         LIMIT 100")];
                        case 3:
                            result = _a.sent();
                            return [2 /*return*/, { success: true, posts: result.rows }];
                        case 4:
                            error_2 = _a.sent();
                            logger_1.logger.error('[Telegram] Error fetching posts:', error_2);
                            return [2 /*return*/, reply.status(500).send({ error: error_2.message })];
                        case 5:
                            client.release();
                            return [7 /*endfinally*/];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /telegram/daily-lists/today
             * Get today's generated daily lists (preview without publishing)
             */
            fastify.get('/telegram/daily-lists/today', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var lists, allMatches_1, liveScoresMap_1, formattedLists, error_3;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            logger_1.logger.info('[TelegramDailyLists] 📊 Fetching today\'s lists...');
                            return [4 /*yield*/, (0, dailyLists_service_1.getDailyLists)()];
                        case 1:
                            lists = _a.sent();
                            if (lists.length === 0) {
                                return [2 /*return*/, {
                                        success: true,
                                        lists_count: 0,
                                        lists: [],
                                        message: 'No eligible matches found for today',
                                    }];
                            }
                            allMatches_1 = new Map();
                            lists.forEach(function (list) {
                                list.matches.forEach(function (m) {
                                    allMatches_1.set(m.match.fs_id, m.match);
                                });
                            });
                            return [4 /*yield*/, getLiveScoresForMatches(Array.from(allMatches_1.values()))];
                        case 2:
                            liveScoresMap_1 = _a.sent();
                            return [4 /*yield*/, Promise.all(lists.map(function (list) { return __awaiter(_this, void 0, void 0, function () {
                                    var performance;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, calculateListPerformance(list)];
                                            case 1:
                                                performance = _a.sent();
                                                return [2 /*return*/, {
                                                        market: list.market,
                                                        title: list.title,
                                                        emoji: list.emoji,
                                                        matches_count: list.matches.length,
                                                        avg_confidence: Math.round(list.matches.reduce(function (sum, m) { return sum + m.confidence; }, 0) / list.matches.length),
                                                        matches: list.matches.map(function (m) { return ({
                                                            fs_id: m.match.fs_id,
                                                            home_name: m.match.home_name,
                                                            away_name: m.match.away_name,
                                                            league_name: m.match.league_name,
                                                            date_unix: m.match.date_unix,
                                                            confidence: m.confidence,
                                                            reason: m.reason,
                                                            potentials: m.match.potentials,
                                                            xg: m.match.xg,
                                                            odds: m.match.odds,
                                                            live_score: liveScoresMap_1.get(m.match.fs_id) || null,
                                                        }); }),
                                                        preview: (0, dailyLists_service_1.formatDailyListMessage)(list),
                                                        generated_at: list.generated_at,
                                                        performance: performance,
                                                    }];
                                        }
                                    });
                                }); }))];
                        case 3:
                            formattedLists = _a.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    lists_count: lists.length,
                                    lists: formattedLists,
                                    generated_at: Date.now(),
                                }];
                        case 4:
                            error_3 = _a.sent();
                            logger_1.logger.error('[TelegramDailyLists] ❌ Error fetching today\'s lists:', error_3);
                            return [2 /*return*/, reply.status(500).send({ error: error_3.message })];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /telegram/daily-lists/range?start=YYYY-MM-DD&end=YYYY-MM-DD
             * Get daily lists for a date range (historical data)
             *
             * Query Parameters:
             * - start: Start date (YYYY-MM-DD format, required)
             * - end: End date (YYYY-MM-DD format, required)
             *
             * Returns lists grouped by date with performance data
             */
            fastify.get('/telegram/daily-lists/range', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, start, end, listsByDate, allMatches_2, liveScoresMap_2, formattedData, error_4;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            _a = request.query, start = _a.start, end = _a.end;
                            if (!start || !end) {
                                return [2 /*return*/, reply.status(400).send({
                                        error: 'Both start and end date parameters are required (YYYY-MM-DD format)'
                                    })];
                            }
                            logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCC5 Fetching lists from ".concat(start, " to ").concat(end, "..."));
                            return [4 /*yield*/, (0, dailyLists_service_1.getDailyListsByDateRange)(start, end)];
                        case 1:
                            listsByDate = _b.sent();
                            if (Object.keys(listsByDate).length === 0) {
                                return [2 /*return*/, {
                                        success: true,
                                        date_range: { start: start, end: end },
                                        dates_count: 0,
                                        data: [],
                                        message: 'No lists found for this date range',
                                    }];
                            }
                            allMatches_2 = new Map();
                            Object.values(listsByDate).flat().forEach(function (list) {
                                list.matches.forEach(function (m) {
                                    allMatches_2.set(m.match.fs_id, m.match);
                                });
                            });
                            return [4 /*yield*/, getLiveScoresForMatches(Array.from(allMatches_2.values()))];
                        case 2:
                            liveScoresMap_2 = _b.sent();
                            return [4 /*yield*/, Promise.all(Object.entries(listsByDate).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                    var listsWithPerformance;
                                    var _this = this;
                                    var date = _b[0], lists = _b[1];
                                    return __generator(this, function (_c) {
                                        switch (_c.label) {
                                            case 0: return [4 /*yield*/, Promise.all(lists.map(function (list) { return __awaiter(_this, void 0, void 0, function () {
                                                    var performance;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, calculateListPerformance(list)];
                                                            case 1:
                                                                performance = _a.sent();
                                                                return [2 /*return*/, {
                                                                        market: list.market,
                                                                        title: list.title,
                                                                        emoji: list.emoji,
                                                                        matches_count: list.matches.length,
                                                                        avg_confidence: Math.round(list.matches.reduce(function (sum, m) { return sum + m.confidence; }, 0) / list.matches.length),
                                                                        matches: list.matches.map(function (m) { return ({
                                                                            fs_id: m.match.fs_id,
                                                                            home_name: m.match.home_name,
                                                                            away_name: m.match.away_name,
                                                                            league_name: m.match.league_name,
                                                                            date_unix: m.match.date_unix,
                                                                            confidence: m.confidence,
                                                                            reason: m.reason,
                                                                            potentials: m.match.potentials,
                                                                            xg: m.match.xg,
                                                                            odds: m.match.odds,
                                                                            live_score: liveScoresMap_2.get(m.match.fs_id) || null,
                                                                        }); }),
                                                                        preview: (0, dailyLists_service_1.formatDailyListMessage)(list),
                                                                        generated_at: list.generated_at,
                                                                        performance: performance,
                                                                    }];
                                                        }
                                                    });
                                                }); }))];
                                            case 1:
                                                listsWithPerformance = _c.sent();
                                                return [2 /*return*/, {
                                                        date: date,
                                                        lists: listsWithPerformance,
                                                        lists_count: lists.length,
                                                    }];
                                        }
                                    });
                                }); }))];
                        case 3:
                            formattedData = _b.sent();
                            return [2 /*return*/, {
                                    success: true,
                                    date_range: { start: start, end: end },
                                    dates_count: Object.keys(listsByDate).length,
                                    data: formattedData,
                                }];
                        case 4:
                            error_4 = _b.sent();
                            logger_1.logger.error('[TelegramDailyLists] ❌ Range query failed:', error_4);
                            return [2 /*return*/, reply.status(500).send({ error: error_4.message })];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /telegram/publish/daily-list/:market
             * Publish a single daily list by market type
             *
             * Markets: OVER_25, BTTS, HT_OVER_05, CORNERS, CARDS
             */
            fastify.post('/telegram/publish/daily-list/:market', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var startTime, market, logContext, channelId, lists, targetList, messageText, result, telegramMessageId, client, matchIds, duration, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            market = request.params.market;
                            logContext = { operation: 'single_list_publish', market: market };
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 9, , 10]);
                            logger_1.logger.info("[TelegramDailyLists] \uD83D\uDE80 Publishing single list: ".concat(market), logContext);
                            // 1. Check bot configuration
                            if (!telegram_client_1.telegramBot.isConfigured()) {
                                return [2 /*return*/, reply.status(503).send({ error: 'Telegram bot not configured' })];
                            }
                            channelId = process.env.TELEGRAM_CHANNEL_ID || '';
                            if (!channelId) {
                                return [2 /*return*/, reply.status(503).send({ error: 'TELEGRAM_CHANNEL_ID not set' })];
                            }
                            // 2. Get daily lists from database (or generate if not exists)
                            logger_1.logger.info('[TelegramDailyLists] 📊 Getting lists...', logContext);
                            return [4 /*yield*/, (0, dailyLists_service_1.getDailyLists)()];
                        case 2:
                            lists = _a.sent();
                            targetList = lists.find(function (l) { return l.market === market; });
                            if (!targetList) {
                                logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F List not found for market: ".concat(market), logContext);
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: "No list generated for market: ".concat(market),
                                        message: 'List not available or insufficient matches',
                                    })];
                            }
                            logger_1.logger.info("[TelegramDailyLists] \u2705 Found list for ".concat(market), __assign(__assign({}, logContext), { match_count: targetList.matches.length, avg_confidence: Math.round(targetList.matches.reduce(function (sum, m) { return sum + m.confidence; }, 0) / targetList.matches.length) }));
                            messageText = (0, dailyLists_service_1.formatDailyListMessage)(targetList);
                            logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCE1 Sending to Telegram...", logContext);
                            return [4 /*yield*/, telegram_client_1.telegramBot.sendMessage({
                                    chat_id: channelId,
                                    text: messageText,
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                })];
                        case 3:
                            result = _a.sent();
                            if (!result.ok) {
                                throw new Error("Telegram API returned ok=false for ".concat(market));
                            }
                            telegramMessageId = result.result.message_id;
                            logger_1.logger.info("[TelegramDailyLists] \u2705 Published to Telegram", __assign(__assign({}, logContext), { telegram_message_id: telegramMessageId }));
                            return [4 /*yield*/, connection_1.pool.connect()];
                        case 4:
                            client = _a.sent();
                            _a.label = 5;
                        case 5:
                            _a.trys.push([5, , 7, 8]);
                            matchIds = targetList.matches.map(function (m) { return m.match.fs_id; }).join(',');
                            return [4 /*yield*/, client.query("INSERT INTO telegram_posts (match_id, channel_id, telegram_message_id, content, status, metadata)\n           VALUES ($1, $2, $3, $4, 'published', $5)", [
                                    "daily_list_".concat(market, "_").concat(Date.now()),
                                    channelId,
                                    telegramMessageId,
                                    messageText,
                                    JSON.stringify({
                                        list_type: 'daily',
                                        market: targetList.market,
                                        match_ids: matchIds,
                                        match_count: targetList.matches.length,
                                        confidence_scores: targetList.matches.map(function (m) { return m.confidence; }),
                                        generated_at: targetList.generated_at,
                                    }),
                                ])];
                        case 6:
                            _a.sent();
                            logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCBE Saved to database", logContext);
                            return [3 /*break*/, 8];
                        case 7:
                            client.release();
                            return [7 /*endfinally*/];
                        case 8:
                            duration = Date.now() - startTime;
                            return [2 /*return*/, {
                                    success: true,
                                    market: targetList.market,
                                    title: targetList.title,
                                    telegram_message_id: telegramMessageId,
                                    match_count: targetList.matches.length,
                                    avg_confidence: Math.round(targetList.matches.reduce(function (sum, m) { return sum + m.confidence; }, 0) / targetList.matches.length),
                                    duration_ms: duration,
                                }];
                        case 9:
                            error_5 = _a.sent();
                            logger_1.logger.error("[TelegramDailyLists] \u274C Error publishing ".concat(market, ":"), error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: error_5.message,
                                    market: market,
                                })];
                        case 10: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /telegram/publish/daily-lists
             * Generate and publish daily prediction lists (automated)
             *
             * STRICT RULES:
             * - Only NOT_STARTED matches
             * - 3-5 matches per list max
             * - Confidence-based filtering
             * - Skip if insufficient data
             */
            fastify.post('/telegram/publish/daily-lists', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var startTime, logContext, channelId, lists, publishedLists, _i, lists_1, list, messageText, result, telegramMessageId, client, matchIds, err_8, elapsedMs, error_6, elapsedMs;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            logContext = { operation: 'daily_lists_publish' };
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 14, , 15]);
                            logger_1.logger.info('[TelegramDailyLists] 🚀 Starting daily lists publication...', logContext);
                            // 1. Check bot configuration
                            if (!telegram_client_1.telegramBot.isConfigured()) {
                                return [2 /*return*/, reply.status(503).send({ error: 'Telegram bot not configured' })];
                            }
                            channelId = process.env.TELEGRAM_CHANNEL_ID || '';
                            if (!channelId) {
                                return [2 /*return*/, reply.status(503).send({ error: 'TELEGRAM_CHANNEL_ID not set' })];
                            }
                            // 2. Get daily lists from database (or generate if not exists)
                            logger_1.logger.info('[TelegramDailyLists] 📊 Getting lists...', logContext);
                            return [4 /*yield*/, (0, dailyLists_service_1.getDailyLists)()];
                        case 2:
                            lists = _a.sent();
                            if (lists.length === 0) {
                                logger_1.logger.warn('[TelegramDailyLists] ⚠️ NO_ELIGIBLE_MATCHES - No lists to publish', logContext);
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'NO_ELIGIBLE_MATCHES',
                                        lists_generated: 0,
                                        reason: 'Insufficient matches with required confidence levels',
                                    }];
                            }
                            logger_1.logger.info("[TelegramDailyLists] \u2705 Generated ".concat(lists.length, " lists"), __assign(__assign({}, logContext), { list_count: lists.length, markets: lists.map(function (l) { return l.market; }) }));
                            publishedLists = [];
                            _i = 0, lists_1 = lists;
                            _a.label = 3;
                        case 3:
                            if (!(_i < lists_1.length)) return [3 /*break*/, 13];
                            list = lists_1[_i];
                            logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCE1 Publishing ".concat(list.market, " list..."), __assign(__assign({}, logContext), { market: list.market, match_count: list.matches.length }));
                            messageText = (0, dailyLists_service_1.formatDailyListMessage)(list);
                            _a.label = 4;
                        case 4:
                            _a.trys.push([4, 11, , 12]);
                            return [4 /*yield*/, telegram_client_1.telegramBot.sendMessage({
                                    chat_id: channelId,
                                    text: messageText,
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                })];
                        case 5:
                            result = _a.sent();
                            if (!result.ok) {
                                throw new Error("Telegram API returned ok=false for ".concat(list.market));
                            }
                            telegramMessageId = result.result.message_id;
                            return [4 /*yield*/, connection_1.pool.connect()];
                        case 6:
                            client = _a.sent();
                            _a.label = 7;
                        case 7:
                            _a.trys.push([7, , 9, 10]);
                            matchIds = list.matches.map(function (m) { return m.match.fs_id; }).join(',');
                            return [4 /*yield*/, client.query("INSERT INTO telegram_posts (match_id, channel_id, telegram_message_id, content, status, metadata)\n               VALUES ($1, $2, $3, $4, 'published', $5)", [
                                    "daily_list_".concat(list.market, "_").concat(Date.now()), // Unique ID for list
                                    channelId,
                                    telegramMessageId,
                                    messageText,
                                    JSON.stringify({
                                        list_type: 'daily',
                                        market: list.market,
                                        match_ids: matchIds,
                                        match_count: list.matches.length,
                                        confidence_scores: list.matches.map(function (m) { return m.confidence; }),
                                        generated_at: list.generated_at,
                                    }),
                                ])];
                        case 8:
                            _a.sent();
                            return [3 /*break*/, 10];
                        case 9:
                            client.release();
                            return [7 /*endfinally*/];
                        case 10:
                            publishedLists.push({
                                market: list.market,
                                title: list.title,
                                match_count: list.matches.length,
                                telegram_message_id: telegramMessageId,
                                avg_confidence: Math.round(list.matches.reduce(function (sum, m) { return sum + m.confidence; }, 0) / list.matches.length),
                            });
                            logger_1.logger.info("[TelegramDailyLists] \u2705 Published ".concat(list.market, " list"), __assign(__assign({}, logContext), { market: list.market, message_id: telegramMessageId }));
                            return [3 /*break*/, 12];
                        case 11:
                            err_8 = _a.sent();
                            logger_1.logger.error("[TelegramDailyLists] \u274C Failed to publish ".concat(list.market, " list"), __assign(__assign({}, logContext), { market: list.market, error: err_8.message }));
                            return [3 /*break*/, 12];
                        case 12:
                            _i++;
                            return [3 /*break*/, 3];
                        case 13:
                            elapsedMs = Date.now() - startTime;
                            logger_1.logger.info('[TelegramDailyLists] ✅ Daily lists publication complete', __assign(__assign({}, logContext), { lists_generated: lists.length, lists_published: publishedLists.length, elapsed_ms: elapsedMs }));
                            return [2 /*return*/, {
                                    success: true,
                                    lists_generated: lists.length,
                                    lists_published: publishedLists.length,
                                    published_lists: publishedLists,
                                    elapsed_ms: elapsedMs,
                                }];
                        case 14:
                            error_6 = _a.sent();
                            elapsedMs = Date.now() - startTime;
                            logger_1.logger.error('[TelegramDailyLists] ❌ Daily lists publication failed', __assign(__assign({}, logContext), { error: error_6.message, stack: error_6.stack, elapsed_ms: elapsedMs }));
                            return [2 /*return*/, reply.status(500).send({ error: error_6.message })];
                        case 15: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /telegram/daily-lists/refresh
             * Force refresh daily lists (admin function)
             */
            fastify.post('/telegram/daily-lists/refresh', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var logContext, startTime, lists, elapsedMs, error_7, elapsedMs;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            logContext = { endpoint: 'POST /telegram/daily-lists/refresh' };
                            startTime = Date.now();
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            logger_1.logger.info('[TelegramDailyLists] 🔄 FORCE REFRESH requested...', logContext);
                            return [4 /*yield*/, (0, dailyLists_service_1.refreshDailyLists)()];
                        case 2:
                            lists = _a.sent();
                            elapsedMs = Date.now() - startTime;
                            logger_1.logger.info("[TelegramDailyLists] \u2705 Force refresh completed", __assign(__assign({}, logContext), { lists_generated: lists.length, elapsed_ms: elapsedMs }));
                            return [2 /*return*/, {
                                    success: true,
                                    lists_generated: lists.length,
                                    lists: lists.map(function (l) { return ({
                                        market: l.market,
                                        title: l.title,
                                        matches_count: l.matches.length,
                                        avg_confidence: l.avg_confidence || 0,
                                    }); }),
                                    elapsed_ms: elapsedMs,
                                }];
                        case 3:
                            error_7 = _a.sent();
                            elapsedMs = Date.now() - startTime;
                            logger_1.logger.error('[TelegramDailyLists] ❌ Force refresh failed', __assign(__assign({}, logContext), { error: error_7.message, stack: error_7.stack, elapsed_ms: elapsedMs }));
                            return [2 /*return*/, reply.status(500).send({ error: error_7.message })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}
