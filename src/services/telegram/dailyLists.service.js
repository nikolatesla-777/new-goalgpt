"use strict";
/**
 * Telegram Daily Lists Service
 *
 * Generates daily prediction lists for Telegram channel:
 * - Over 2.5 Goals
 * - BTTS (Both Teams To Score)
 * - First Half Over 0.5 Goals
 *
 * DATABASE-FIRST APPROACH:
 * - Lists generated ONCE per day, stored in database
 * - Lists remain STABLE throughout the day
 * - Started matches STAY in list for performance tracking
 * - 3-5 matches per list max
 * - Confidence-based filtering (prefer HIGH/MEDIUM)
 * - Skip if insufficient data
 *
 * @author GoalGPT Team
 * @version 2.0.0 - Database persistence added
 */
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
exports.generateDailyLists = generateDailyLists;
exports.formatDailyListMessage = formatDailyListMessage;
exports.getDailyLists = getDailyLists;
exports.getDailyListsByDateRange = getDailyListsByDateRange;
exports.refreshDailyLists = refreshDailyLists;
var footystats_client_1 = require("../footystats/footystats.client");
var logger_1 = require("../../utils/logger");
var connection_1 = require("../../database/connection");
// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================
/**
 * Calculate confidence score for Over 2.5 market
 */
function calculateOver25Confidence(match) {
    var _a, _b, _c, _d, _e;
    var score = 0;
    var factors = 0;
    // Potential (max 40 points)
    if ((_a = match.potentials) === null || _a === void 0 ? void 0 : _a.over25) {
        score += (match.potentials.over25 / 100) * 40;
        factors++;
    }
    // xG Total (max 30 points)
    if (((_b = match.xg) === null || _b === void 0 ? void 0 : _b.home) && ((_c = match.xg) === null || _c === void 0 ? void 0 : _c.away)) {
        var totalXg = match.xg.home + match.xg.away;
        if (totalXg >= 3.0)
            score += 30;
        else if (totalXg >= 2.5)
            score += 20;
        else if (totalXg >= 2.0)
            score += 10;
        factors++;
    }
    // BTTS correlation (max 20 points)
    if ((_d = match.potentials) === null || _d === void 0 ? void 0 : _d.btts) {
        score += (match.potentials.btts / 100) * 20;
        factors++;
    }
    // Avg potential (max 10 points)
    if ((_e = match.potentials) === null || _e === void 0 ? void 0 : _e.avg) {
        score += (match.potentials.avg / 100) * 10;
        factors++;
    }
    // If less than 2 factors, return 0 (insufficient data)
    if (factors < 2)
        return 0;
    return Math.round(score);
}
/**
 * Calculate confidence score for BTTS market
 */
function calculateBTTSConfidence(match) {
    var _a, _b, _c, _d;
    var score = 0;
    var factors = 0;
    // BTTS Potential (max 50 points)
    if ((_a = match.potentials) === null || _a === void 0 ? void 0 : _a.btts) {
        score += (match.potentials.btts / 100) * 50;
        factors++;
    }
    // xG balance (max 30 points) - both teams should have decent xG
    if (((_b = match.xg) === null || _b === void 0 ? void 0 : _b.home) && ((_c = match.xg) === null || _c === void 0 ? void 0 : _c.away)) {
        var minXg = Math.min(match.xg.home, match.xg.away);
        if (minXg >= 1.0)
            score += 30;
        else if (minXg >= 0.7)
            score += 20;
        else if (minXg >= 0.5)
            score += 10;
        factors++;
    }
    // Over 2.5 correlation (max 20 points)
    if ((_d = match.potentials) === null || _d === void 0 ? void 0 : _d.over25) {
        score += (match.potentials.over25 / 100) * 20;
        factors++;
    }
    // If less than 2 factors, return 0
    if (factors < 2)
        return 0;
    return Math.round(score);
}
/**
 * Calculate confidence score for First Half Over 0.5 market
 */
