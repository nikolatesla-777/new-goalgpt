"use strict";
/**
 * Confidence Scorer Service
 *
 * Calculates confidence scores for match predictions (PHASE-2B)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidenceScore = calculateConfidenceScore;
exports.formatConfidenceScoreForTelegram = formatConfidenceScoreForTelegram;
/**
 * Calculate confidence score based on match data
 */
function calculateConfidenceScore(matchData) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var score = 50; // Base score
    // Adjust based on potentials
    if (((_a = matchData.potentials) === null || _a === void 0 ? void 0 : _a.btts) && matchData.potentials.btts >= 70) {
        score += 10;
    }
    if (((_b = matchData.potentials) === null || _b === void 0 ? void 0 : _b.over25) && matchData.potentials.over25 >= 65) {
        score += 10;
    }
    // Adjust based on xG
    if (((_c = matchData.xg) === null || _c === void 0 ? void 0 : _c.home) && ((_d = matchData.xg) === null || _d === void 0 ? void 0 : _d.away)) {
        var totalXG = matchData.xg.home + matchData.xg.away;
        if (totalXG >= 2.5) {
            score += 10;
        }
    }
    // Adjust based on form
    if (((_f = (_e = matchData.form) === null || _e === void 0 ? void 0 : _e.home) === null || _f === void 0 ? void 0 : _f.ppg) && ((_h = (_g = matchData.form) === null || _g === void 0 ? void 0 : _g.away) === null || _h === void 0 ? void 0 : _h.ppg)) {
        var avgPPG = (matchData.form.home.ppg + matchData.form.away.ppg) / 2;
        if (avgPPG >= 1.8) {
            score += 5;
        }
    }
    // Cap at 0-100
    score = Math.max(0, Math.min(100, score));
    // Determine level
    var level;
    var emoji;
    if (score >= 75) {
        level = 'high';
        emoji = '🔥';
    }
    else if (score >= 50) {
        level = 'medium';
        emoji = '⭐';
    }
    else {
        level = 'low';
        emoji = '⚠️';
    }
    return { score: score, level: level, emoji: emoji };
}
/**
 * Format confidence score for Telegram message
 */
function formatConfidenceScoreForTelegram(confidence) {
    var levelText = {
        high: 'Yüksek',
        medium: 'Orta',
        low: 'Düşük',
    }[confidence.level];
    return "".concat(confidence.emoji, " <b>G\u00FCven Skoru:</b> ").concat(confidence.score, "/100 (").concat(levelText, ")");
}
