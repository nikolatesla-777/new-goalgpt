"use strict";
/**
 * Turkish Message Formatter
 *
 * Formats match data into Turkish Telegram messages with:
 * - Match header (teams, league, time)
 * - Confidence score (PHASE-2B)
 * - Statistics (BTTS, Over/Under potentials)
 * - Expected Goals (xG)
 * - Form analysis
 * - Head-to-head stats
 * - Turkish trends (Ev/Dep sections)
 * - Prediction markets
 * - Betting odds
 *
 * @author GoalGPT Team
 * @version 1.1.0 - PHASE-2B: Confidence Score
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTelegramMessage = formatTelegramMessage;
var trends_generator_1 = require("./trends.generator");
var confidenceScorer_service_1 = require("./confidenceScorer.service");
var logger_1 = require("../../utils/logger");
/**
 * Format complete Telegram message in Turkish
 *
 * PHASE-2B: Now includes confidence score
 */
function formatTelegramMessage(matchData, picks, confidenceScore) {
    var _a, _b, _c, _d;
    if (picks === void 0) { picks = []; }
    var home_name = matchData.home_name, away_name = matchData.away_name, league_name = matchData.league_name, date_unix = matchData.date_unix, potentials = matchData.potentials, xg = matchData.xg, odds = matchData.odds, form = matchData.form, h2h = matchData.h2h, trends = matchData.trends;
    // Date formatting
    var matchDate = new Date(date_unix * 1000);
    var timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    var dateStr = matchDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    var message = "\u26BD <b>".concat(home_name, " vs ").concat(away_name, "</b>\n");
    message += "\uD83C\uDFC6 ".concat(league_name || 'Bilinmeyen Lig', " | \uD83D\uDD50 ").concat(dateStr, " ").concat(timeStr, "\n");
    // PHASE-2B: Add confidence score
    if (confidenceScore) {
        message += "".concat((0, confidenceScorer_service_1.formatConfidenceScoreForTelegram)(confidenceScore), "\n");
    }
    message += "\n";
    // Potentials section
    if ((potentials === null || potentials === void 0 ? void 0 : potentials.btts) || (potentials === null || potentials === void 0 ? void 0 : potentials.over25) || (potentials === null || potentials === void 0 ? void 0 : potentials.over15)) {
        message += "\uD83D\uDCCA <b>\u0130statistikler:</b>\n";
        if (potentials.btts)
            message += "\u2022 BTTS: %".concat(potentials.btts, " \u26BD\u26BD\n");
        if (potentials.over25)
            message += "\u2022 Alt/\u00DCst 2.5: %".concat(potentials.over25, "\n");
        if (potentials.over15)
            message += "\u2022 Alt/\u00DCst 1.5: %".concat(potentials.over15, "\n");
        message += "\n";
    }
    // xG section
    if ((xg === null || xg === void 0 ? void 0 : xg.home) !== undefined && (xg === null || xg === void 0 ? void 0 : xg.away) !== undefined) {
        message += "\u26A1 <b>Beklenen Gol (xG):</b>\n";
        message += "".concat(home_name, ": ").concat(xg.home.toFixed(2), " | ").concat(away_name, ": ").concat(xg.away.toFixed(2), "\n");
        message += "Toplam: ".concat((xg.home + xg.away).toFixed(2), "\n\n");
    }
    // Form section
    if (((_a = form === null || form === void 0 ? void 0 : form.home) === null || _a === void 0 ? void 0 : _a.ppg) || ((_b = form === null || form === void 0 ? void 0 : form.away) === null || _b === void 0 ? void 0 : _b.ppg)) {
        message += "\uD83D\uDCC8 <b>Form (Puan/Ma\u00E7):</b>\n";
        if ((_c = form.home) === null || _c === void 0 ? void 0 : _c.ppg)
            message += "".concat(home_name, ": ").concat(form.home.ppg.toFixed(1), " PPG\n");
        if ((_d = form.away) === null || _d === void 0 ? void 0 : _d.ppg)
            message += "".concat(away_name, ": ").concat(form.away.ppg.toFixed(1), " PPG\n");
        message += "\n";
    }
    // H2H section
    if (h2h === null || h2h === void 0 ? void 0 : h2h.total_matches) {
        message += "\uD83E\uDD1D <b>Kafa Kafaya (".concat(h2h.total_matches, " ma\u00E7):</b>\n");
        message += "".concat(h2h.home_wins || 0, "G-").concat(h2h.draws || 0, "B-").concat(h2h.away_wins || 0, "M\n");
        if (h2h.avg_goals)
            message += "Ort. ".concat(h2h.avg_goals.toFixed(1), " gol\n");
        if (h2h.btts_pct)
            message += "BTTS: %".concat(h2h.btts_pct, "\n");
        message += "\n";
    }
    // Turkish trends with 2-section structure
    var trendData = (0, trends_generator_1.generateTurkishTrends)(home_name, away_name, {
        potentials: potentials,
        xg: xg,
        form: form,
        h2h: h2h,
        trends: trends,
    });
    // DEBUG: Log trends data
    logger_1.logger.info('[TurkishFormatter] Trend data generated:', {
        home_count: trendData.home.length,
        away_count: trendData.away.length,
        home: trendData.home,
        away: trendData.away,
    });
    if (trendData.home.length > 0) {
        message += "\uD83E\uDDE0 <b>Trendler (Ev):</b>\n";
        trendData.home.forEach(function (trend) {
            message += "\u2022 ".concat(trend, "\n");
        });
        message += "\n";
    }
    if (trendData.away.length > 0) {
        message += "\uD83E\uDDE0 <b>Trendler (Dep):</b>\n";
        trendData.away.forEach(function (trend) {
            message += "\u2022 ".concat(trend, "\n");
        });
        message += "\n";
    }
    // Picks section
    if (picks.length > 0) {
        message += "\uD83C\uDFAF <b>Tahmini Piyasalar:</b>\n";
        picks.forEach(function (pick) {
            var label = {
                BTTS_YES: 'Karşılıklı Gol (BTTS)',
                O25_OVER: 'Alt/Üst 2.5 Gol',
                O15_OVER: 'Alt/Üst 1.5 Gol',
                HT_O05_OVER: 'İlk Yarı 0.5 Üst',
            }[pick.market_type] || pick.market_type;
            var oddsStr = pick.odds ? " @".concat(pick.odds.toFixed(2)) : '';
            message += "\u2022 ".concat(label).concat(oddsStr, "\n");
        });
        message += "\n";
    }
    // Odds section
    if ((odds === null || odds === void 0 ? void 0 : odds.home) && (odds === null || odds === void 0 ? void 0 : odds.draw) && (odds === null || odds === void 0 ? void 0 : odds.away)) {
        message += "\uD83D\uDCB0 <b>Oranlar:</b> ".concat(odds.home.toFixed(2), " | ").concat(odds.draw.toFixed(2), " | ").concat(odds.away.toFixed(2));
    }
    return message;
}