function calculateHTOver05Confidence(match) {
    var _a, _b, _c, _d, _e;
    var score = 0;
    var factors = 0;
    // Total xG as proxy for attacking intent (max 40 points)
    if (((_a = match.xg) === null || _a === void 0 ? void 0 : _a.home) && ((_b = match.xg) === null || _b === void 0 ? void 0 : _b.away)) {
        var totalXg = match.xg.home + match.xg.away;
        if (totalXg >= 2.5)
            score += 40;
        else if (totalXg >= 2.0)
            score += 30;
        else if (totalXg >= 1.5)
            score += 20;
        factors++;
    }
    // Over 2.5 potential (max 30 points)
    if ((_c = match.potentials) === null || _c === void 0 ? void 0 : _c.over25) {
        score += (match.potentials.over25 / 100) * 30;
        factors++;
    }
    // BTTS potential (max 20 points)
    if ((_d = match.potentials) === null || _d === void 0 ? void 0 : _d.btts) {
        score += (match.potentials.btts / 100) * 20;
        factors++;
    }
    // Avg potential (max 10 points)
    if ((_e = match.potentials) === null || _e === void 0 ? void 0 : _e.avg) {
        score += (match.potentials.avg / 100) * 10;
        factors++;
    }
    // If less than 2 factors, return 0
    if (factors < 2)
        return 0;
    return Math.round(score);
}
/**
 * Calculate confidence score for Corners market
 */
function calculateCornersConfidence(match) {
    var _a, _b, _c, _d, _e;
    var score = 0;
    var factors = 0;
    // Corners potential as primary indicator (max 50 points)
    if ((_a = match.potentials) === null || _a === void 0 ? void 0 : _a.corners) {
        var corners = match.potentials.corners;
        // Score based on expected corner count
        if (corners >= 12)
            score += 50;
        else if (corners >= 10)
            score += 40;
        else if (corners >= 9)
            score += 30;
        else if (corners >= 8)
            score += 20;
        else
            score += 10;
        factors++;
    }
    // Over 2.5 correlation (attacking intent) (max 25 points)
    if ((_b = match.potentials) === null || _b === void 0 ? void 0 : _b.over25) {
        score += (match.potentials.over25 / 100) * 25;
        factors++;
    }
    // Total xG correlation (max 15 points)
    if (((_c = match.xg) === null || _c === void 0 ? void 0 : _c.home) && ((_d = match.xg) === null || _d === void 0 ? void 0 : _d.away)) {
        var totalXg = match.xg.home + match.xg.away;
        if (totalXg >= 3.0)
            score += 15;
        else if (totalXg >= 2.5)
            score += 10;
        else if (totalXg >= 2.0)
            score += 5;
        factors++;
    }
    // Avg potential (max 10 points)
    if ((_e = match.potentials) === null || _e === void 0 ? void 0 : _e.avg) {
        score += (match.potentials.avg / 100) * 10;
        factors++;
    }
    // If less than 2 factors, return 0
    if (factors < 2)
        return 0;
    return Math.round(score);
}
/**
 * Calculate confidence score for Cards market
 */
function calculateCardsConfidence(match) {
    var _a, _b, _c, _d;
    var score = 0;
    var factors = 0;
    // Cards potential as primary indicator (max 50 points)
    if ((_a = match.potentials) === null || _a === void 0 ? void 0 : _a.cards) {
        var cards = match.potentials.cards;
        // Score based on expected card count
        if (cards >= 6)
            score += 50;
        else if (cards >= 5)
            score += 40;
        else if (cards >= 4.5)
            score += 30;
        else if (cards >= 4)
            score += 20;
        else
            score += 10;
        factors++;
    }
    // BTTS correlation (competitive match) (max 25 points)
    if ((_b = match.potentials) === null || _b === void 0 ? void 0 : _b.btts) {
        score += (match.potentials.btts / 100) * 25;
        factors++;
    }
    // Over 2.5 correlation (max 15 points)
    if ((_c = match.potentials) === null || _c === void 0 ? void 0 : _c.over25) {
        score += (match.potentials.over25 / 100) * 15;
        factors++;
    }
    // Avg potential (max 10 points)
    if ((_d = match.potentials) === null || _d === void 0 ? void 0 : _d.avg) {
        score += (match.potentials.avg / 100) * 10;
        factors++;
    }
    // If less than 2 factors, return 0
    if (factors < 2)
        return 0;
    return Math.round(score);
}
/**
 * Calculate confidence score for Over 1.5 goals market
 */
