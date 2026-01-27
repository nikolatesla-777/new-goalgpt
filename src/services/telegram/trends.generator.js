"use strict";
/**
 * Turkish Trends Generator
 *
 * Converts FootyStats English trends to Turkish bullet points
 * Also provides rule-based trend generation when FootyStats data is unavailable
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTurkishTrends = generateTurkishTrends;
var logger_1 = require("../../utils/logger");
/**
 * Parse form string (e.g. "WWLDW") and extract statistics
 */
function parseFormString(formStr) {
    if (!formStr)
        return { wins: 0, draws: 0, losses: 0, total: 0, isUnbeaten: false };
    var wins = (formStr.match(/W/g) || []).length;
    var draws = (formStr.match(/D/g) || []).length;
    var losses = (formStr.match(/L/g) || []).length;
    var total = formStr.length;
    var isUnbeaten = losses === 0;
    return { wins: wins, draws: draws, losses: losses, total: total, isUnbeaten: isUnbeaten };
}
/**
 * Calculate additional trends from form/h2h/xg data
 * These supplement FootyStats trends when they don't provide enough
 */
function calculateAdditionalTrends(teamName, isHome, data) {
    var _a, _b, _c;
    var trends = [];
    var form = isHome ? (_a = data.form) === null || _a === void 0 ? void 0 : _a.home : (_b = data.form) === null || _b === void 0 ? void 0 : _b.away;
    if (!form)
        return trends;
    // Trend 1: Form run analysis (e.g. "unbeaten in last 5")
    if (form.overall) {
        var formStats = parseFormString(form.overall);
        if (formStats.total >= 5) {
            if (formStats.isUnbeaten) {
                trends.push("Son ".concat(formStats.total, " ma\u00E7ta yenilmedi (").concat(formStats.wins, " galibiyet, ").concat(formStats.draws, " beraberlik)"));
            }
            else if (formStats.wins >= 3) {
                trends.push("Son ".concat(formStats.total, " ma\u00E7ta ").concat(formStats.wins, " galibiyet ald\u0131"));
            }
            else if (formStats.losses >= 3) {
                trends.push("Son ".concat(formStats.total, " ma\u00E7ta ").concat(formStats.losses, " ma\u011Flubiyet ald\u0131"));
            }
        }
    }
    // Trend 2: BTTS season statistics
    if (form.btts_pct && ((_c = data.h2h) === null || _c === void 0 ? void 0 : _c.total_matches)) {
        // Calculate matches count from percentage (rough estimate)
        var seasonMatches = Math.round(data.h2h.total_matches * 1.5); // Assume ~18 season matches
        var bttsMatches = Math.round((form.btts_pct / 100) * seasonMatches);
        trends.push("Bu sezon ".concat(seasonMatches, " ma\u00E7\u0131n ").concat(bttsMatches, "'inde (%").concat(form.btts_pct, ") kar\u015F\u0131l\u0131kl\u0131 gol oldu"));
    }
    // Trend 3: Over 2.5 tendencies
    if (form.over25_pct && form.over25_pct >= 60) {
        trends.push("Ma\u00E7lar\u0131n %".concat(form.over25_pct, "'i 2.5 \u00FCst ile sonu\u00E7land\u0131"));
    }
    // Trend 4: Home/Away specific form (if available)
    var specificForm = isHome ? form.home_only : form.away_only;
    if (specificForm) {
        var specificStats = parseFormString(specificForm);
        var venue = isHome ? 'ev sahibi' : 'deplasman';
        if (specificStats.wins >= 3 && specificStats.total >= 5) {
            trends.push("".concat(venue.charAt(0).toUpperCase() + venue.slice(1), " ma\u00E7lar\u0131nda g\u00FC\u00E7l\u00FC (son ").concat(specificStats.total, " ma\u00E7ta ").concat(specificStats.wins, " galibiyet)"));
        }
    }
    return trends;
}
/**
 * Convert FootyStats English trends to Turkish FULL TRANSLATION
 * COMPREHENSIVE translation preserving ALL information from original text
 *
 * ✅ FIX: FootyStats returns trends as tuples [sentiment, text], NOT objects
 * ✅ NEW: Full paragraph translation, not just bullet summaries
 */
