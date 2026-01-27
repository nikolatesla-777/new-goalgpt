"use strict";
/**
 * AI Prediction Service
 *
 * Handles ingestion and processing of AI predictions from external sources.
 * This runs on the VPS backend (Digital Ocean) - NOT on Vercel.
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
exports.aiPredictionService = exports.AIPredictionService = void 0;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
var teamNameMatcher_service_1 = require("./teamNameMatcher.service");
var predictionSettlement_service_1 = require("./predictionSettlement.service");
var PredictionOrchestrator_1 = require("../orchestration/PredictionOrchestrator");
var AIPredictionService = /** @class */ (function () {
    function AIPredictionService() {
    }
    /**
     * Get statistics for all bots
     * REFACTORED: Uses new 29-column schema with direct match_id link
     * - Uses p.canonical_bot_name instead of p.bot_name
     * - Uses p.result field (already settled by predictionSettlement.service)
     * - Uses p.match_id directly joined to ts_matches.id
     * - No more ai_prediction_matches junction table
     */
    AIPredictionService.prototype.getBotPerformanceStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, nameMap_1, rawBots, mergedStats, _i, rawBots_1, bot, existing, newTotalFinished, botStats, globalTotal, globalWins, globalLosses, globalPending, globalFinished, globalStats, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, connection_1.pool.query("\n                SELECT\n                    p.canonical_bot_name as bot_name,\n                    COUNT(*) as total_predictions,\n                    SUM(CASE WHEN p.result = 'won' THEN 1 ELSE 0 END) as wins,\n                    SUM(CASE WHEN p.result = 'lost' THEN 1 ELSE 0 END) as losses,\n                    SUM(CASE WHEN p.result = 'pending' OR p.result IS NULL THEN 1 ELSE 0 END) as pending\n                FROM ai_predictions p\n                GROUP BY p.canonical_bot_name\n            ")];
                    case 1:
                        result = _a.sent();
                        nameMap_1 = {
                            'ALERT: D': 'Alert D',
                            'ALERT D': 'Alert D',
                            'CODE: 35': 'Code 35',
                            'Algoritma: 01': 'Algoritma 01',
                            'Alert System': 'Alert System'
                        };
                        rawBots = result.rows.map(function (row) {
                            var wins = parseInt(row.wins);
                            var losses = parseInt(row.losses);
                            var total = parseInt(row.total_predictions);
                            var pending = parseInt(row.pending);
                            var totalFinished = wins + losses;
                            var originalName = row.bot_name || 'Unknown';
                            var displayName = nameMap_1[originalName] || originalName;
                            return {
                                bot_name: displayName,
                                total_predictions: total,
                                wins: wins,
                                losses: losses,
                                pending: pending,
                                win_rate: totalFinished > 0 ? parseFloat(((wins / totalFinished) * 100).toFixed(1)) : 0
                            };
                        });
                        mergedStats = {};
                        for (_i = 0, rawBots_1 = rawBots; _i < rawBots_1.length; _i++) {
                            bot = rawBots_1[_i];
                            if (!mergedStats[bot.bot_name]) {
                                mergedStats[bot.bot_name] = __assign({}, bot);
                            }
                            else {
                                existing = mergedStats[bot.bot_name];
                                newTotalFinished = (existing.wins + bot.wins) + (existing.losses + bot.losses);
                                existing.total_predictions += bot.total_predictions;
                                existing.wins += bot.wins;
                                existing.losses += bot.losses;
                                existing.pending += bot.pending;
                                existing.win_rate = newTotalFinished > 0
                                    ? parseFloat((((existing.wins) / newTotalFinished) * 100).toFixed(1))
                                    : 0;
                            }
                        }
                        botStats = Object.values(mergedStats);
                        globalTotal = botStats.reduce(function (sum, b) { return sum + b.total_predictions; }, 0);
                        globalWins = botStats.reduce(function (sum, b) { return sum + b.wins; }, 0);
                        globalLosses = botStats.reduce(function (sum, b) { return sum + b.losses; }, 0);
                        globalPending = botStats.reduce(function (sum, b) { return sum + b.pending; }, 0);
                        globalFinished = globalWins + globalLosses;
                        globalStats = {
                            bot_name: 'GLOBAL',
                            total_predictions: globalTotal,
                            wins: globalWins,
                            losses: globalLosses,
                            pending: globalPending,
                            win_rate: globalFinished > 0 ? parseFloat(((globalWins / globalFinished) * 100).toFixed(1)) : 0
                        };
                        return [2 /*return*/, {
                                global: globalStats,
                                bots: botStats
                            }];
                    case 2:
                        error_1 = _a.sent();
                        logger_1.logger.error('[AIPrediction] Error calculating bot stats:', error_1);
                        return [2 /*return*/, {
                                global: { bot_name: 'GLOBAL', total_predictions: 0, wins: 0, losses: 0, pending: 0, win_rate: 0 },
                                bots: []
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all bot rules for admin display
     */
    AIPredictionService.prototype.getAllBotRules = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.query("\n            SELECT \n                id, bot_group_id, bot_display_name, minute_from, minute_to, \n                priority, is_active, created_at, prediction_type_pattern\n            FROM ai_bot_rules\n            ORDER BY priority DESC\n        ")];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
     * Decode Base64 prediction payload and URL-decode the content
     */
    AIPredictionService.prototype.decodePayload = function (base64String) {
        try {
            // First decode Base64
            var base64Decoded = Buffer.from(base64String, 'base64').toString('utf-8');
            // Then try to URL-decode (handles emoji characters like %E2%9A%BD -> ⚽)
            try {
                return decodeURIComponent(base64Decoded);
            }
            catch (_a) {
                // If URL decode fails, return the base64-decoded string as-is
                return base64Decoded;
            }
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Failed to decode Base64 payload:', error);
            return base64String; // Return as-is if not valid base64
        }
    };
    /**
     * Get bot group for a prediction based on minute
     * Uses rules from ai_bot_rules table, sorted by priority (higher = more specific)
     */
    AIPredictionService.prototype.getBotGroupForMinute = function (minute) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _i, _a, rule, minFrom, minTo, dynamicBotName, error_2, dynamicBotName;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, connection_1.pool.query("\n                SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority, display_template, prediction_period, base_prediction_type\n                FROM ai_bot_rules\n                WHERE is_active = true\n                  AND bot_display_name != 'Alert System'  -- CRITICAL FIX: Alert System is only for manual predictions, not external ones\n                ORDER BY priority DESC\n            ")];
                    case 1:
                        result = _d.sent();
                        for (_i = 0, _a = result.rows; _i < _a.length; _i++) {
                            rule = _a[_i];
                            minFrom = (_b = rule.minute_from) !== null && _b !== void 0 ? _b : 0;
                            minTo = (_c = rule.minute_to) !== null && _c !== void 0 ? _c : 999;
                            if (minute >= minFrom && minute <= minTo) {
                                return [2 /*return*/, {
                                        botGroupId: rule.bot_group_id || null,
                                        botDisplayName: rule.bot_display_name,
                                        displayTemplate: rule.display_template,
                                        predictionPeriod: rule.prediction_period,
                                        basePredictionType: rule.base_prediction_type
                                    }];
                            }
                        }
                        dynamicBotName = "BOT ".concat(minute);
                        logger_1.logger.info("[AIPrediction] No specific bot rule found for minute ".concat(minute, ", using dynamic: ").concat(dynamicBotName));
                        return [2 /*return*/, {
                                botGroupId: null,
                                botDisplayName: dynamicBotName,
                                displayTemplate: "\uD83E\uDD16 {period} {value} \u00DCST ({minute}'' dk)",
                                predictionPeriod: 'AUTO',
                                basePredictionType: 'ÜST'
                            }];
                    case 2:
                        error_2 = _d.sent();
                        logger_1.logger.warn('[AIPrediction] Failed to get bot group, using dynamic fallback:', error_2);
                        dynamicBotName = "BOT ".concat(minute);
                        return [2 /*return*/, {
                                botGroupId: null,
                                botDisplayName: dynamicBotName,
                                displayTemplate: "\uD83E\uDD16 {period} {value} \u00DCST ({minute}'' dk)",
                                predictionPeriod: 'AUTO',
                                basePredictionType: 'ÜST'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate prediction value based on current total goals
     * For ÜST (OVER) predictions:
     * - 0 goals → 0.5 ÜST
     * - 1 goal → 1.5 ÜST
     * - 2 goals → 2.5 ÜST
     * - etc.
     */
    AIPredictionService.prototype.calculatePredictionValue = function (totalGoals) {
        return "".concat(totalGoals + 0.5);
    };
    /**
     * Determine period based on minute (SABIT KURAL)
     * 1-45' → IY (first half) - SABIT
     * 46-90' → MS (full match) - SABIT
     * Bot rule'daki period değeri IGNORE edilir, sadece dakikaya göre belirlenir
     */
    AIPredictionService.prototype.determinePeriod = function (minute, botPeriod) {
        // KRITIK: Dakikaya göre SABIT belirleme
        // Bot rule'daki period değeri kullanılmaz
        return minute <= 45 ? 'IY' : 'MS';
    };
    /**
     * Generate prediction details from score
     * REFACTORED: Now returns prediction (unified) and predictionThreshold (numeric) for new schema
     */
    AIPredictionService.prototype.generatePredictionFromScore = function (score, // e.g., "0-0", "1-0"
    minute, botRule) {
        // Parse score
        var _a = score.split('-').map(function (s) { return s.trim(); }), homeStr = _a[0], awayStr = _a[1];
        var homeGoals = parseInt(homeStr) || 0;
        var awayGoals = parseInt(awayStr) || 0;
        var totalGoals = homeGoals + awayGoals;
        // Determine period and prediction value
        var period = this.determinePeriod(minute, botRule.predictionPeriod);
        var thresholdNumeric = totalGoals + 0.5; // e.g., 0.5, 1.5, 2.5
        var bareValue = thresholdNumeric.toString();
        var baseType = botRule.basePredictionType || 'ÜST';
        // Format: "MS 0.5 ÜST" (Period + Value + Type) - this is the unified prediction
        var predictionValue = "".concat(period, " ").concat(bareValue, " ").concat(baseType);
        // Type: "MS" (Period) - keeps it clean for aggregation
        var predictionType = period;
        // Build display text from template or default
        var displayPrediction;
        if (botRule.displayTemplate) {
            displayPrediction = botRule.displayTemplate
                .replace('{period}', period)
                .replace('{value}', bareValue)
                .replace('{minute}', minute.toString());
        }
        else {
            displayPrediction = "\uD83E\uDD16 ".concat(predictionValue, " (").concat(minute, "' dk)");
        }
        return {
            predictionType: predictionType,
            predictionValue: predictionValue,
            displayPrediction: displayPrediction,
            // NEW SCHEMA FIELDS
            prediction: predictionValue, // Unified field "MS 0.5 ÜST"
            predictionThreshold: thresholdNumeric // Numeric 0.5, 1.5, 2.5
        };
    };
    /**
     * Check if a goal event triggers instant win for a prediction
     * Returns true if prediction is instantly won
     */
    AIPredictionService.prototype.checkInstantWin = function (predictionType, predictionValue, newTotalGoals, minute, statusId, htHome, // Optional HT scores for retroactive IY settlement
    htAway) {
        // KRITIK: prediction_value'den sadece sayısal değeri çıkar
        // Örnek: "IY 0.5 ÜST" -> "0.5", "0.5" -> "0.5", "MS 2.5 ÜST" -> "2.5"
        var numericMatch = predictionValue.match(/([\d.]+)/);
        var value = numericMatch ? parseFloat(numericMatch[1]) : parseFloat(predictionValue);
        if (isNaN(value)) {
            logger_1.logger.warn("[AIPrediction] Invalid prediction_value: ".concat(predictionValue, ", cannot parse numeric value"));
            return { isInstantWin: false, reason: "Invalid prediction value: ".concat(predictionValue) };
        }
        var isOver = predictionType.toUpperCase().includes('ÜST');
        var isUnder = predictionType.toUpperCase().includes('ALT');
        var isIY = predictionType.toUpperCase().includes('IY');
        // IY Period Check:
        // Use statusId if available (Status 2/3 = First Half).
        // Fallback to minute if not available, allowing up to 60' for injury time safety.
        if (isIY) {
            var isIYValid = true;
            if (statusId !== undefined) {
                // Status 2 (1H) or 3 (HT) -> Valid IY
                // Status 4+ -> Invalid IY (normally), BUT check if we have HT score
                var isFirstHalf = statusId === 2 || statusId === 3;
                if (!isFirstHalf) {
                    // CRITICAL FIX: If period ended (Status 4+), allow settlement IF we verify the win using HT score
                    logger_1.logger.info("[AIPrediction] IY Check - Post HT. Status: ".concat(statusId, ", HT: ").concat(htHome, "-").concat(htAway, ", Over: ").concat(isOver, ", Val: ").concat(value));
                    if (htHome !== undefined && htAway !== undefined) {
                        var htTotal = htHome + htAway;
                        // If OVER bet and HT Total > Line -> It's a WIN (Retroactive)
                        if (isOver && htTotal > value) {
                            logger_1.logger.info("[AIPrediction] IY Retroactive WIN logic met: ".concat(htTotal, " > ").concat(value));
                            return { isInstantWin: true, reason: "Retroactive HT Win: ".concat(htTotal, " > ").concat(value) };
                        }
                        // If UNDER bet? Usually dealt with at end, but if we are at Status 4+, IY is definitely over.
                        // If HT Total <= Line -> It's a WIN
                        if (isUnder && htTotal <= value) {
                            return { isInstantWin: true, reason: "Retroactive HT Win: ".concat(htTotal, " <= ").concat(value) };
                        }
                    }
                    isIYValid = false;
                }
            }
            else {
                // Fallback
                if (minute > 60)
                    isIYValid = false;
            }
            if (!isIYValid) {
                return { isInstantWin: false, reason: 'IY period ended' };
            }
        }
        // OVER (ÜST) - instant win when total goals exceed value
        if (isOver && newTotalGoals > value) {
            return { isInstantWin: true, reason: "Gol! Toplam ".concat(newTotalGoals, " > ").concat(value) };
        }
        // UNDER (ALT) - instant lose when total goals exceed value
        if (isUnder && newTotalGoals > value) {
            return { isInstantWin: false, reason: "Gol! Toplam ".concat(newTotalGoals, " > ").concat(value, " - Kaybetti") };
        }
        return { isInstantWin: false, reason: 'Henüz sonuçlanmadı' };
    };
    /**
     * Parse multi-line prediction format (emoji-based or simple)
     *
     * Format 1 (Emoji-based):
     *   00084⚽ *Sunderland A.F.C - Manchester City  ( 0 - 0 )*
     *   🏟 English Premier League
     *   ⏰ 10
     *   ❗ IY Gol
     *   👉 AlertCode: IY-1 Ev: 18.5 Dep: 6.2
     *
     * Format 2 (Simple):
     *   00053*Denbigh Town - Gresford Athletic ( 1 - 2 )*
     *   Wales Championship North
     *   Minute: 65 SonGol dk: 51
     *   *3.5 ÜST*
     */
    AIPredictionService.prototype.parseMultiLineFormat = function (content, externalId) {
        try {
            // Split by newlines (handle both \r\n and \n)
            var lines = content.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
            if (lines.length < 2) {
                return null;
            }
            var homeTeam = '';
            var awayTeam = '';
            var score = '0-0';
            var minute = 0;
            var league = '';
            var predictionType = '';
            var predictionValue = '';
            // Parse first line: Teams and score
            // Format: "00084⚽ *Sunderland A.F.C - Manchester City  ( 0 - 0 )*"
            // Or: "00053*Denbigh Town - Gresford Athletic ( 1 - 2 )*"
            var firstLine = lines[0];
            // Extract teams and score from first line
            // Match pattern: *TeamA - TeamB ( H - A )*
            // CRITICAL FIX: Use ' - ' (space-hyphen-space) as separator to avoid splitting team names with hyphens
            // Old regex: /\*([^*]+?)\s*-\s*([^*]+?)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*\*/
            // Problem: Lazy quantifier splits "Al-Shabab(KUW)" into "Al" + "Shabab(KUW)"
            // New regex: Split on ' - ' (with mandatory spaces) and use score parenthesis as anchor
            var teamsScoreMatch = firstLine.match(/\*(.+?)\s+-\s+([^(]+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*\*/);
            if (teamsScoreMatch) {
                homeTeam = teamsScoreMatch[1].trim();
                awayTeam = teamsScoreMatch[2].trim();
                score = "".concat(teamsScoreMatch[3], "-").concat(teamsScoreMatch[4]);
            }
            else {
                // Try simpler pattern: TeamA - TeamB (using space-hyphen-space separator)
                // CRITICAL FIX: Also use ' - ' here instead of just '-'
                var simpleTeamsMatch = firstLine.match(/\*?(.+?)\s+-\s+([^*(]+)/i);
                if (simpleTeamsMatch) {
                    homeTeam = simpleTeamsMatch[1].trim().replace(/^[\d⚽🏟]+/, '').trim();
                    awayTeam = simpleTeamsMatch[2].trim();
                }
            }
            // Parse remaining lines
            for (var i = 1; i < lines.length; i++) {
                var line = lines[i];
                // League line (🏟 or second line without special prefix)
                if (line.startsWith('🏟') || (i === 1 && !line.startsWith('⏰') && !line.startsWith('❗') && !line.startsWith('Minute'))) {
                    league = line.replace(/^🏟\s*/, '').trim();
                }
                // Minute line: "⏰ 10" or "Minute: 65 SonGol dk: 51"
                else if (line.startsWith('⏰') || line.toLowerCase().startsWith('minute')) {
                    var minuteMatch = line.match(/(\d+)/);
                    if (minuteMatch) {
                        minute = parseInt(minuteMatch[1], 10);
                    }
                }
                // Prediction type line: "❗ IY Gol"
                else if (line.startsWith('❗')) {
                    predictionType = line.replace(/^❗\s*/, '').trim();
                    predictionValue = predictionType;
                }
                // Prediction value line: "*3.5 ÜST*" or "*2.5 ALT*"
                else if (line.match(/^\*[\d.]+\s*(ÜST|ALT|OVER|UNDER)\*$/i)) {
                    predictionValue = line.replace(/^\*|\*$/g, '').trim();
                    predictionType = predictionValue;
                }
                // AlertCode line (extract additional info if needed)
                else if (line.startsWith('👉') || line.toLowerCase().includes('alertcode')) {
                    // Extract AlertCode value if prediction type not set
                    if (!predictionType) {
                        var alertMatch = line.match(/AlertCode:\s*([\w-]+)/i);
                        if (alertMatch) {
                            predictionType = alertMatch[1];
                        }
                    }
                }
            }
            // Validate we got minimum required fields
            if (!homeTeam || !awayTeam) {
                logger_1.logger.debug('[AIPrediction] Multi-line parse: No teams found');
                return null;
            }
            logger_1.logger.info("[AIPrediction] Multi-line parsed: ".concat(homeTeam, " vs ").concat(awayTeam, " | Score: ").concat(score, " | Min: ").concat(minute, " | League: ").concat(league, " | Type: ").concat(predictionType));
            return {
                externalId: externalId || "pred_".concat(Date.now()),
                botName: 'external',
                leagueName: league,
                homeTeamName: homeTeam,
                awayTeamName: awayTeam,
                scoreAtPrediction: score,
                minuteAtPrediction: minute,
                predictionType: predictionType,
                predictionValue: predictionValue,
                rawPayload: content
            };
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Error in multi-line parser:', error);
            return null;
        }
    };
    /**
     * Parse prediction content from decoded string
     * Tries multiple formats in order:
     * 1. Multi-line format (emoji-based or simple) - NEW
     * 2. JSON object
     * 3. Pipe-delimited format
     * 4. Simple team format
     */
    AIPredictionService.prototype.parsePredictionContent = function (content, externalId) {
        var _a, _b;
        try {
            // Try multi-line format first (most common from external systems)
            var multiLineResult = this.parseMultiLineFormat(content, externalId);
            if (multiLineResult) {
                return multiLineResult;
            }
            // Try JSON parse
            try {
                var json = JSON.parse(content);
                if (json.home_team || json.homeTeam) {
                    return {
                        externalId: externalId || json.id || "pred_".concat(Date.now()),
                        botName: json.bot_name || json.botName || 'unknown',
                        leagueName: json.league || json.leagueName || '',
                        homeTeamName: json.home_team || json.homeTeam || '',
                        awayTeamName: json.away_team || json.awayTeam || '',
                        scoreAtPrediction: json.score || '0-0',
                        minuteAtPrediction: parseInt(String(json.minute || '0').replace(/[^\d]/g, '')) || 0,
                        predictionType: json.prediction_type || json.predictionType || '',
                        predictionValue: json.prediction_value || json.predictionValue || json.prediction || '',
                        rawPayload: content
                    };
                }
            }
            catch (_c) {
                // Not JSON, continue to other formats
            }
            // Try pipe-delimited format: "Teams | Score | Minute | League | Prediction"
            var parts = content.split('|').map(function (p) { return p.trim(); });
            if (parts.length >= 3) {
                // Parse teams (usually "Home - Away" or "Home vs Away")
                var teamsPart = parts[0];
                var teamsSplit = teamsPart.split(/\s*[-vs]+\s*/i);
                var homeTeam = ((_a = teamsSplit[0]) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                var awayTeam = ((_b = teamsSplit[1]) === null || _b === void 0 ? void 0 : _b.trim()) || '';
                return {
                    externalId: externalId || "pred_".concat(Date.now()),
                    botName: 'external',
                    leagueName: parts[3] || '',
                    homeTeamName: homeTeam,
                    awayTeamName: awayTeam,
                    scoreAtPrediction: parts[1] || '0-0',
                    minuteAtPrediction: parseInt(String(parts[2] || '0').replace(/[^\d]/g, '')) || 0,
                    predictionType: parts[4] || '',
                    predictionValue: parts[4] || '',
                    rawPayload: content
                };
            }
            // Try simple team format: "Home - Away"
            var simpleMatch = content.match(/^(.+?)\s*[-vs]+\s*(.+?)$/i);
            if (simpleMatch) {
                return {
                    externalId: externalId || "pred_".concat(Date.now()),
                    botName: 'external',
                    leagueName: '',
                    homeTeamName: simpleMatch[1].trim(),
                    awayTeamName: simpleMatch[2].trim(),
                    scoreAtPrediction: '0-0',
                    minuteAtPrediction: 0,
                    predictionType: '',
                    predictionValue: '',
                    rawPayload: content
                };
            }
            logger_1.logger.warn('[AIPrediction] Could not parse prediction content:', content.substring(0, 200));
            return null;
        }
        catch (error) {
            logger_1.logger.error('[AIPrediction] Error parsing prediction:', error);
            return null;
        }
    };
    /**
     * Ingest a new prediction
     */
    AIPredictionService.prototype.ingestPrediction = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var client, decodedContent, parsed, matchResult, matchError_1, botGroup, effectivePeriod, generatedDetails, createData, orchestrator, createResult, predictionId, updateResult, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 21, 23, 24]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _a.sent();
                        decodedContent = '';
                        if (payload.prediction) {
                            decodedContent = this.decodePayload(payload.prediction);
                        }
                        parsed = null;
                        if (decodedContent) {
                            parsed = this.parsePredictionContent(decodedContent, payload.id || '');
                        }
                        else if (payload.home_team && payload.away_team) {
                            // Direct fields provided
                            parsed = {
                                externalId: payload.id || "pred_".concat(Date.now()),
                                botName: payload.bot_name || 'external',
                                leagueName: payload.league || '',
                                homeTeamName: payload.home_team,
                                awayTeamName: payload.away_team,
                                scoreAtPrediction: payload.score || '0-0',
                                minuteAtPrediction: parseInt(String(payload.minute || '0').replace(/[^\d]/g, '')) || 0,
                                predictionType: payload.prediction_type || '',
                                predictionValue: payload.prediction_value || '',
                                rawPayload: JSON.stringify(payload)
                            };
                        }
                        if (!(!parsed || !parsed.homeTeamName || !parsed.awayTeamName)) return [3 /*break*/, 5];
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                matchFound: false,
                                error: 'Could not parse prediction payload'
                            }];
                    case 5:
                        matchResult = null;
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, teamNameMatcher_service_1.teamNameMatcherService.findMatchByTeams(parsed.homeTeamName, parsed.awayTeamName, parsed.minuteAtPrediction, parsed.scoreAtPrediction, parsed.leagueName // League hint for better matching
                            )];
                    case 7:
                        matchResult = _a.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        matchError_1 = _a.sent();
                        logger_1.logger.warn('[AIPrediction] Team matching failed:', matchError_1);
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, this.getBotGroupForMinute(parsed.minuteAtPrediction)];
                    case 10:
                        botGroup = _a.sent();
                        effectivePeriod = parsed.minuteAtPrediction <= 45 ? 'IY' : 'MS';
                        generatedDetails = this.generatePredictionFromScore(parsed.scoreAtPrediction, parsed.minuteAtPrediction, __assign(__assign({}, botGroup), { predictionPeriod: effectivePeriod // Dakikaya göre sabit belirlenen period
                         }));
                        logger_1.logger.info("[AIPrediction] Assigned to bot: ".concat(botGroup.botDisplayName, " (minute: ").concat(parsed.minuteAtPrediction, ")"));
                        logger_1.logger.info("[AIPrediction] Generated details: ".concat(JSON.stringify(generatedDetails)));
                        createData = {
                            external_id: parsed.externalId,
                            canonical_bot_name: botGroup.botDisplayName,
                            league_name: parsed.leagueName,
                            home_team_name: parsed.homeTeamName,
                            away_team_name: parsed.awayTeamName,
                            score_at_prediction: parsed.scoreAtPrediction,
                            minute_at_prediction: parsed.minuteAtPrediction,
                            prediction: generatedDetails.prediction,
                            prediction_threshold: generatedDetails.predictionThreshold,
                            match_id: null, // Will be set below if matched
                            match_time: null,
                            match_status: 1,
                            access_type: 'FREE',
                            source: 'external',
                        };
                        orchestrator = PredictionOrchestrator_1.PredictionOrchestrator.getInstance();
                        return [4 /*yield*/, orchestrator.createPrediction(createData)];
                    case 11:
                        createResult = _a.sent();
                        if (!(createResult.status === 'duplicate')) return [3 /*break*/, 13];
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 12:
                        _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                matchFound: false,
                                error: 'Duplicate prediction',
                                predictionId: createResult.predictionId,
                            }];
                    case 13:
                        if (!(createResult.status === 'error')) return [3 /*break*/, 15];
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 14:
                        _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                matchFound: false,
                                error: createResult.reason || 'Failed to create prediction',
                            }];
                    case 15:
                        predictionId = createResult.predictionId;
                        logger_1.logger.info("[AIPrediction] Created prediction ".concat(predictionId, ": ").concat(parsed.homeTeamName, " vs ").concat(parsed.awayTeamName));
                        if (!(matchResult && matchResult.overallConfidence >= 0.6)) return [3 /*break*/, 19];
                        return [4 /*yield*/, orchestrator.updatePrediction(predictionId, {
                                match_id: matchResult.matchExternalId,
                                match_status: matchResult.statusId || 1,
                            })];
                    case 16:
                        updateResult = _a.sent();
                        if (!(updateResult.status === 'success')) return [3 /*break*/, 18];
                        logger_1.logger.info("[AIPrediction] Linked to match ".concat(matchResult.matchExternalId, " (confidence: ").concat(matchResult.overallConfidence.toFixed(2), ")"));
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 17:
                        _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                predictionId: predictionId,
                                matchFound: true,
                                matchExternalId: matchResult.matchExternalId,
                                matchId: matchResult.matchExternalId,
                                confidence: matchResult.overallConfidence
                            }];
                    case 18:
                        logger_1.logger.warn("[AIPrediction] Failed to link prediction ".concat(predictionId, " to match"));
                        _a.label = 19;
                    case 19: 
                    // No match found or low confidence
                    return [4 /*yield*/, client.query('COMMIT')];
                    case 20:
                        // No match found or low confidence
                        _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                predictionId: predictionId,
                                matchFound: false,
                                error: matchResult
                                    ? "Low confidence match: ".concat(matchResult.overallConfidence.toFixed(2))
                                    : 'No matching match found in database'
                            }];
                    case 21:
                        error_3 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 22:
                        _a.sent();
                        logger_1.logger.error('[AIPrediction] Ingestion error:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                matchFound: false,
                                error: error_3 instanceof Error ? error_3.message : 'Unknown error'
                            }];
                    case 23:
                        client.release();
                        return [7 /*endfinally*/];
                    case 24: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get pending predictions (not yet matched)
     */
    AIPredictionService.prototype.getPendingPredictions = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var query, result;
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n      SELECT * FROM ai_predictions \n      WHERE processed = false \n      ORDER BY created_at DESC \n      LIMIT $1\n    ";
                        return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
     * Get matched predictions with results (enhanced with match/team/league data)
     * REFACTORED: Uses direct p.match_id join instead of junction table
     */
    AIPredictionService.prototype.getMatchedPredictions = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var query, result;
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n            SELECT\n                p.id,\n                p.external_id,\n                p.canonical_bot_name as bot_name,\n                p.league_name,\n                p.home_team_name,\n                p.away_team_name,\n                p.score_at_prediction,\n                p.minute_at_prediction,\n                p.prediction,\n                p.prediction_threshold,\n                p.match_id,\n                p.result,\n                p.final_score,\n                p.result_reason,\n                p.access_type,\n                p.source,\n                p.created_at,\n                -- Backward compatibility aliases\n                m.external_id as match_external_id,\n                80 as overall_confidence,\n                CASE\n                    WHEN p.result = 'won' THEN 'winner'\n                    WHEN p.result = 'lost' THEN 'loser'\n                    ELSE p.result\n                END as prediction_result,\n                -- Match data\n                m.match_time,\n                m.status_id as match_status_id,\n                m.minute as match_minute,\n                -- Frontend compatibility aliases (PredictionCard expects these field names)\n                m.status_id as live_match_status,\n                m.minute as live_match_minute,\n                -- CRITICAL FIX (2026-01-17): Parse from JSONB array if home_score_display is NULL\n                COALESCE(m.home_score_display, (m.home_scores->>0)::INTEGER) as home_score_display,\n                COALESCE(m.away_score_display, (m.away_scores->>0)::INTEGER) as away_score_display,\n                -- Frontend expects home_score/away_score aliases\n                COALESCE(m.home_score_display, (m.home_scores->>0)::INTEGER) as home_score,\n                COALESCE(m.away_score_display, (m.away_scores->>0)::INTEGER) as away_score,\n                -- Team data\n                ht.name as home_team_db_name,\n                ht.logo_url as home_team_logo,\n                at.name as away_team_db_name,\n                at.logo_url as away_team_logo,\n                -- Competition data\n                c.name as competition_name,\n                c.logo_url as competition_logo,\n                -- Country data\n                ctry.name as country_name,\n                ctry.logo as country_logo\n            FROM ai_predictions p\n            LEFT JOIN ts_matches m ON p.match_id = m.external_id\n            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n            LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n            LEFT JOIN ts_countries ctry ON c.country_id = ctry.external_id\n            WHERE p.match_id IS NOT NULL\n            ORDER BY p.created_at DESC\n            LIMIT $1\n        ";
                        return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
     * Get all predictions for a specific match (for match detail page)
     * Updated to use new 29-column schema with direct match_id link
     */
    AIPredictionService.prototype.getPredictionsByMatchId = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var query, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n            SELECT\n                p.id,\n                p.external_id,\n                p.canonical_bot_name as bot_name,\n                p.league_name,\n                p.home_team_name,\n                p.away_team_name,\n                p.score_at_prediction,\n                p.minute_at_prediction,\n                p.prediction,\n                p.prediction as prediction_value,\n                p.prediction as prediction_type,\n                p.prediction_threshold,\n                p.match_id,\n                p.result,\n                CASE\n                    WHEN p.result = 'won' THEN 'winner'\n                    WHEN p.result = 'lost' THEN 'loser'\n                    ELSE p.result\n                END as prediction_result,\n                p.final_score,\n                p.result_reason,\n                p.access_type,\n                p.source,\n                p.created_at,\n                80 as overall_confidence\n            FROM ai_predictions p\n            WHERE p.match_id = $1\n            ORDER BY p.created_at DESC\n        ";
                        return [4 /*yield*/, connection_1.pool.query(query, [matchId])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
         * Get predictions by bot name (for bot detail page)
         * Uses flexible matching to handle name variations (e.g. ALERT: D vs Alert D)
         */
    AIPredictionService.prototype.getPredictionsByBotName = function (botName_1) {
        return __awaiter(this, arguments, void 0, function (botName, limit) {
            var whereClause, params, safeLimit, normalized, usePattern, query, result;
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        whereClause = 'p.bot_name = $1';
                        params = [botName];
                        safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
                        normalized = botName.toLowerCase().trim();
                        usePattern = function (clause) {
                            whereClause = clause;
                            params = []; // No parameters used in WHERE clause
                        };
                        if (normalized.includes('alert d')) {
                            usePattern("(p.bot_name ILIKE '%Alert%D%' OR p.bot_name = 'ALERT: D')");
                        }
                        else if (normalized.includes('alert system')) {
                            usePattern("p.bot_name ILIKE '%Alert System%'");
                        }
                        else if (normalized.includes('code 35') || normalized.includes('code: 35')) {
                            usePattern("(p.bot_name ILIKE '%Code%35%' OR p.bot_name = 'CODE: 35')");
                        }
                        else if (normalized.includes('code zero')) {
                            usePattern("p.bot_name ILIKE '%Code%Zero%'");
                        }
                        else if (normalized.includes('algoritma 01') || normalized.includes('algoritma: 01')) {
                            usePattern("(p.bot_name ILIKE '%Algoritma%01%' OR p.bot_name = 'Algoritma: 01')");
                        }
                        query = "\n            SELECT\n                p.id,\n                p.external_id,\n                p.canonical_bot_name as bot_name,\n                p.league_name as league_name_raw,\n                p.home_team_name as home_team_name_raw,\n                p.away_team_name as away_team_name_raw,\n                p.score_at_prediction,\n                p.minute_at_prediction,\n                p.prediction,\n                p.prediction_threshold,\n                p.match_id,\n                p.result,\n                p.final_score,\n                p.result_reason,\n                p.access_type,\n                p.source,\n                p.created_at,\n                -- Backward compatibility aliases\n                m.external_id as match_external_id,\n                80 as overall_confidence,\n                CASE\n                    WHEN p.result = 'won' THEN 'winner'\n                    WHEN p.result = 'lost' THEN 'loser'\n                    ELSE p.result\n                END as prediction_result,\n                -- Team/Competition data\n                COALESCE(ht.name, p.home_team_name, 'Unknown Home') as home_team_name,\n                COALESCE(at.name, p.away_team_name, 'Unknown Away') as away_team_name,\n                COALESCE(c.name, p.league_name, 'Unknown League') as league_name\n            FROM ai_predictions p\n            LEFT JOIN ts_matches m ON p.match_id = m.external_id\n            LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n            LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n            LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n            WHERE ".concat(whereClause, "\n            ORDER BY p.created_at DESC\n            LIMIT ").concat(safeLimit, "\n        ");
                        return [4 /*yield*/, connection_1.pool.query(query, params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
     * Get available bot names with prediction counts
     */
    AIPredictionService.prototype.getBotStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n      SELECT \n        CASE\n            WHEN p.bot_name ILIKE '%Alert%D%' OR p.bot_name = 'ALERT: D' THEN 'Alert D'\n            WHEN p.bot_name ILIKE '%Alert System%' THEN 'Alert System'\n            WHEN p.bot_name ILIKE '%Code%35%' OR p.bot_name = 'CODE: 35' THEN 'Code 35'\n            WHEN p.bot_name ILIKE '%Code%Zero%' THEN 'Code Zero'\n            WHEN p.bot_name ILIKE '%Algoritma%01%' OR p.bot_name = 'Algoritma: 01' THEN 'Algoritma 01'\n            WHEN p.bot_name ILIKE '%BOT%007%' THEN 'BOT 007'\n            WHEN p.bot_name ILIKE '%70%Dakika%' THEN '70. Dakika Botu'\n            ELSE p.bot_name\n        END as bot_name,\n        COUNT(*) as count,\n        COUNT(*) FILTER (WHERE p.processed = false) as pending,\n        COUNT(*) FILTER (WHERE p.processed = true) as matched\n      FROM ai_predictions p\n      GROUP BY 1\n      ORDER BY count DESC\n    ";
                        return [4 /*yield*/, connection_1.pool.query(query)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
     * Update prediction results based on match outcome
     * REFACTORED: Uses new schema with direct match_id and p.result
     * NOTE: This is a fallback/cleanup method. Primary settlement is via predictionSettlement.service.ts
     */
    AIPredictionService.prototype.updatePredictionResults = function () {
        return __awaiter(this, void 0, void 0, function () {
            var client, pendingQuery, pending_1, updatedCount, _i, _a, row, period, finalHome, finalAway, hScores, aScores, htHome, htAway, hScores, aScores, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, , 8, 9]);
                        pendingQuery = "\n                SELECT\n                    p.id as prediction_id,\n                    p.match_id,\n                    p.prediction,\n                    p.prediction_threshold,\n                    p.score_at_prediction,\n                    p.minute_at_prediction,\n                    m.external_id as match_external_id,\n                    m.status_id,\n                    m.home_score_display,\n                    m.away_score_display,\n                    m.home_scores,\n                    m.away_scores\n                FROM ai_predictions p\n                JOIN ts_matches m ON p.match_id = m.external_id\n                WHERE p.result = 'pending'\n                  AND p.match_id IS NOT NULL\n                  AND m.status_id >= 2\n            ";
                        return [4 /*yield*/, client.query(pendingQuery)];
                    case 3:
                        pending_1 = _b.sent();
                        updatedCount = 0;
                        _i = 0, _a = pending_1.rows;
                        _b.label = 4;
                    case 4:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        row = _a[_i];
                        period = (row.minute_at_prediction || 0) <= 45 ? 'IY' : 'MS';
                        finalHome = row.home_score_display;
                        finalAway = row.away_score_display;
                        // Fallback to JSONB array if display score is NULL
                        if (finalHome === null || finalHome === undefined) {
                            try {
                                hScores = Array.isArray(row.home_scores) ? row.home_scores : JSON.parse(row.home_scores || '[]');
                                finalHome = hScores[0] !== undefined ? parseInt(hScores[0]) : 0;
                            }
                            catch (e) {
                                finalHome = 0;
                            }
                        }
                        else {
                            finalHome = finalHome !== null && finalHome !== void 0 ? finalHome : 0;
                        }
                        if (finalAway === null || finalAway === undefined) {
                            try {
                                aScores = Array.isArray(row.away_scores) ? row.away_scores : JSON.parse(row.away_scores || '[]');
                                finalAway = aScores[0] !== undefined ? parseInt(aScores[0]) : 0;
                            }
                            catch (e) {
                                finalAway = 0;
                            }
                        }
                        else {
                            finalAway = finalAway !== null && finalAway !== void 0 ? finalAway : 0;
                        }
                        htHome = 0;
                        htAway = 0;
                        try {
                            hScores = Array.isArray(row.home_scores) ? row.home_scores : JSON.parse(row.home_scores || '[]');
                            aScores = Array.isArray(row.away_scores) ? row.away_scores : JSON.parse(row.away_scores || '[]');
                            htHome = hScores[1] !== undefined ? parseInt(hScores[1]) : 0;
                            htAway = aScores[1] !== undefined ? parseInt(aScores[1]) : 0;
                        }
                        catch (e) {
                            // Fallback
                        }
                        result = this.calculatePredictionResultNew(row.prediction, row.prediction_threshold, row.score_at_prediction, finalHome, finalAway, htHome, htAway, period, row.status_id);
                        if (!result) return [3 /*break*/, 6];
                        // Update ai_predictions directly with new schema fields
                        return [4 /*yield*/, client.query("\n                        UPDATE ai_predictions\n                        SET\n                            result = $1,\n                            final_score = $2,\n                            result_reason = $3,\n                            updated_at = NOW()\n                        WHERE id = $4\n                    ", [
                                result.outcome === 'winner' ? 'won' : result.outcome === 'loser' ? 'lost' : result.outcome,
                                "".concat(row.home_score_display, "-").concat(row.away_score_display),
                                result.reason,
                                row.prediction_id
                            ])];
                    case 5:
                        // Update ai_predictions directly with new schema fields
                        _b.sent();
                        updatedCount++;
                        _b.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        if (updatedCount > 0) {
                            logger_1.logger.info("[AIPrediction] Updated ".concat(updatedCount, " prediction results (Instant/Final)"));
                        }
                        return [2 /*return*/, updatedCount];
                    case 8:
                        client.release();
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate if prediction was correct
     * Supports Instant Win logic for Live Matches
     */
    AIPredictionService.prototype.calculatePredictionResult = function (predictionType, predictionValue, scoreAtPrediction, finalHome, // Current Live Score if match is live
    finalAway, htHome, htAway, period, statusId) {
        var fullPrediction = "".concat(predictionType, " ").concat(predictionValue).toUpperCase();
        // Status Map:
        // 2: 1st Half, 3: HT, 4: 2nd Half, 8: FT, 9-13: OT/Pen/Ended
        var isMatchFinished = statusId >= 8;
        var isHalftimeReached = statusId >= 3;
        // Determine scores to use based on period
        // If Period is IY, but we are LIVE in 1st Half (Status 2), we use current scores to check for instant wins.
        // If Period is MS, we always use current scores to check for instant wins.
        var targetHome = finalHome;
        var targetAway = finalAway;
        // Specific check for IY finished
        if (period === 'IY' && isHalftimeReached) {
            targetHome = htHome;
            targetAway = htAway;
        }
        var totalGoals = targetHome + targetAway;
        // ---------------------------------------------------------
        // 1. OVER / ÜST Logic (Can WIN instantly)
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // 1. OVER / ÜST Logic (Can WIN instantly)
        // ---------------------------------------------------------
        // Try strict match first: "2.5 ÜST" or "ÜST 2.5"
        var overMatch = fullPrediction.match(/([\d.]+)\s*(ÜST|OVER|O)/i);
        if (!overMatch) {
            overMatch = fullPrediction.match(/(ÜST|OVER|O)\s*([\d.]+)/i); // Backwards
        }
        // Fallback: If just a number like "5.5" and NO "ALT/UNDER", assume ÜST
        if (!overMatch) {
            var bareNumber = fullPrediction.match(/(\d+\.5)/); // Match 0.5, 1.5, 5.5 etc specifically
            var isUnder = fullPrediction.match(/ALT|UNDER|U/i);
            if (bareNumber && !isUnder) {
                // Mock the match result structure [full, number, type]
                overMatch = [bareNumber[0], bareNumber[1], 'ÜST'];
            }
        }
        if (overMatch) {
            // Group 1 is number in regex 1, Group 2 in regex 2. 
            // Normalized handling: find the digit part
            var numStr = overMatch[1].match(/[\d.]/) ? overMatch[1] : overMatch[2];
            var line = parseFloat(numStr);
            var isOver = totalGoals > line;
            if (isOver) {
                // Instantly WIN, regardless of status (goals can't be un-scored)
                return {
                    outcome: 'winner',
                    reason: "Instant Win: Total Goals ".concat(totalGoals, " > ").concat(line, " (").concat(period, ")")
                };
            }
            // If not yet over, we can only lose if period is finished
            if (period === 'IY') {
                // Check IY specific status
                if (isHalftimeReached)
                    return { outcome: 'loser', reason: "Finished IY: ".concat(totalGoals, " <= ").concat(line) };
                return null; // Wait
            }
            else {
                // MS
                if (isMatchFinished)
                    return { outcome: 'loser', reason: "Finished MS: ".concat(totalGoals, " <= ").concat(line) };
                return null; // Wait
            }
        }
        // ---------------------------------------------------------
        // 2. BTTS YES / VAR Logic (Can WIN instantly)
        // ---------------------------------------------------------
        if (fullPrediction.includes('VAR') || fullPrediction.includes('KG VAR') || fullPrediction.includes('BTTSYES')) {
            var btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return {
                    outcome: 'winner',
                    reason: "Instant Win: Both teams scored (".concat(period, ")")
                };
            }
            if (period === 'IY') {
                if (isHalftimeReached)
                    return { outcome: 'loser', reason: "Finished IY: BTTS No" };
                return null;
            }
            else {
                if (isMatchFinished)
                    return { outcome: 'loser', reason: "Finished MS: BTTS No" };
                return null;
            }
        }
        // ---------------------------------------------------------
        // 3. UNDER / ALT (Can LOSE instantly, but we settle usually at end?)
        //    Actually, if Total > Line, we LOSE instantly.
        // ---------------------------------------------------------
        var underMatch = fullPrediction.match(/([\d.]+)\s*(ALT|UNDER|U)/i);
        if (underMatch) {
            var line = parseFloat(underMatch[1]);
            var isOver = totalGoals > line; // Opposed to Under
            if (isOver) {
                // Instantly LOSE (Line exceeded)
                return {
                    outcome: 'loser',
                    reason: "Instant Loss: Total Goals ".concat(totalGoals, " > ").concat(line, " (").concat(period, ")")
                };
            }
            // To WIN, we must wait for period end
            if (period === 'IY') {
                if (isHalftimeReached)
                    return { outcome: 'winner', reason: "Finished IY: Under ".concat(line) };
                return null;
            }
            else {
                if (isMatchFinished)
                    return { outcome: 'winner', reason: "Finished MS: Under ".concat(line) };
                return null;
            }
        }
        // ---------------------------------------------------------
        // 4. BTTS NO / YOK (Can LOSE instantly)
        // ---------------------------------------------------------
        if (fullPrediction.includes('YOK') || fullPrediction.includes('KG YOK') || fullPrediction.includes('BTTSNO')) {
            var btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return {
                    outcome: 'loser',
                    reason: "Instant Loss: Both teams scored (".concat(period, ")")
                };
            }
            if (period === 'IY') {
                if (isHalftimeReached)
                    return { outcome: 'winner', reason: "Finished IY: BTTS No" };
                return null;
            }
            else {
                if (isMatchFinished)
                    return { outcome: 'winner', reason: "Finished MS: BTTS No" };
                return null;
            }
        }
        // ---------------------------------------------------------
        // 5. 1/X/2 (Result) - Must wait for End of Period
        //    (Unless mathematically impossible? No, always possible in football)
        // ---------------------------------------------------------
        // Determine if we can settle (must be finished)
        var canSettle = false;
        if (period === 'IY' && isHalftimeReached)
            canSettle = true;
        if (period === 'MS' && isMatchFinished)
            canSettle = true;
        if (!canSettle)
            return null; // Wait for end
        // Logic for 1/X/2 at end of period
        var isHomeWin = targetHome > targetAway;
        var isAwayWin = targetAway > targetHome;
        var isDraw = targetHome === targetAway;
        if (fullPrediction.match(/\b(MS 1|HOME WIN|IY 1|1\.Y 1)\b/)) {
            return {
                outcome: isHomeWin ? 'winner' : 'loser',
                reason: "Score: ".concat(targetHome, "-").concat(targetAway, " (").concat(period, ")")
            };
        }
        if (fullPrediction.match(/\b(MS 2|AWAY WIN|IY 2|1\.Y 2)\b/)) {
            return {
                outcome: isAwayWin ? 'winner' : 'loser',
                reason: "Score: ".concat(targetHome, "-").concat(targetAway, " (").concat(period, ")")
            };
        }
        if (fullPrediction.match(/\b(MS X|DRAW|IY X|1\.Y X|BERABERE)\b/)) {
            return {
                outcome: isDraw ? 'winner' : 'loser',
                reason: "Score: ".concat(targetHome, "-").concat(targetAway, " (").concat(period, ")")
            };
        }
        if (predictionValue === '1')
            return { outcome: isHomeWin ? 'winner' : 'loser', reason: "Score: ".concat(targetHome, "-").concat(targetAway) };
        if (predictionValue === '2')
            return { outcome: isAwayWin ? 'winner' : 'loser', reason: "Score: ".concat(targetHome, "-").concat(targetAway) };
        if (predictionValue === 'X' || predictionValue === '0')
            return { outcome: isDraw ? 'winner' : 'loser', reason: "Score: ".concat(targetHome, "-").concat(targetAway) };
        return null;
    };
    /**
     * Calculate prediction result using NEW SCHEMA
     * SIMPLIFIED: Uses unified prediction field and numeric threshold
     * @param prediction - Unified field like "MS 0.5 ÜST", "IY 1.5 ÜST"
     * @param threshold - Numeric threshold like 0.5, 1.5, 2.5
     */
    AIPredictionService.prototype.calculatePredictionResultNew = function (prediction, threshold, scoreAtPrediction, finalHome, finalAway, htHome, htAway, period, statusId) {
        var predUpper = (prediction || '').toUpperCase();
        // Status Map: 2: 1st Half, 3: HT, 4: 2nd Half, 8: FT
        var isMatchFinished = statusId >= 8;
        var isHalftimeReached = statusId >= 3;
        // Determine scores based on period
        var targetHome = finalHome;
        var targetAway = finalAway;
        if (period === 'IY' && isHalftimeReached) {
            targetHome = htHome;
            targetAway = htAway;
        }
        var totalGoals = targetHome + targetAway;
        // OVER / ÜST Logic - Most common case
        if (predUpper.includes('ÜST') || predUpper.includes('OVER')) {
            if (totalGoals > threshold) {
                return {
                    outcome: 'winner',
                    reason: "Instant Win: ".concat(totalGoals, " > ").concat(threshold, " (").concat(period, ")")
                };
            }
            // Can only lose if period is finished
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'loser', reason: "IY Finished: ".concat(totalGoals, " <= ").concat(threshold) };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'loser', reason: "MS Finished: ".concat(totalGoals, " <= ").concat(threshold) };
            }
            return null; // Wait
        }
        // UNDER / ALT Logic
        if (predUpper.includes('ALT') || predUpper.includes('UNDER')) {
            if (totalGoals > threshold) {
                return {
                    outcome: 'loser',
                    reason: "Instant Loss: ".concat(totalGoals, " > ").concat(threshold, " (").concat(period, ")")
                };
            }
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'winner', reason: "IY Finished: ".concat(totalGoals, " <= ").concat(threshold) };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'winner', reason: "MS Finished: ".concat(totalGoals, " <= ").concat(threshold) };
            }
            return null; // Wait
        }
        // KG VAR / BTTS YES
        if (predUpper.includes('KG VAR') || predUpper.includes('BTTS')) {
            var btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return { outcome: 'winner', reason: "Both teams scored (".concat(period, ")") };
            }
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'loser', reason: "IY Finished: BTTS No" };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'loser', reason: "MS Finished: BTTS No" };
            }
            return null;
        }
        // KG YOK / BTTS NO
        if (predUpper.includes('KG YOK')) {
            var btts = targetHome > 0 && targetAway > 0;
            if (btts) {
                return { outcome: 'loser', reason: "Both teams scored (".concat(period, ")") };
            }
            if (period === 'IY' && isHalftimeReached) {
                return { outcome: 'winner', reason: "IY Finished: BTTS No" };
            }
            if (period === 'MS' && isMatchFinished) {
                return { outcome: 'winner', reason: "MS Finished: BTTS No" };
            }
            return null;
        }
        // 1/X/2 Result - Must wait for period end
        var canSettle = false;
        if (period === 'IY' && isHalftimeReached)
            canSettle = true;
        if (period === 'MS' && isMatchFinished)
            canSettle = true;
        if (!canSettle)
            return null;
        var isHomeWin = targetHome > targetAway;
        var isAwayWin = targetAway > targetHome;
        var isDraw = targetHome === targetAway;
        if (predUpper.includes('MS 1') || predUpper.includes('IY 1')) {
            return { outcome: isHomeWin ? 'winner' : 'loser', reason: "Score: ".concat(targetHome, "-").concat(targetAway) };
        }
        if (predUpper.includes('MS 2') || predUpper.includes('IY 2')) {
            return { outcome: isAwayWin ? 'winner' : 'loser', reason: "Score: ".concat(targetHome, "-").concat(targetAway) };
        }
        if (predUpper.includes('MS X') || predUpper.includes('MS 0') || predUpper.includes('IY X')) {
            return { outcome: isDraw ? 'winner' : 'loser', reason: "Score: ".concat(targetHome, "-").concat(targetAway) };
        }
        return null;
    };
    /**
     * Update display_prediction text for a prediction
     * This is the admin-editable text shown to users
     */
    AIPredictionService.prototype.updateDisplayPrediction = function (predictionId, displayText) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, connection_1.pool.query("UPDATE ai_predictions \n                 SET display_prediction = $1, updated_at = NOW() \n                 WHERE id = $2\n                 RETURNING id", [displayText.trim() || null, predictionId])];
                    case 1:
                        result = _a.sent();
                        if (result.rowCount && result.rowCount > 0) {
                            logger_1.logger.info("[AIPrediction] Updated display_prediction for ".concat(predictionId, ": \"").concat(displayText, "\""));
                            return [2 /*return*/, true];
                        }
                        return [2 /*return*/, false];
                    case 2:
                        error_4 = _a.sent();
                        logger_1.logger.error('[AIPrediction] Failed to update display_prediction:', error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Bulk update display_prediction for multiple predictions
     */
    AIPredictionService.prototype.bulkUpdateDisplayPrediction = function (updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updatedCount, _i, updates_1, update, success;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        updatedCount = 0;
                        _i = 0, updates_1 = updates;
                        _a.label = 1;
                    case 1:
                        if (!(_i < updates_1.length)) return [3 /*break*/, 4];
                        update = updates_1[_i];
                        return [4 /*yield*/, this.updateDisplayPrediction(update.id, update.displayText)];
                    case 2:
                        success = _a.sent();
                        if (success)
                            updatedCount++;
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, updatedCount];
                }
            });
        });
    };
    /**
     * Get predictions with display_prediction set (for user-facing components)
     * Only returns predictions that have admin-defined display text
     * REFACTORED: Uses new schema with direct match_id
     */
    AIPredictionService.prototype.getDisplayablePredictions = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var query, result;
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n            SELECT\n                p.id,\n                p.external_id,\n                p.canonical_bot_name as bot_name,\n                p.prediction as display_prediction,\n                p.minute_at_prediction,\n                p.created_at,\n                p.match_id,\n                p.result,\n                m.external_id as match_external_id,\n                80 as overall_confidence,\n                CASE\n                    WHEN p.result = 'won' THEN 'winner'\n                    WHEN p.result = 'lost' THEN 'loser'\n                    ELSE p.result\n                END as prediction_result\n            FROM ai_predictions p\n            LEFT JOIN ts_matches m ON p.match_id = m.external_id\n            WHERE p.prediction IS NOT NULL\n              AND p.prediction != ''\n              AND p.match_id IS NOT NULL\n            ORDER BY p.created_at DESC\n            LIMIT $1\n        ";
                        return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    /**
     * Settle predictions for a specific match (auto settlement)
     * Called when match ends (status_id >= 8) OR transitions to HT (status_id = 3)
     *
     * @deprecated This method is deprecated. Use predictionSettlementService.settleMatchPredictions() instead.
     * This wrapper is kept for backward compatibility only.
     *
     * REFACTORED: Now redirects to predictionSettlementService for centralized settlement logic.
     */
    AIPredictionService.prototype.settleMatchPredictions = function (matchExternalId, overridingStatusId, overridingHomeScore, overridingAwayScore) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.warn("[AIPrediction] DEPRECATED: settleMatchPredictions called for ".concat(matchExternalId, ". Use predictionSettlementService instead."));
                        return [4 /*yield*/, predictionSettlement_service_1.predictionSettlementService.settleMatchPredictions(matchExternalId, overridingHomeScore, overridingAwayScore, overridingHomeScore, // htHome - using same as overridingHomeScore for backward compat
                            overridingAwayScore // htAway - using same as overridingAwayScore for backward compat
                            )];
                    case 1: 
                    // Redirect to centralized settlement service
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Check for INSTANT WIN when a goal is scored
     * Called by WebSocketService on GOAL event
     *
     * @deprecated This method is deprecated. Use predictionSettlementService.settleInstantWin() instead.
     * This wrapper is kept for backward compatibility only.
     *
     * REFACTORED: Now redirects to predictionSettlementService for centralized settlement logic.
     */
    AIPredictionService.prototype.settleInstantWin = function (matchExternalId, homeScore, awayScore, minute, overridingStatusId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.warn("[AIPrediction] DEPRECATED: settleInstantWin called for ".concat(matchExternalId, ". Use predictionSettlementService instead."));
                        // Redirect to centralized settlement service
                        return [4 /*yield*/, predictionSettlement_service_1.predictionSettlementService.settleInstantWin(matchExternalId, homeScore, awayScore, minute, overridingStatusId)];
                    case 1:
                        // Redirect to centralized settlement service
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get manual predictions (Alert System bot)
     * REFACTORED: Uses new schema with direct match_id
     */
    AIPredictionService.prototype.getManualPredictions = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var query, res;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n            SELECT\n                p.id,\n                p.external_id,\n                p.canonical_bot_name as bot_name,\n                p.league_name,\n                p.home_team_name,\n                p.away_team_name,\n                p.score_at_prediction,\n                p.minute_at_prediction,\n                p.prediction,\n                p.prediction as prediction_type,\n                p.prediction as prediction_value,\n                p.prediction_threshold,\n                p.processed,\n                p.created_at,\n                p.access_type,\n                p.match_id,\n                p.result,\n                CASE\n                    WHEN p.result = 'won' THEN 'winner'\n                    WHEN p.result = 'lost' THEN 'loser'\n                    ELSE p.result\n                END as prediction_result,\n                m.external_id as match_external_id,\n                80 as overall_confidence\n            FROM ai_predictions p\n            LEFT JOIN ts_matches m ON p.match_id = m.external_id\n            WHERE p.canonical_bot_name = 'Alert System'\n            ORDER BY p.created_at DESC\n            LIMIT $1\n        ";
                        return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.rows];
                }
            });
        });
    };
    AIPredictionService.prototype.createManualPrediction = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var client, thresholdMatch, threshold, leagueName, matchQuery, predictionId, externalId, botName, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 8, 10, 11]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _a.sent();
                        thresholdMatch = data.prediction.match(/(\d+\.?\d*)/);
                        threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.5;
                        leagueName = data.league;
                        if (!(!leagueName || leagueName.trim() === '' || leagueName === '-')) return [3 /*break*/, 5];
                        return [4 /*yield*/, client.query("\n                    SELECT c.name as competition_name\n                    FROM ts_matches m\n                    LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n                    WHERE m.id = $1\n                ", [data.match_id])];
                    case 4:
                        matchQuery = _a.sent();
                        if (matchQuery.rows.length > 0 && matchQuery.rows[0].competition_name) {
                            leagueName = matchQuery.rows[0].competition_name;
                            logger_1.logger.info("[AIPrediction] Manuel tahmin i\u00E7in lig bilgisi ma\u00E7tan al\u0131nd\u0131: ".concat(leagueName));
                        }
                        _a.label = 5;
                    case 5:
                        predictionId = crypto.randomUUID();
                        externalId = "manual_".concat(Date.now(), "_").concat(Math.floor(Math.random() * 1000));
                        botName = data.bot_name || 'Alert_System';
                        // Insert into ai_predictions with NEW 29-column schema
                        return [4 /*yield*/, client.query("\n                INSERT INTO ai_predictions (\n                    id, external_id, canonical_bot_name, league_name,\n                    home_team_name, away_team_name, score_at_prediction,\n                    minute_at_prediction, prediction, prediction_threshold,\n                    match_id, result, access_type, source, created_at, coupon_id\n                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)\n            ", [
                                predictionId,
                                externalId,
                                botName,
                                leagueName || '',
                                data.home_team,
                                data.away_team,
                                data.score,
                                data.minute,
                                data.prediction,
                                threshold,
                                data.match_id,
                                'pending',
                                data.access_type,
                                'manual',
                                data.coupon_id || null
                            ])];
                    case 6:
                        // Insert into ai_predictions with NEW 29-column schema
                        _a.sent();
                        logger_1.logger.info("[AIPrediction] Manuel tahmin olu\u015Fturuldu: ".concat(data.prediction, " - ").concat(data.home_team, " vs ").concat(data.away_team, " (match_id: ").concat(data.match_id, ")"));
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 7:
                        _a.sent();
                        return [2 /*return*/, { id: predictionId, prediction: data.prediction }];
                    case 8:
                        error_5 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 9:
                        _a.sent();
                        logger_1.logger.error('[AIPredictions] Create Manual Prediction Error:', error_5);
                        return [2 /*return*/, null];
                    case 10:
                        client.release();
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new Coupon with multiple predictions
     */
    AIPredictionService.prototype.createCoupon = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var client, couponId, successCount, _i, _a, item, thresholdMatch, threshold, leagueName, matchQuery, predictionId, externalId, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 12, 14, 15]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _b.sent();
                        couponId = crypto.randomUUID();
                        return [4 /*yield*/, client.query("\n                INSERT INTO ai_coupons (id, title, access_type, status, created_at)\n                VALUES ($1, $2, $3, 'pending', NOW())\n            ", [couponId, data.title, data.access_type])];
                    case 4:
                        _b.sent();
                        successCount = 0;
                        _i = 0, _a = data.items;
                        _b.label = 5;
                    case 5:
                        if (!(_i < _a.length)) return [3 /*break*/, 10];
                        item = _a[_i];
                        thresholdMatch = item.prediction.match(/(\d+\.?\d*)/);
                        threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.5;
                        leagueName = item.league;
                        if (!(!leagueName || leagueName.trim() === '' || leagueName === '-')) return [3 /*break*/, 7];
                        return [4 /*yield*/, client.query("\n                        SELECT c.name as competition_name\n                        FROM ts_matches m\n                        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n                        WHERE m.id = $1\n                    ", [item.match_id])];
                    case 6:
                        matchQuery = _b.sent();
                        if (matchQuery.rows.length > 0 && matchQuery.rows[0].competition_name) {
                            leagueName = matchQuery.rows[0].competition_name;
                        }
                        _b.label = 7;
                    case 7:
                        predictionId = crypto.randomUUID();
                        externalId = "manual_coupon_".concat(Date.now(), "_").concat(Math.floor(Math.random() * 1000));
                        return [4 /*yield*/, client.query("\n                    INSERT INTO ai_predictions (\n                        id, external_id, canonical_bot_name, league_name,\n                        home_team_name, away_team_name, score_at_prediction,\n                        minute_at_prediction, prediction, prediction_threshold,\n                        match_id, result, access_type, source, created_at, coupon_id\n                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)\n                ", [
                                predictionId,
                                externalId,
                                'Coupon Bot', // Distinct bot name for coupons
                                leagueName || '',
                                item.home_team,
                                item.away_team,
                                item.score,
                                item.minute,
                                item.prediction,
                                threshold,
                                item.match_id,
                                'pending',
                                data.access_type, // Inherit from Coupon
                                'manual_coupon',
                                couponId
                            ])];
                    case 8:
                        _b.sent();
                        successCount++;
                        _b.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10:
                        logger_1.logger.info("[AIPrediction] Coupon created: ".concat(data.title, " with ").concat(successCount, " items"));
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 11:
                        _b.sent();
                        return [2 /*return*/, { id: couponId, title: data.title, count: successCount }];
                    case 12:
                        error_6 = _b.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 13:
                        _b.sent();
                        logger_1.logger.error('[AIPredictions] Create Coupon Error:', error_6);
                        return [2 /*return*/, null];
                    case 14:
                        client.release();
                        return [7 /*endfinally*/];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    return AIPredictionService;
}());
exports.AIPredictionService = AIPredictionService;
exports.aiPredictionService = new AIPredictionService();