function calculateOver15Confidence(match) {
    var _a, _b, _c, _d;
    var score = 0;
    var factors = 0;
    // Over 1.5 potential as primary indicator (max 50 points)
    if ((_a = match.potentials) === null || _a === void 0 ? void 0 : _a.over15) {
        var over15 = match.potentials.over15;
        // Score based on percentage
        if (over15 >= 90)
            score += 50;
        else if (over15 >= 85)
            score += 45;
        else if (over15 >= 80)
            score += 40;
        else if (over15 >= 75)
            score += 35;
        else if (over15 >= 70)
            score += 30;
        else
            score += 20;
        factors++;
    }
    // Total xG as strong indicator (max 30 points)
    if (((_b = match.xg) === null || _b === void 0 ? void 0 : _b.home) && ((_c = match.xg) === null || _c === void 0 ? void 0 : _c.away)) {
        var totalXg = match.xg.home + match.xg.away;
        if (totalXg >= 2.5)
            score += 30;
        else if (totalXg >= 2.0)
            score += 25;
        else if (totalXg >= 1.5)
            score += 20;
        else if (totalXg >= 1.2)
            score += 10;
        factors++;
    }
    // Over 2.5 correlation (max 20 points)
    if ((_d = match.potentials) === null || _d === void 0 ? void 0 : _d.over25) {
        score += (match.potentials.over25 / 100) * 20;
        factors++;
    }
    // If less than 2 factors, return 0
    if (factors < 2)
        return 0;
    return Math.round(score);
}
// ============================================================================
// FILTERING & SELECTION
// ============================================================================
/**
 * Filter matches by market and confidence threshold
 */
function filterMatchesByMarket(matches, market, minConfidence) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    if (minConfidence === void 0) { minConfidence = 50; }
    var candidates = [];
    for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
        var match = matches_1[_i];
        // ✅ NO STATUS FILTER - Include all matches (started or not)
        // Lists are stored in database and remain stable throughout the day
        // Calculate confidence based on market
        var confidence = 0;
        var reason = '';
        switch (market) {
            case 'OVER_25':
                confidence = calculateOver25Confidence(match);
                reason = "O2.5: %".concat(((_a = match.potentials) === null || _a === void 0 ? void 0 : _a.over25) || 0, ", xG: ").concat(((((_b = match.xg) === null || _b === void 0 ? void 0 : _b.home) || 0) + (((_c = match.xg) === null || _c === void 0 ? void 0 : _c.away) || 0)).toFixed(1));
                break;
            case 'OVER_15':
                confidence = calculateOver15Confidence(match);
                reason = "O1.5: %".concat(((_d = match.potentials) === null || _d === void 0 ? void 0 : _d.over15) || 0, ", xG: ").concat(((((_e = match.xg) === null || _e === void 0 ? void 0 : _e.home) || 0) + (((_f = match.xg) === null || _f === void 0 ? void 0 : _f.away) || 0)).toFixed(1));
                break;
            case 'BTTS':
                confidence = calculateBTTSConfidence(match);
                reason = "BTTS: %".concat(((_g = match.potentials) === null || _g === void 0 ? void 0 : _g.btts) || 0, ", xG: ").concat((((_h = match.xg) === null || _h === void 0 ? void 0 : _h.home) || 0).toFixed(1), "-").concat((((_j = match.xg) === null || _j === void 0 ? void 0 : _j.away) || 0).toFixed(1));
                break;
            case 'HT_OVER_05':
                confidence = calculateHTOver05Confidence(match);
                reason = "\u0130Y Potansiyel, xG: ".concat(((((_k = match.xg) === null || _k === void 0 ? void 0 : _k.home) || 0) + (((_l = match.xg) === null || _l === void 0 ? void 0 : _l.away) || 0)).toFixed(1));
                break;
            case 'CORNERS':
                confidence = calculateCornersConfidence(match);
                reason = "Korner: ".concat(((_o = (_m = match.potentials) === null || _m === void 0 ? void 0 : _m.corners) === null || _o === void 0 ? void 0 : _o.toFixed(1)) || 0, ", O2.5: %").concat(((_p = match.potentials) === null || _p === void 0 ? void 0 : _p.over25) || 0);
                break;
            case 'CARDS':
                confidence = calculateCardsConfidence(match);
                reason = "Kart: ".concat(((_r = (_q = match.potentials) === null || _q === void 0 ? void 0 : _q.cards) === null || _r === void 0 ? void 0 : _r.toFixed(1)) || 0, ", BTTS: %").concat(((_s = match.potentials) === null || _s === void 0 ? void 0 : _s.btts) || 0);
                break;
        }
        // Skip if below threshold or insufficient data
        if (confidence < minConfidence)
            continue;
        candidates.push({ match: match, confidence: confidence, reason: reason });
    }
    // Sort by confidence descending
    return candidates.sort(function (a, b) { return b.confidence - a.confidence; });
}
/**
 * Select top matches for a list (max 5)
 */