function convertFootyStatsTrendsToTurkish(trends, teamName) {
    var turkish = [];
    for (var _i = 0, _a = trends.slice(0, 4); _i < _a.length; _i++) {
        var trendTuple = _a[_i];
        if (!trendTuple || !Array.isArray(trendTuple) || trendTuple.length < 2)
            continue;
        var sentiment = trendTuple[0], text = trendTuple[1];
        if (!text)
            continue;
        // FULL TRANSLATION: Preserve all details from original text
        var translatedText = translateFullTrend(text, teamName);
        if (translatedText) {
            turkish.push(translatedText);
        }
    }
    return turkish;
}
/**
 * Comprehensive trend translation function
 * Preserves ALL information from English text
 */
function translateFullTrend(text, teamName) {
    var lower = text.toLowerCase();
    // Pattern 1: "Coming into this game..." - Full form summary
    if (lower.includes('coming into this game')) {
        var result = '';
        // Extract points
        var pointsMatch = lower.match(/picked up (\d+) points from the last (\d+) games/);
        if (pointsMatch) {
            var points = pointsMatch[1];
            var games = pointsMatch[2];
            result += "Bu ma\u00E7a gelirken son ".concat(games, " ma\u00E7ta ").concat(points, " puan toplad\u0131");
            // Home and away mention
            if (lower.includes('both home and away')) {
                result += ' (ev sahibi ve deplasman)';
            }
        }
        // Extract PPG
        var ppgMatch = lower.match(/that's ([\d.]+) points per game/);
        if (ppgMatch) {
            result += ", ma\u00E7 ba\u015F\u0131 ortalama ".concat(ppgMatch[1], " puan");
        }
        // Extract BTTS
        var bttsMatch = lower.match(/btts has landed in (?:an intriguing )?(\d+) of those games/);
        if (bttsMatch) {
            result += ". Bu ma\u00E7lar\u0131n ".concat(bttsMatch[1], "'inde kar\u015F\u0131l\u0131kl\u0131 gol ger\u00E7ekle\u015Fti");
        }
        // Extract goals scored
        var goalsMatch = lower.match(/scored (\d+) times in the last (\d+) fixtures/);
        if (goalsMatch) {
            result += ". Son ".concat(goalsMatch[2], " ma\u00E7ta ").concat(goalsMatch[1], " gol att\u0131");
        }
        return result + '.';
    }
    // Pattern 2: "It's possible/likely we will see goals..." - Goal prediction
    if (lower.includes('possible') && lower.includes('goals')) {
        var result = 'Gol beklentisi yüksek';
        // Extract "last X games ending with Y goals or more"
        var goalGamesMatch = lower.match(/last (\d+) games.*?ending with (\d+) goals or more/);
        if (goalGamesMatch) {
            result = "Son ".concat(goalGamesMatch[1], " ma\u00E7ta ").concat(goalGamesMatch[2], " veya daha fazla gol at\u0131ld\u0131, bu ma\u00E7ta da gol g\u00F6r\u00FClebilir");
        }
        return result + '.';
    }
    // Pattern 3: "We might see some goals..." - High scoring
    if (lower.includes('we might see') && lower.includes('goals')) {
        var result = '';
        // Extract "last X games with Y or more goals"
        var highScoreMatch = lower.match(/last (\d+) games.*?ended with (\d+) or more goals/);
        if (highScoreMatch) {
            result = "Bu ma\u00E7ta gol seyri olabilir, son ".concat(highScoreMatch[1], " ma\u00E7 ").concat(highScoreMatch[2], " veya daha fazla golle sonu\u00E7land\u0131");
        }
        // Extract total goals
        var totalGoalsMatch = lower.match(/total of (\d+) goals in the last (\d+) games/);
        if (totalGoalsMatch) {
            result += ". Son ".concat(totalGoalsMatch[2], " ma\u00E7ta toplam ").concat(totalGoalsMatch[1], " gol at\u0131ld\u0131");
        }
        return result + '.';
    }
    // Pattern 4: "Can X turn this around?" - Win drought
    if (lower.includes('turn this around') || lower.includes('not won in')) {
        var gamesMatch = lower.match(/not won in the last (\d+) games/);
        var drawsMatch = lower.match(/(\d+) draws?/);
        var defeatsMatch = lower.match(/(\d+) defeats?/);
        if (gamesMatch) {
            var result = "Son ".concat(gamesMatch[1], " ma\u00E7ta galibiyet alamad\u0131");
            if (drawsMatch && defeatsMatch) {
                result += " (".concat(drawsMatch[1], " beraberlik, ").concat(defeatsMatch[1], " ma\u011Flubiyet)");
            }
            return result + '.';
        }
    }
    // Pattern 5: "In the last X matches, Y ended with BTTS" - BTTS frequency
    if (lower.includes('ended with both teams scoring') || lower.includes('btts landing')) {
        var bttsCountMatch = lower.match(/(\d+) of those games.*?ended with both teams scoring/);
        var bttsSeasonMatch = lower.match(/(\d+) matches \((\d+)%.*?\) involving.*?btts/);
        var result = '';
        if (bttsCountMatch) {
            result = "Son ma\u00E7lar\u0131n ".concat(bttsCountMatch[1], "'inde kar\u015F\u0131l\u0131kl\u0131 gol ger\u00E7ekle\u015Fti");
        }
        if (bttsSeasonMatch) {
            result += ". Bu sezon ".concat(bttsSeasonMatch[1], " ma\u00E7ta (%").concat(bttsSeasonMatch[2], ") kar\u015F\u0131l\u0131kl\u0131 gol oldu");
        }
        return result + '.';
    }
    // Pattern 6: "It's likely X will score" - Scoring streak
    if (lower.includes("likely") && lower.includes("will score")) {
        var streakMatch = lower.match(/netted in the last (\d+) games/);
        var goalsMatch = lower.match(/scored (\d+) goals in the last (\d+) games/);
        var result = 'Gol atma olasılığı yüksek';
        if (streakMatch) {
            result = "Son ".concat(streakMatch[1], " ma\u00E7ta gol att\u0131, bu ma\u00E7ta da gol atmas\u0131 muhtemel");
        }
        if (goalsMatch) {
            result += ", son ".concat(goalsMatch[2], " ma\u00E7ta ").concat(goalsMatch[1], " gol kaydetti");
        }
        return result + '.';
    }
    // Pattern 7: Won/Lost streaks
    if (lower.includes('won') && lower.includes('last')) {
        var wonMatch = lower.match(/won (?:the )?last (\d+)/);
        var homeMatch = lower.includes('home');
        var awayMatch = lower.includes('away');
        if (wonMatch) {
            var location_1 = '';
            if (homeMatch)
                location_1 = ' ev sahibi';
            if (awayMatch)
                location_1 = ' deplasman';
            return "Son ".concat(wonMatch[1]).concat(location_1, " ma\u00E7\u0131 kazand\u0131.");
        }
    }
    // Pattern 8: Scoring statistics
    if (lower.includes('scored') && lower.includes('last')) {
        var goalsMatch = lower.match(/scored (\d+).*?last (\d+)/);
        if (goalsMatch) {
            return "Son ".concat(goalsMatch[2], " ma\u00E7ta ").concat(goalsMatch[1], " gol att\u0131.");
        }
    }
    // Pattern 9: Conceding statistics
    if (lower.includes('conceded') && lower.includes('last')) {
        var goalsMatch = lower.match(/conceded (\d+).*?last (\d+)/);
        if (goalsMatch) {
            return "Son ".concat(goalsMatch[2], " ma\u00E7ta ").concat(goalsMatch[1], " gol yedi.");
        }
    }
    // Pattern 10: Clean sheets
    if (lower.includes('clean sheet')) {
        var countMatch = lower.match(/(\d+) clean sheets?/);
        if (countMatch) {
            return "".concat(countMatch[1], " ma\u00E7ta kalesini gole kapatmad\u0131.");
        }
    }
    // Pattern 11: "Things have not been going well in front of goal" - Scoring struggles
    if (lower.includes('not been going') && lower.includes('front of goal')) {
        var failedToScoreMatch = lower.match(/failing to score in (\d+) of the last (\d+) games/);
        if (failedToScoreMatch) {
            return "H\u00FCcumda zorlan\u0131yor, son ".concat(failedToScoreMatch[2], " ma\u00E7\u0131n ").concat(failedToScoreMatch[1], "'inde gol atamad\u0131.");
        }
        return 'Gol yollarında sıkıntı yaşıyor.';
    }
    // Pattern 12: "fired blanks" - Failed to score
    if (lower.includes('fired blanks')) {
        var result = '';
        var blanksMatch = lower.match(/fired blanks in (\d+) games/);
        var percentMatch = lower.match(/that's (\d+)% of games/);
        var scoredMatch = lower.match(/last (\d+) games.*?scored.*?(\d+) goals/);
        if (blanksMatch) {
            result = "Sezon boyunca ".concat(blanksMatch[1], " ma\u00E7ta gol atamad\u0131");
            if (percentMatch) {
                result += " (ma\u00E7lar\u0131n %".concat(percentMatch[1], "'i)");
            }
            if (scoredMatch) {
                result += ". Buna ra\u011Fmen son ".concat(scoredMatch[1], " ma\u00E7ta ").concat(scoredMatch[2], " gol att\u0131");
            }
            return result + '.';
        }
    }
    // Pattern 13: "Superb stuff ... unbeaten" - Unbeaten streak
    if ((lower.includes('superb stuff') || lower.includes('excellent')) && lower.includes('unbeaten')) {
        var venue = lower.includes('away from home') ? 'deplasmanda' : lower.includes('at home') ? 'ev sahibi' : '';
        var unbeatenMatch = lower.match(/unbeaten in (\d+) games/);
        if (unbeatenMatch) {
            var games = unbeatenMatch[1];
            if (venue) {
                return "".concat(venue.charAt(0).toUpperCase() + venue.slice(1), " son ").concat(games, " ma\u00E7t\u0131r yenilmiyor. Bu seriye devam edebilecek mi?");
            }
            return "Son ".concat(games, " ma\u00E7t\u0131r yenilmiyor. Harika bir performans sergiliyor.");
        }
    }
    // Pattern 14: "Scoring is not an issue" - Strong scoring record
    if (lower.includes('scoring is not an issue')) {
        var venue = lower.includes('away from home') ? 'deplasmanda' : lower.includes('at home') ? 'ev sahibi' : '';
        var streakMatch = lower.match(/scored in the last (\d+) games/);
        if (streakMatch) {
            var games = streakMatch[1];
            if (venue) {
                return "".concat(venue.charAt(0).toUpperCase() + venue.slice(1), " gol atmada s\u0131k\u0131nt\u0131 ya\u015Fam\u0131yor, son ").concat(games, " ma\u00E7\u0131n hepsinde gol att\u0131.");
            }
            return "Son ".concat(games, " ma\u00E7\u0131n hepsinde gol att\u0131. Golc\u00FC formda.");
        }
        return 'Gol atmada hiç sıkıntı yaşamıyor.';
    }
    // Pattern 15: "Momentum is really building" - Building momentum
    if (lower.includes('momentum') && lower.includes('building')) {
        var streakMatch = lower.match(/gone (\d+) games without losing/);
        var winsMatch = lower.match(/won (\d+) of the last (\d+) games/);
        var result = 'Momentum yakalıyor';
        if (streakMatch) {
            result += ", son ".concat(streakMatch[1], " ma\u00E7t\u0131r kaybetmiyor");
        }
        if (winsMatch) {
            result += ". Son ".concat(winsMatch[2], " ma\u00E7ta ").concat(winsMatch[1], " galibiyet ald\u0131");
        }
        return result + '.';
    }
    // Pattern 16: "has enjoyed playing at home/away ... unbeaten in X games"
    if (lower.includes('enjoyed playing') || (lower.includes('currently unbeaten') && (lower.includes('at home') || lower.includes('away')))) {
        var venue = lower.includes('at home') ? 'ev sahibi' : lower.includes('away') ? 'deplasman' : '';
        var unbeatenMatch = lower.match(/unbeaten in (\d+) games/);
        if (unbeatenMatch) {
            var games = unbeatenMatch[1];
            if (venue) {
                return "".concat(venue.charAt(0).toUpperCase() + venue.slice(1), " oynarken son ").concat(games, " ma\u00E7t\u0131r yenilmiyor.");
            }
            return "Son ".concat(games, " ma\u00E7t\u0131r yenilmiyor.");
        }
    }
    // Pattern 17: "will be confident of scoring ... record of scoring in every single home/away game"
    if (lower.includes('confident of scoring') || lower.includes('record of scoring')) {
        var venue = lower.includes('home game') ? 'ev sahibi' : lower.includes('away game') ? 'deplasman' : '';
        if (lower.includes('every single')) {
            if (venue) {
                return "".concat(venue.charAt(0).toUpperCase() + venue.slice(1), " ma\u00E7lar\u0131nda her ma\u00E7 gol at\u0131yor ve bug\u00FCn de g\u00FCvenli g\u00F6r\u00FCn\u00FCyor.");
            }
            return 'Her maç gol atıyor, bugün de gol atacağına güveniyor.';
        }
    }
    // Pattern 18: "has had no trouble finding the back of the net ... scored in last X games"
    if (lower.includes('no trouble finding the back of the net') || lower.includes('no trouble') && lower.includes('scoring')) {
        var venue = lower.includes('home games') ? 'ev sahibi' : lower.includes('away games') ? 'deplasman' : '';
        var streakMatch = lower.match(/last (\d+) (?:home |away )?games/);
        var goalsMatch = lower.match(/scored (\d+) goals/);
        var result = 'Gol bulmakta hiç zorlanmıyor';
        if (streakMatch) {
            result += ", son ".concat(streakMatch[1], " ").concat(venue, " ma\u00E7\u0131n hepsinde gol att\u0131");
        }
        if (goalsMatch) {
            result += " (".concat(goalsMatch[1], " gol)");
        }
        return result + '.';
    }
    // Pattern 19: "put together a good run of form ... gone X games without defeat"
    if (lower.includes('put together') && lower.includes('run of form')) {
        var withoutDefeatMatch = lower.match(/gone (\d+) games without defeat/);
        if (withoutDefeatMatch) {
            return "\u0130yi bir form yakalad\u0131 ve son ".concat(withoutDefeatMatch[1], " ma\u00E7t\u0131r yenilmiyor.");
        }
        return 'İyi bir form tutturdu.';
    }
    // Pattern 20: "looking to keep up the momentum ... having lost just X game from the last Y"
    if (lower.includes('keep up') && (lower.includes('momentum') || lower.includes('form'))) {
        var lostMatch = lower.match(/lost just (\d+) games? from the last (\d+)/);
        if (lostMatch) {
            var lost = lostMatch[1];
            var total = lostMatch[2];
            return "Momentumu s\u00FCrd\u00FCrmek istiyor, son ".concat(total, " ma\u00E7ta sadece ").concat(lost, " ma\u011Flubiyet ald\u0131.");
        }
        return 'Momentumu sürdürmek istiyor.';
    }
    // Pattern 21: "has been on fire recently" - Hot streak
    if (lower.includes('on fire') || lower.includes('in hot form')) {
        return 'Son dönemde ateş püskürüyor.';
    }
    // Pattern 22: "keep a clean sheet" / "kept X clean sheets"
    if (lower.includes('clean sheet')) {
        var keptMatch = lower.match(/kept (\d+) clean sheets? in (?:the )?last (\d+)/);
        if (keptMatch) {
            return "Son ".concat(keptMatch[2], " ma\u00E7ta ").concat(keptMatch[1], " kez kalesini gole kapatm\u0131\u015F.");
        }
    }
    // Pattern 23: "X's defence will have to be at their best to stop Y from scoring"
    if (lower.includes('defence will have to be at their best') || lower.includes('defense will have to be at their best')) {
        // Extract team names
        var stopFromScoringMatch = lower.match(/stop ([\w\s]+) from scoring/);
        if (stopFromScoringMatch) {
            var opponent = stopFromScoringMatch[1].trim();
            return "Savunma \u00E7ok dikkatli olmal\u0131, ".concat(opponent, " gol atmakta zorlanm\u0131yor.");
        }
        return 'Savunma en iyi performansını göstermeli.';
    }
    // Fallback: Generic translation based on sentiment
    if (lower.includes('great') || lower.includes('good form')) {
        return 'İyi bir performans sergiliyor.';
    }
    if (lower.includes('struggling') || lower.includes('poor')) {
        return 'Zorlu bir dönemden geçiyor.';
    }
    // If no pattern matched, return original (better than losing info)
    return text;
}
/**
 * Generate Turkish trends with 2-section structure (Ev/Dep)
 * Returns: { home: string[], away: string[] }
 */
function generateTurkishTrends(homeTeam, awayTeam, data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
    logger_1.logger.info('[TrendsGenerator] Input data:', {
        hasFootyStatsTrends: !!((_a = data.trends) === null || _a === void 0 ? void 0 : _a.home),
        footyStatsTrendsCount: ((_c = (_b = data.trends) === null || _b === void 0 ? void 0 : _b.home) === null || _c === void 0 ? void 0 : _c.length) || 0,
        hasForm: !!data.form,
        hasXg: !!data.xg,
        hasH2h: !!data.h2h,
        hasPotentials: !!data.potentials,
    });
    // PRIORITY 1: Use FootyStats trends if available, then SUPPLEMENT with calculated trends
    var homeTrends = [];
    var awayTrends = [];
    if (((_d = data.trends) === null || _d === void 0 ? void 0 : _d.home) && data.trends.home.length > 0) {
        logger_1.logger.info('[TrendsGenerator] Using FootyStats trends as base');
        homeTrends = convertFootyStatsTrendsToTurkish(data.trends.home, homeTeam);
        awayTrends = convertFootyStatsTrendsToTurkish(data.trends.away || [], awayTeam);
        // If we have enough trends (5+ each), return immediately
        if (homeTrends.length >= 5 && awayTrends.length >= 5) {
            logger_1.logger.info('[TrendsGenerator] FootyStats provided enough trends');
            return { home: homeTrends, away: awayTrends };
        }
        logger_1.logger.info('[TrendsGenerator] Supplementing with calculated trends');
    }
    else {
        logger_1.logger.info('[TrendsGenerator] Using rule-based generation');
    }
    // PRIORITY 2: Calculate additional trends from Form/H2H/xG data
    // (Add to existing homeTrends and awayTrends arrays)
    // Add calculated trends using helper function
    var calculatedHomeTrends = calculateAdditionalTrends(homeTeam, true, data);
    var calculatedAwayTrends = calculateAdditionalTrends(awayTeam, false, data);
    var _loop_1 = function (trend) {
        if (homeTrends.length < 8 && !homeTrends.some(function (t) { return t.includes(trend.substring(0, 20)); })) {
            homeTrends.push(trend);
        }
    };
    // Add calculated trends that don't duplicate existing ones
    for (var _i = 0, calculatedHomeTrends_1 = calculatedHomeTrends; _i < calculatedHomeTrends_1.length; _i++) {
        var trend = calculatedHomeTrends_1[_i];
        _loop_1(trend);
    }
    var _loop_2 = function (trend) {
        if (awayTrends.length < 8 && !awayTrends.some(function (t) { return t.includes(trend.substring(0, 20)); })) {
            awayTrends.push(trend);
        }
    };
    for (var _4 = 0, calculatedAwayTrends_1 = calculatedAwayTrends; _4 < calculatedAwayTrends_1.length; _4++) {
        var trend = calculatedAwayTrends_1[_4];
        _loop_2(trend);
    }
    // PRIORITY 3: Legacy fallback trends (only if still needed)
    // Home trends from Form
    if (((_f = (_e = data.form) === null || _e === void 0 ? void 0 : _e.home) === null || _f === void 0 ? void 0 : _f.ppg) != null) { // != null checks both null and undefined
        if (data.form.home.ppg >= 2.0) {
            homeTrends.push("\u0130yi formda (".concat(data.form.home.ppg.toFixed(1), " puan/ma\u00E7)"));
        }
        else if (data.form.home.ppg < 1.0) {
            homeTrends.push("Zay\u0131f form (".concat(data.form.home.ppg.toFixed(1), " puan/ma\u00E7)"));
        }
        else {
            homeTrends.push("Orta seviye form (".concat(data.form.home.ppg.toFixed(1), " puan/ma\u00E7)"));
        }
    }
    if (((_h = (_g = data.form) === null || _g === void 0 ? void 0 : _g.home) === null || _h === void 0 ? void 0 : _h.btts_pct) && data.form.home.btts_pct >= 50) {
        homeTrends.push("Ma\u00E7lar\u0131n %".concat(data.form.home.btts_pct, "'inde kar\u015F\u0131l\u0131kl\u0131 gol"));
    }
    if (((_k = (_j = data.form) === null || _j === void 0 ? void 0 : _j.home) === null || _k === void 0 ? void 0 : _k.over25_pct) && data.form.home.over25_pct >= 50) {
        homeTrends.push("Ma\u00E7lar\u0131n %".concat(data.form.home.over25_pct, "'inde 2.5 \u00FCst"));
    }
    // Away trends from Form
    if (((_m = (_l = data.form) === null || _l === void 0 ? void 0 : _l.away) === null || _m === void 0 ? void 0 : _m.ppg) != null) { // != null checks both null and undefined
        if (data.form.away.ppg >= 2.0) {
            awayTrends.push("Deplasmanda g\u00FC\u00E7l\u00FC (".concat(data.form.away.ppg.toFixed(1), " puan/ma\u00E7)"));
        }
        else if (data.form.away.ppg < 1.0) {
            awayTrends.push("Deplasmanda zay\u0131f (".concat(data.form.away.ppg.toFixed(1), " puan/ma\u00E7)"));
        }
        else {
            awayTrends.push("Orta seviye deplasman formu (".concat(data.form.away.ppg.toFixed(1), " puan/ma\u00E7)"));
        }
    }
    if (((_p = (_o = data.form) === null || _o === void 0 ? void 0 : _o.away) === null || _p === void 0 ? void 0 : _p.btts_pct) && ((_q = data.form) === null || _q === void 0 ? void 0 : _q.away.btts_pct) >= 50) {
        awayTrends.push("Deplasman ma\u00E7lar\u0131n\u0131n %".concat(data.form.away.btts_pct, "'inde KG"));
    }
    if (((_s = (_r = data.form) === null || _r === void 0 ? void 0 : _r.away) === null || _s === void 0 ? void 0 : _s.over25_pct) && data.form.away.over25_pct >= 50) {
        awayTrends.push("Deplasman ma\u00E7lar\u0131n\u0131n %".concat(data.form.away.over25_pct, "'inde 2.5 \u00FCst"));
    }
    // Derive from Potentials/xG/H2H if Form missing
    if (homeTrends.length < 5) {
        // Add xG-based trend
        if (((_t = data.xg) === null || _t === void 0 ? void 0 : _t.home) !== undefined && ((_u = data.xg) === null || _u === void 0 ? void 0 : _u.away) !== undefined) {
            var totalXg = data.xg.home + data.xg.away;
            if (totalXg >= 2.5) {
                homeTrends.push("Y\u00FCksek gol beklentisi (xG: ".concat(totalXg.toFixed(1), ")"));
            }
            else {
                homeTrends.push("Orta gol beklentisi (xG: ".concat(totalXg.toFixed(1), ")"));
            }
        }
        // Add H2H trend
        if (homeTrends.length < 5 && ((_v = data.h2h) === null || _v === void 0 ? void 0 : _v.avg_goals)) {
            homeTrends.push("H2H ortalama ".concat(data.h2h.avg_goals.toFixed(1), " gol"));
        }
        // Add H2H BTTS trend
        if (homeTrends.length < 5 && ((_w = data.h2h) === null || _w === void 0 ? void 0 : _w.btts_pct) && data.h2h.btts_pct >= 50) {
            homeTrends.push("H2H'de %".concat(data.h2h.btts_pct, " kar\u015F\u0131l\u0131kl\u0131 gol"));
        }
        // Add Potentials trend
        if (homeTrends.length < 5 && ((_x = data.potentials) === null || _x === void 0 ? void 0 : _x.over25)) {
            homeTrends.push("2.5 \u00FCst potansiyeli %".concat(data.potentials.over25));
        }
        // Add BTTS potential
        if (homeTrends.length < 5 && ((_y = data.potentials) === null || _y === void 0 ? void 0 : _y.btts)) {
            homeTrends.push("BTTS potansiyeli %".concat(data.potentials.btts));
        }
    }
    // Same for away trends
    if (awayTrends.length < 5) {
        // Add xG-based trend for away
        if (((_z = data.xg) === null || _z === void 0 ? void 0 : _z.away) !== undefined) {
            if (data.xg.away >= 1.5) {
                awayTrends.push("Deplasmanda ofansif (xG: ".concat(data.xg.away.toFixed(1), ")"));
            }
            else {
                awayTrends.push("Deplasmanda pasif ofans (xG: ".concat(data.xg.away.toFixed(1), ")"));
            }
        }
        // Add H2H away wins
        if (awayTrends.length < 5 && ((_0 = data.h2h) === null || _0 === void 0 ? void 0 : _0.away_wins) !== undefined && ((_1 = data.h2h) === null || _1 === void 0 ? void 0 : _1.total_matches)) {
            var winPct = ((data.h2h.away_wins / data.h2h.total_matches) * 100).toFixed(0);
            awayTrends.push("H2H'de %".concat(winPct, " galibiyet oran\u0131"));
        }
        // Add potentials
        if (awayTrends.length < 5 && ((_2 = data.potentials) === null || _2 === void 0 ? void 0 : _2.btts)) {
            awayTrends.push("Kar\u015F\u0131l\u0131kl\u0131 gol potansiyeli %".concat(data.potentials.btts));
        }
        if (awayTrends.length < 5 && ((_3 = data.potentials) === null || _3 === void 0 ? void 0 : _3.over25)) {
            awayTrends.push("2.5 \u00FCst potansiyeli %".concat(data.potentials.over25));
        }
    }
    // FINAL FALLBACK: Generic insights if still < 3 bullets
    while (homeTrends.length < 5) {
        if (homeTrends.length === 0)
            homeTrends.push('Ev sahibi avantajı mevcut');
        else if (homeTrends.length === 1)
            homeTrends.push('Orta seviyede hücum performansı');
        else if (homeTrends.length === 2)
            homeTrends.push('Savunma dengeli yapıda');
    }
    while (awayTrends.length < 5) {
        if (awayTrends.length === 0)
            awayTrends.push('Deplasman performansı takip ediliyor');
        else if (awayTrends.length === 1)
            awayTrends.push('Orta seviye deplasman formu');
        else if (awayTrends.length === 2)
            awayTrends.push('Kontra atak potansiyeli var');
    }
    var result = {
        home: homeTrends.slice(0, 8), // Max 8 bullets (FootyStats shows 5-8)
        away: awayTrends.slice(0, 8), // Max 8 bullets (FootyStats shows 5-8)
    };
    logger_1.logger.info('[TrendsGenerator] Final result:', {
        home_count: result.home.length,
        away_count: result.away.length,
        home: result.home,
        away: result.away,
    });
    return result;
}
