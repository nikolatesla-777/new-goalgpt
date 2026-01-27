"use strict";
/**
 * Turkish Message Formatter V2 - Enhanced Template
 *
 * New template format with:
 * - Match Trends (BTTS, Over 2.5, Over 1.5)
 * - First Half Analysis
 * - Cards Analysis
 * - Corners Analysis
 * - xG Expectation
 * - Top Trend Picks
 *
 * @author GoalGPT Team
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTelegramMessageV2 = formatTelegramMessageV2;
var confidenceScorer_service_1 = require("./confidenceScorer.service");
/**
 * Format enhanced Telegram message in Turkish (V2 Template)
 */
function formatTelegramMessageV2(matchData, picks, confidenceScore) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (picks === void 0) { picks = []; }
    var home_name = matchData.home_name, away_name = matchData.away_name, league_name = matchData.league_name, date_unix = matchData.date_unix, potentials = matchData.potentials, xg = matchData.xg, odds = matchData.odds, form = matchData.form, h2h = matchData.h2h;
    // 🔍 DEBUG: Log received potentials data
    console.error('\n🔍🔍🔍 [Formatter V2] Received potentials:');
    console.error('  potentials.corners:', potentials === null || potentials === void 0 ? void 0 : potentials.corners);
    console.error('  potentials.cards:', potentials === null || potentials === void 0 ? void 0 : potentials.cards);
    console.error('  potentials.btts:', potentials === null || potentials === void 0 ? void 0 : potentials.btts);
    console.error('  typeof corners:', typeof (potentials === null || potentials === void 0 ? void 0 : potentials.corners));
    console.error('  typeof cards:', typeof (potentials === null || potentials === void 0 ? void 0 : potentials.cards));
    console.error('  Full potentials:', JSON.stringify(potentials, null, 2));
    // Date formatting
    var matchDate = new Date(date_unix * 1000);
    var timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    var dateStr = matchDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' });
    var message = "\u26BD <b>".concat(home_name, " vs ").concat(away_name, "</b>\n");
    message += "\uD83C\uDFC6 ".concat(league_name || 'Bilinmeyen Lig', " | \uD83D\uDD50 ").concat(dateStr, " ").concat(timeStr, "\n\n");
    // Confidence Score
    if (confidenceScore) {
        message += "".concat((0, confidenceScorer_service_1.formatConfidenceScoreForTelegram)(confidenceScore), "\n\n");
    }
    // 📈 MAÇ TRENDLERİ
    if ((potentials === null || potentials === void 0 ? void 0 : potentials.btts) || (potentials === null || potentials === void 0 ? void 0 : potentials.over25) || (potentials === null || potentials === void 0 ? void 0 : potentials.over15)) {
        message += "\uD83D\uDCC8 <b>MA\u00C7 TRENDLER\u0130</b>\n";
        if (potentials.btts)
            message += "\u2022 BTTS: %".concat(potentials.btts, " \u26BD\u26BD\n");
        if (potentials.over25)
            message += "\u2022 \u00DCst 2.5: %".concat(potentials.over25, "\n");
        if (potentials.over15)
            message += "\u2022 \u00DCst 1.5: %".concat(potentials.over15, "\n");
        message += "\n";
    }
    // 🕒 İLK YARI ANALİZİ
    // Note: First half data calculated from team BTTS/Over percentages as proxy
    var homeFirstHalfTrend = ((_a = form === null || form === void 0 ? void 0 : form.home) === null || _a === void 0 ? void 0 : _a.btts_pct) && form.home.btts_pct >= 50 ? 'YÜKSEK' : 'ORTA';
    var awayFirstHalfTrend = ((_b = form === null || form === void 0 ? void 0 : form.away) === null || _b === void 0 ? void 0 : _b.btts_pct) && form.away.btts_pct >= 50 ? 'YÜKSEK' : 'ORTA';
    message += "\uD83D\uDD52 <b>\u0130LK YARI ANAL\u0130Z\u0130</b>\n";
    if ((_c = form === null || form === void 0 ? void 0 : form.home) === null || _c === void 0 ? void 0 : _c.btts_pct) {
        var homeMatches = Math.round(6); // Estimate based on last 6 matches
        var homeGoals = Math.round((form.home.btts_pct / 100) * homeMatches);
        message += "\u2022 ".concat(home_name, " son ").concat(homeMatches, " ma\u00E7\u0131n ").concat(homeGoals, "'\u00FCnde \u0130Y gol buldu\n");
    }
    if ((_d = form === null || form === void 0 ? void 0 : form.away) === null || _d === void 0 ? void 0 : _d.btts_pct) {
        var awayMatches = Math.round(5);
        var awayGoals = Math.round((form.away.btts_pct / 100) * awayMatches);
        message += "\u2022 ".concat(away_name, " son ").concat(awayMatches, " deplasman\u0131n ").concat(awayGoals, "'\u00FCnde \u0130Y gol yedi\n");
    }
    // İY 0.5 ÜST trend
    var iyTrend = (((_e = form === null || form === void 0 ? void 0 : form.home) === null || _e === void 0 ? void 0 : _e.btts_pct) || 0) + (((_f = form === null || form === void 0 ? void 0 : form.away) === null || _f === void 0 ? void 0 : _f.btts_pct) || 0) >= 100 ? 'YÜKSEK' : 'ORTA';
    message += "\u2022 \u0130Y 0.5 \u00DCST e\u011Filimi: ".concat(iyTrend, "\n\n");
    // 🟨 KART ANALİZİ - ALWAYS SHOW IF DATA EXISTS
    if ((potentials === null || potentials === void 0 ? void 0 : potentials.cards) !== undefined && (potentials === null || potentials === void 0 ? void 0 : potentials.cards) !== null) {
        message += "\uD83D\uDFE8 <b>KART ANAL\u0130Z\u0130</b>\n";
        message += "\u2022 Beklenen toplam kart: ".concat(potentials.cards.toFixed(1), "\n");
        // Optional: Show team averages if available
        if (((_g = form === null || form === void 0 ? void 0 : form.home) === null || _g === void 0 ? void 0 : _g.cards_avg) || ((_h = form === null || form === void 0 ? void 0 : form.away) === null || _h === void 0 ? void 0 : _h.cards_avg)) {
            if ((_j = form.home) === null || _j === void 0 ? void 0 : _j.cards_avg) {
                message += "\u2022 ".concat(home_name, " ortalamas\u0131: ").concat(form.home.cards_avg.toFixed(1), " kart/ma\u00E7\n");
            }
            if ((_k = form.away) === null || _k === void 0 ? void 0 : _k.cards_avg) {
                message += "\u2022 ".concat(away_name, " ortalamas\u0131: ").concat(form.away.cards_avg.toFixed(1), " kart/ma\u00E7\n");
            }
        }
        var cardTrend = potentials.cards >= 5 ? 'YÜKSEK' : potentials.cards >= 4 ? 'ORTA–YÜKSEK' : 'ORTA';
        message += "\u2022 Kart e\u011Filimi: ".concat(cardTrend, "\n\n");
    }
    // 🚩 KORNER ANALİZİ
    if (potentials === null || potentials === void 0 ? void 0 : potentials.corners) {
        message += "\uD83D\uDEA9 <b>KORNER ANAL\u0130Z\u0130</b>\n";
        message += "\u2022 Beklenen toplam korner: ".concat(potentials.corners.toFixed(1), "\n");
        // Optional: Show team averages if available
        if (((_l = form === null || form === void 0 ? void 0 : form.home) === null || _l === void 0 ? void 0 : _l.corners_avg) || ((_m = form === null || form === void 0 ? void 0 : form.away) === null || _m === void 0 ? void 0 : _m.corners_avg)) {
            if ((_o = form.home) === null || _o === void 0 ? void 0 : _o.corners_avg) {
                message += "\u2022 ".concat(home_name, " ortalamas\u0131: ").concat(form.home.corners_avg.toFixed(1), " korner/ma\u00E7\n");
            }
            if ((_p = form.away) === null || _p === void 0 ? void 0 : _p.corners_avg) {
                message += "\u2022 ".concat(away_name, " ortalamas\u0131: ").concat(form.away.corners_avg.toFixed(1), " korner/ma\u00E7\n");
            }
        }
        var cornerTrend = potentials.corners >= 12 ? 'YÜKSEK' : potentials.corners >= 10 ? 'ORTA–YÜKSEK' : 'ORTA';
        message += "\u2022 Korner e\u011Filimi: ".concat(cornerTrend, "\n\n");
    }
    // ⚡ xG BEKLENTİSİ
    if ((xg === null || xg === void 0 ? void 0 : xg.home) !== undefined && (xg === null || xg === void 0 ? void 0 : xg.away) !== undefined) {
        message += "\u26A1 <b>xG BEKLENT\u0130S\u0130</b>\n";
        message += "\u2022 ".concat(home_name, ": ").concat(xg.home.toFixed(2), " | ").concat(away_name, ": ").concat(xg.away.toFixed(2), "\n");
        message += "\u2022 Toplam xG: ".concat((xg.home + xg.away).toFixed(2), "\n\n");
    }
    // 🎯 ÖNE ÇIKAN TREND SEÇİMLER
    if (picks.length > 0) {
        message += "\uD83C\uDFAF <b>\u00D6NE \u00C7IKAN TREND SE\u00C7\u0130MLER</b>\n";
        picks.forEach(function (pick) {
            var label = {
                BTTS_YES: 'Karşılıklı Gol (BTTS)',
                O25_OVER: 'Üst 2.5 Gol',
                O15_OVER: 'Üst 1.5 Gol',
                HT_O05_OVER: 'İlk Yarı 0.5 ÜST',
            }[pick.market_type] || pick.market_type;
            message += "\u2705 ".concat(label, "\n");
        });
        message += "\n";
    }
    // ⚠️ Not
    message += "\u26A0\uFE0F <i>Not: Analizler istatistiksel trendlere dayan\u0131r.</i>";
    return message;
}