function selectTopMatches(candidates, maxMatches) {
    if (maxMatches === void 0) { maxMatches = 5; }
    // Prefer HIGH (>70) and MEDIUM (50-70) confidence
    var high = candidates.filter(function (c) { return c.confidence >= 70; });
    var medium = candidates.filter(function (c) { return c.confidence >= 50 && c.confidence < 70; });
    var selected = [];
    // Strategy: Fill with HIGH first, then MEDIUM if needed
    if (high.length >= 3) {
        selected = high.slice(0, maxMatches);
    }
    else if (high.length + medium.length >= 3) {
        selected = __spreadArray(__spreadArray([], high, true), medium, true).slice(0, maxMatches);
    }
    else {
        // Not enough matches
        return [];
    }
    return selected;
}
// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================
/**
 * Generate all daily lists for Telegram
 *
 * @returns Array of DailyList objects (empty if no eligible matches)
 */
function generateDailyLists() {
    return __awaiter(this, void 0, void 0, function () {
        var response, rawMatches, fsIds, leagueMap_1, safeQuery_1, leagueResults, allMatches, lists, timestamp, over25Candidates, over25Selected, over15Candidates, over15Selected, bttsCandiates, bttsSelected, htOver05Candidates, htOver05Selected, cornersCandidates, cornersSelected, cardsCandidates, cardsSelected, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info('[TelegramDailyLists] 🚀 Starting daily list generation...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, footystats_client_1.footyStatsAPI.getTodaysMatches()];
                case 2:
                    response = _a.sent();
                    rawMatches = response.data || [];
                    fsIds = rawMatches.map(function (m) { return m.id; });
                    leagueMap_1 = new Map();
                    if (!(fsIds.length > 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../../database/connection')); })];
                case 3:
                    safeQuery_1 = (_a.sent()).safeQuery;
                    return [4 /*yield*/, safeQuery_1("SELECT fs_id,\n                COALESCE(c.name, 'Unknown') as league_name\n         FROM ts_matches m\n         LEFT JOIN ts_competitions c ON c.id = m.competition_id\n         WHERE m.fs_id = ANY($1::integer[])", [fsIds])];
                case 4:
                    leagueResults = _a.sent();
                    leagueResults.forEach(function (row) {
                        leagueMap_1.set(row.fs_id, row.league_name);
                    });
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCCB Mapped ".concat(leagueMap_1.size, " league names from database"));
                    _a.label = 5;
                case 5:
                    allMatches = rawMatches.map(function (m) { return ({
                        fs_id: m.id,
                        home_name: m.home_name,
                        away_name: m.away_name,
                        league_name: leagueMap_1.get(m.id) || m.competition_name || m.league_name || 'Unknown',
                        date_unix: m.date_unix,
                        status: m.status,
                        potentials: {
                            btts: m.btts_potential,
                            over25: m.o25_potential,
                            over15: m.o15_potential, // ✅ ADD: Over 1.5 potential
                            avg: m.avg_potential,
                            corners: m.corners_potential, // ✅ ADD: Match corner potential
                            cards: m.cards_potential, // ✅ ADD: Match card potential
                        },
                        xg: {
                            home: m.team_a_xg_prematch,
                            away: m.team_b_xg_prematch,
                        },
                        odds: {
                            home: m.odds_ft_1,
                            draw: m.odds_ft_x,
                            away: m.odds_ft_2,
                        },
                    }); });
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCCA Fetched ".concat(allMatches.length, " matches from FootyStats"));
                    if (allMatches.length === 0) {
                        logger_1.logger.warn('[TelegramDailyLists] ⚠️ No matches available today');
                        return [2 /*return*/, []];
                    }
                    lists = [];
                    timestamp = Date.now();
                    over25Candidates = filterMatchesByMarket(allMatches, 'OVER_25', 55);
                    over25Selected = selectTopMatches(over25Candidates, 5);
                    if (over25Selected.length >= 3) {
                        lists.push({
                            market: 'OVER_25',
                            title: 'Günün 2.5 ÜST Maçları',
                            emoji: '📈',
                            matches: over25Selected,
                            generated_at: timestamp,
                        });
                        logger_1.logger.info("[TelegramDailyLists] \u2705 Over 2.5 list: ".concat(over25Selected.length, " matches"));
                    }
                    else {
                        logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F Over 2.5 list: Insufficient matches (".concat(over25Selected.length, ")"));
                    }
                    over15Candidates = filterMatchesByMarket(allMatches, 'OVER_15', 55);
                    over15Selected = selectTopMatches(over15Candidates, 10);
                    if (over15Selected.length >= 5) {
                        lists.push({
                            market: 'OVER_15',
                            title: 'Günün 1.5 ÜST Maçları',
                            emoji: '🎯',
                            matches: over15Selected,
                            generated_at: timestamp,
                        });
                        logger_1.logger.info("[TelegramDailyLists] \u2705 Over 1.5 list: ".concat(over15Selected.length, " matches"));
                    }
                    else {
                        logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F Over 1.5 list: Insufficient matches (".concat(over15Selected.length, ")"));
                    }
                    bttsCandiates = filterMatchesByMarket(allMatches, 'BTTS', 55);
                    bttsSelected = selectTopMatches(bttsCandiates, 5);
                    if (bttsSelected.length >= 3) {
                        lists.push({
                            market: 'BTTS',
                            title: 'Günün BTTS Maçları',
                            emoji: '⚽',
                            matches: bttsSelected,
                            generated_at: timestamp,
                        });
                        logger_1.logger.info("[TelegramDailyLists] \u2705 BTTS list: ".concat(bttsSelected.length, " matches"));
                    }
                    else {
                        logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F BTTS list: Insufficient matches (".concat(bttsSelected.length, ")"));
                    }
                    htOver05Candidates = filterMatchesByMarket(allMatches, 'HT_OVER_05', 50);
                    htOver05Selected = selectTopMatches(htOver05Candidates, 5);
                    if (htOver05Selected.length >= 3) {
                        lists.push({
                            market: 'HT_OVER_05',
                            title: 'Günün İY 0.5 ÜST Maçları',
                            emoji: '⏱️',
                            matches: htOver05Selected,
                            generated_at: timestamp,
                        });
                        logger_1.logger.info("[TelegramDailyLists] \u2705 HT Over 0.5 list: ".concat(htOver05Selected.length, " matches"));
                    }
                    else {
                        logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F HT Over 0.5 list: Insufficient matches (".concat(htOver05Selected.length, ")"));
                    }
                    cornersCandidates = filterMatchesByMarket(allMatches, 'CORNERS', 50);
                    cornersSelected = selectTopMatches(cornersCandidates, 5);
                    if (cornersSelected.length >= 3) {
                        lists.push({
                            market: 'CORNERS',
                            title: 'Günün KORNER Maçları',
                            emoji: '🚩',
                            matches: cornersSelected,
                            generated_at: timestamp,
                        });
                        logger_1.logger.info("[TelegramDailyLists] \u2705 Corners list: ".concat(cornersSelected.length, " matches"));
                    }
                    else {
                        logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F Corners list: Insufficient matches (".concat(cornersSelected.length, ")"));
                    }
                    cardsCandidates = filterMatchesByMarket(allMatches, 'CARDS', 50);
                    cardsSelected = selectTopMatches(cardsCandidates, 5);
                    if (cardsSelected.length >= 3) {
                        lists.push({
                            market: 'CARDS',
                            title: 'Günün KART Maçları',
                            emoji: '🟨',
                            matches: cardsSelected,
                            generated_at: timestamp,
                        });
                        logger_1.logger.info("[TelegramDailyLists] \u2705 Cards list: ".concat(cardsSelected.length, " matches"));
                    }
                    else {
                        logger_1.logger.warn("[TelegramDailyLists] \u26A0\uFE0F Cards list: Insufficient matches (".concat(cardsSelected.length, ")"));
                    }
                    // 3. Log final result
                    if (lists.length === 0) {
                        logger_1.logger.warn('[TelegramDailyLists] ❌ NO_ELIGIBLE_MATCHES - No lists generated');
                    }
                    else {
                        logger_1.logger.info("[TelegramDailyLists] \uD83C\uDFAF Generated ".concat(lists.length, " lists successfully"));
                    }
                    return [2 /*return*/, lists];
                case 6:
                    error_1 = _a.sent();
                    logger_1.logger.error('[TelegramDailyLists] ❌ Error generating lists:', error_1);
                    throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Format a daily list as Telegram message
 */
function formatDailyListMessage(list) {
    var emoji = list.emoji, title = list.title, matches = list.matches;
    var message = "".concat(emoji, " <b>").concat(title.toUpperCase(), "</b>\n\n");
    matches.forEach(function (candidate, index) {
        var match = candidate.match, confidence = candidate.confidence, reason = candidate.reason;
        var nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        var num = nums[index] || "".concat(index + 1, "\uFE0F\u20E3");
        var matchTime = new Date(match.date_unix * 1000);
        var timeStr = matchTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        var confidenceEmoji = confidence >= 70 ? '🔥' : '⭐';
        message += "".concat(num, " <b>").concat(match.home_name, " vs ").concat(match.away_name, "</b>\n");
        message += "\uD83D\uDD52 ".concat(timeStr, " | \uD83C\uDFC6 ").concat(match.league_name || 'Bilinmiyor', "\n");
        message += "".concat(confidenceEmoji, " G\u00FCven: ").concat(confidence, "/100\n");
        message += "\uD83D\uDCCA ".concat(reason, "\n\n");
    });
    message += "\u26A0\uFE0F <b>Not:</b>\n";
    message += "\u2022 Liste istatistiksel verilere dayan\u0131r\n";
    message += "\u2022 Canl\u0131ya girmeden \u00F6nce oran ve kadro kontrol\u00FC \u00F6nerilir\n";
    return message;
}
// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================
/**
 * Save daily lists to database
 */
function saveDailyListsToDatabase(date, lists) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, lists_1, list, matchesCount, avgConfidence, preview, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCBE Saving ".concat(lists.length, " lists to database for ").concat(date, "..."));
                    _i = 0, lists_1 = lists;
                    _a.label = 1;
                case 1:
                    if (!(_i < lists_1.length)) return [3 /*break*/, 6];
                    list = lists_1[_i];
                    matchesCount = list.matches.length;
                    avgConfidence = Math.round(list.matches.reduce(function (sum, m) { return sum + m.confidence; }, 0) / matchesCount);
                    preview = formatDailyListMessage(list);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, connection_1.safeQuery)("INSERT INTO telegram_daily_lists\n          (market, list_date, title, emoji, matches_count, avg_confidence, matches, preview, generated_at)\n         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9))\n         ON CONFLICT (market, list_date)\n         DO UPDATE SET\n           matches = EXCLUDED.matches,\n           matches_count = EXCLUDED.matches_count,\n           avg_confidence = EXCLUDED.avg_confidence,\n           preview = EXCLUDED.preview,\n           updated_at = NOW()", [
                            list.market,
                            date,
                            list.title,
                            list.emoji,
                            matchesCount,
                            avgConfidence,
                            JSON.stringify(list.matches),
                            preview,
                            list.generated_at / 1000,
                        ])];
                case 3:
                    _a.sent();
                    logger_1.logger.info("[TelegramDailyLists] \u2705 Saved ".concat(list.market, " list (").concat(matchesCount, " matches)"));
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    logger_1.logger.error("[TelegramDailyLists] \u274C Failed to save ".concat(list.market, " list:"), error_2);
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get daily lists from database
 */
function getDailyListsFromDatabase(date) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, lists, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDD0D Checking database for lists on ".concat(date, "..."));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT market, title, emoji, matches, matches_count, avg_confidence, preview,\n              EXTRACT(EPOCH FROM generated_at)::bigint * 1000 as generated_at\n       FROM telegram_daily_lists\n       WHERE list_date = $1\n       ORDER BY\n         CASE market\n           WHEN 'OVER_25' THEN 1\n           WHEN 'OVER_15' THEN 2\n           WHEN 'BTTS' THEN 3\n           WHEN 'HT_OVER_05' THEN 4\n           WHEN 'CORNERS' THEN 5\n           WHEN 'CARDS' THEN 6\n         END", [date])];
                case 2:
                    rows = _a.sent();
                    if (rows.length === 0) {
                        logger_1.logger.info("[TelegramDailyLists] \u26A0\uFE0F No lists found in database for ".concat(date));
                        return [2 /*return*/, null];
                    }
                    lists = rows.map(function (row) { return ({
                        market: row.market,
                        title: row.title,
                        emoji: row.emoji,
                        matches: JSON.parse(row.matches),
                        matches_count: row.matches_count,
                        avg_confidence: row.avg_confidence,
                        preview: row.preview,
                        generated_at: Number(row.generated_at),
                    }); });
                    logger_1.logger.info("[TelegramDailyLists] \u2705 Loaded ".concat(lists.length, " lists from database"));
                    return [2 /*return*/, lists];
                case 3:
                    error_3 = _a.sent();
                    logger_1.logger.error("[TelegramDailyLists] \u274C Database query failed:", error_3);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get daily lists (database-first, generate if missing)
 *
 * @param date - ISO date string (YYYY-MM-DD), defaults to today
 * @returns Array of DailyList objects
 */
function getDailyLists(date) {
    return __awaiter(this, void 0, void 0, function () {
        var targetDate, cachedLists, newLists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCC5 Getting lists for ".concat(targetDate, "..."));
                    return [4 /*yield*/, getDailyListsFromDatabase(targetDate)];
                case 1:
                    cachedLists = _a.sent();
                    if (cachedLists && cachedLists.length > 0) {
                        logger_1.logger.info("[TelegramDailyLists] \u2705 Using cached lists from database");
                        return [2 /*return*/, cachedLists];
                    }
                    // 2. Cache miss - generate new lists
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDD04 Cache miss - generating new lists...");
                    return [4 /*yield*/, generateDailyLists()];
                case 2:
                    newLists = _a.sent();
                    if (!(newLists.length > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, saveDailyListsToDatabase(targetDate, newLists)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, newLists];
            }
        });
    });
}
/**
 * Get daily lists by date range (for historical analysis)
 *
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param endDate - ISO date string (YYYY-MM-DD)
 * @returns Array of DailyList objects grouped by date
 */
