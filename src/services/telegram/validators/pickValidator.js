"use strict";
/**
 * PHASE-2A: Pick Validator
 *
 * Purpose: Validate picks before saving to database
 *
 * Rules:
 * 1. Market type must be supported
 * 2. Odds must be present (if required)
 * 3. No duplicate picks for same post
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_MARKETS = void 0;
exports.isSupportedMarket = isSupportedMarket;
exports.validatePicks = validatePicks;
exports.getMarketName = getMarketName;
exports.getMarketLabelTurkish = getMarketLabelTurkish;
var logger_1 = require("../../../utils/logger");
/**
 * PHASE-2A: Supported market types
 * Only these markets can be published and settled
 */
exports.SUPPORTED_MARKETS = [
    'BTTS_YES', // Both Teams To Score
    'O25_OVER', // Over 2.5 Goals
    'O15_OVER', // Over 1.5 Goals
    'HT_O05_OVER', // Half-Time Over 0.5 Goals
];
/**
 * PHASE-2A: Validate market type
 *
 * @param marketType - Market type string (e.g., 'BTTS_YES')
 * @returns true if supported
 */
function isSupportedMarket(marketType) {
    return exports.SUPPORTED_MARKETS.includes(marketType);
}
/**
 * PHASE-2A: Validate all picks before saving
 *
 * @param picks - Array of picks to validate
 * @param postId - Post ID (for logging)
 * @returns Validation result
 */
function validatePicks(picks, postId) {
    // RULE 1: At least one pick required
    if (!picks || picks.length === 0) {
        var logContext_1 = { post_id: postId, picks_count: 0 };
        logger_1.logger.warn('[PickValidator] ❌ No picks provided', logContext_1);
        return {
            valid: false,
            error: 'At least one pick is required',
            errorCode: 'NO_PICKS',
        };
    }
    var logContext = { post_id: postId, picks_count: picks.length };
    var invalidPicks = [];
    // RULE 2: Validate each pick
    for (var _i = 0, picks_1 = picks; _i < picks_1.length; _i++) {
        var pick = picks_1[_i];
        // Check market type
        if (!pick.market_type) {
            invalidPicks.push('Missing market_type');
            continue;
        }
        if (!isSupportedMarket(pick.market_type)) {
            invalidPicks.push("Unsupported market: ".concat(pick.market_type));
            logger_1.logger.warn('[PickValidator] ❌ Unsupported market type', __assign(__assign({}, logContext), { market_type: pick.market_type, supported_markets: exports.SUPPORTED_MARKETS }));
        }
        // RULE 2B: Validate odds (OPTIONAL but must be valid if provided)
        // Odds are displayed in Telegram messages as @1.85
        // If provided, must be numeric and within reasonable range
        if (pick.odds !== null && pick.odds !== undefined) {
            var odds = pick.odds;
            // Check if numeric
            if (typeof odds !== 'number' || isNaN(odds)) {
                invalidPicks.push("Invalid odds for ".concat(pick.market_type, ": not a number"));
                logger_1.logger.warn('[PickValidator] ❌ Invalid odds: not numeric', __assign(__assign({}, logContext), { market_type: pick.market_type, odds: odds }));
                continue;
            }
            // Check range (betting odds typically 1.01 to 100.00)
            if (odds < 1.01 || odds > 100.0) {
                invalidPicks.push("Invalid odds for ".concat(pick.market_type, ": ").concat(odds, " (must be 1.01-100.00)"));
                logger_1.logger.warn('[PickValidator] ❌ Invalid odds: out of range', __assign(__assign({}, logContext), { market_type: pick.market_type, odds: odds, valid_range: '1.01-100.00' }));
            }
        }
    }
    // RULE 3: Check for duplicates
    var marketTypes = picks.map(function (p) { return p.market_type; });
    var uniqueMarkets = new Set(marketTypes);
    if (marketTypes.length !== uniqueMarkets.size) {
        var duplicates = marketTypes.filter(function (item, index) { return marketTypes.indexOf(item) !== index; });
        invalidPicks.push("Duplicate markets: ".concat(duplicates.join(', ')));
        logger_1.logger.warn('[PickValidator] ❌ Duplicate market types', __assign(__assign({}, logContext), { duplicates: duplicates }));
    }
    // Return validation result
    if (invalidPicks.length > 0) {
        logger_1.logger.warn('[PickValidator] ❌ Pick validation failed', __assign(__assign({}, logContext), { invalid_picks: invalidPicks }));
        return {
            valid: false,
            error: invalidPicks.join('; '),
            errorCode: 'INVALID_PICKS',
            invalidPicks: invalidPicks,
        };
    }
    logger_1.logger.info('[PickValidator] ✅ All picks valid', logContext);
    return { valid: true };
}
/**
 * PHASE-2A: Get human-readable market name
 */
function getMarketName(marketType) {
    var marketNames = {
        BTTS_YES: 'Both Teams To Score',
        O25_OVER: 'Over 2.5 Goals',
        O15_OVER: 'Over 1.5 Goals',
        HT_O05_OVER: 'Half-Time Over 0.5 Goals',
    };
    return marketNames[marketType] || marketType;
}
/**
 * PHASE-2A: Get Turkish market label (for messages)
 */
function getMarketLabelTurkish(marketType) {
    var labels = {
        BTTS_YES: 'BTTS',
        O25_OVER: 'Üst 2.5',
        O15_OVER: 'Üst 1.5',
        HT_O05_OVER: 'İY Üst 0.5',
    };
    return labels[marketType] || marketType;
}