function getDailyListsByDateRange(startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, listsByDate, _i, rows_1, row, date, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDCC5 Getting lists from ".concat(startDate, " to ").concat(endDate, "..."));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, connection_1.safeQuery)("SELECT list_date, market, title, emoji, matches, matches_count, avg_confidence, preview,\n              EXTRACT(EPOCH FROM generated_at)::bigint * 1000 as generated_at\n       FROM telegram_daily_lists\n       WHERE list_date >= $1 AND list_date <= $2\n       ORDER BY list_date DESC,\n         CASE market\n           WHEN 'OVER_25' THEN 1\n           WHEN 'OVER_15' THEN 2\n           WHEN 'BTTS' THEN 3\n           WHEN 'HT_OVER_05' THEN 4\n           WHEN 'CORNERS' THEN 5\n           WHEN 'CARDS' THEN 6\n         END", [startDate, endDate])];
                case 2:
                    rows = _a.sent();
                    listsByDate = {};
                    for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                        row = rows_1[_i];
                        date = row.list_date;
                        if (!listsByDate[date]) {
                            listsByDate[date] = [];
                        }
                        listsByDate[date].push({
                            market: row.market,
                            title: row.title,
                            emoji: row.emoji,
                            matches: JSON.parse(row.matches),
                            matches_count: row.matches_count,
                            avg_confidence: row.avg_confidence,
                            preview: row.preview,
                            generated_at: Number(row.generated_at),
                        });
                    }
                    logger_1.logger.info("[TelegramDailyLists] \u2705 Loaded lists for ".concat(Object.keys(listsByDate).length, " dates"));
                    return [2 /*return*/, listsByDate];
                case 3:
                    error_4 = _a.sent();
                    logger_1.logger.error("[TelegramDailyLists] \u274C Date range query failed:", error_4);
                    return [2 /*return*/, {}];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Force refresh daily lists (admin function)
 *
 * @param date - ISO date string (YYYY-MM-DD), defaults to today
 * @returns Array of DailyList objects
 */
function refreshDailyLists(date) {
    return __awaiter(this, void 0, void 0, function () {
        var targetDate, newLists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
                    logger_1.logger.info("[TelegramDailyLists] \uD83D\uDD04 FORCE REFRESH for ".concat(targetDate, "..."));
                    return [4 /*yield*/, generateDailyLists()];
                case 1:
                    newLists = _a.sent();
                    if (!(newLists.length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, saveDailyListsToDatabase(targetDate, newLists)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, newLists];
            }
        });
    });
}
