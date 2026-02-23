/**
 * Turkish Trends Generator
 *
 * Converts FootyStats English trends to Turkish bullet points
 * Also provides rule-based trend generation when FootyStats data is unavailable
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { logger } from '../../utils/logger';

interface FootyStatsData {
  potentials?: {
    btts?: number;
    over25?: number;
    over15?: number;
  };
  form?: {
    home?: {
      ppg?: number;
      btts_pct?: number;
      over25_pct?: number;
      overall?: string | null;      // NEW: Form string (e.g. "WWLDW")
      home_only?: string | null;     // NEW: Home-only form string
    };
    away?: {
      ppg?: number;
      btts_pct?: number;
      over25_pct?: number;
      overall?: string | null;       // NEW: Form string (e.g. "LWDWW")
      away_only?: string | null;     // NEW: Away-only form string
    };
  };
  h2h?: {
    total_matches?: number;
    home_wins?: number;              // Added
    draws?: number;                  // Added
    away_wins?: number;              // Added
    btts_pct?: number;
    avg_goals?: number;
  };
  xg?: {
    home?: number;
    away?: number;
    total?: number;
  };
  trends?: {
    home?: Array<[string, string]>;  // ✅ [sentiment, text] tuples
    away?: Array<[string, string]>;  // ✅ [sentiment, text] tuples
  };
}

/**
 * Parse form string (e.g. "WWLDW") and extract statistics
 */
function parseFormString(formStr: string | null | undefined): {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  isUnbeaten: boolean;
} {
  if (!formStr) return { wins: 0, draws: 0, losses: 0, total: 0, isUnbeaten: false };

  const wins = (formStr.match(/W/g) || []).length;
  const draws = (formStr.match(/D/g) || []).length;
  const losses = (formStr.match(/L/g) || []).length;
  const total = formStr.length;
  const isUnbeaten = losses === 0;

  return { wins, draws, losses, total, isUnbeaten };
}

/**
 * Calculate additional trends from form/h2h/xg data
 * These supplement FootyStats trends when they don't provide enough
 */
function calculateAdditionalTrends(
  teamName: string,
  isHome: boolean,
  data: FootyStatsData
): string[] {
  const trends: string[] = [];
  const form = isHome ? data.form?.home : data.form?.away;

  if (!form) return trends;

  // Trend 1: Form run analysis (e.g. "unbeaten in last 5")
  if (form.overall) {
    const formStats = parseFormString(form.overall);
    if (formStats.total >= 5) {
      if (formStats.isUnbeaten) {
        trends.push(
          `Son ${formStats.total} maçta yenilmedi (${formStats.wins} galibiyet, ${formStats.draws} beraberlik)`
        );
      } else if (formStats.wins >= 3) {
        trends.push(
          `Son ${formStats.total} maçta ${formStats.wins} galibiyet aldı`
        );
      } else if (formStats.losses >= 3) {
        trends.push(
          `Son ${formStats.total} maçta ${formStats.losses} mağlubiyet aldı`
        );
      }
    }
  }

  // Trend 3: Over 2.5 tendencies
  if (form.over25_pct && form.over25_pct >= 60) {
    trends.push(
      `Maçların %${form.over25_pct}'i 2.5 üst ile sonuçlandı`
    );
  }

  // Trend 4: Home/Away specific form (if available)
  const specificForm = isHome ? data.form?.home?.home_only : data.form?.away?.away_only;
  if (specificForm) {
    const specificStats = parseFormString(specificForm);
    const venue = isHome ? 'ev sahibi' : 'deplasman';
    if (specificStats.wins >= 3 && specificStats.total >= 5) {
      trends.push(
        `${venue.charAt(0).toUpperCase() + venue.slice(1)} maçlarında güçlü (son ${specificStats.total} maçta ${specificStats.wins} galibiyet)`
      );
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
function convertFootyStatsTrendsToTurkish(
  trends: Array<[string, string]>,
  teamName: string
): string[] {
  const turkish: string[] = [];

  for (const trendTuple of trends.slice(0, 6)) {
    if (!trendTuple || !Array.isArray(trendTuple) || trendTuple.length < 2) continue;

    const [sentiment, text] = trendTuple;
    if (!text) continue;

    // FULL TRANSLATION: Preserve all details from original text
    let translatedText = translateFullTrend(text, teamName);
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
function translateFullTrend(text: string, teamName: string): string {
  const lower = text.toLowerCase();

  // Pattern 1: "Coming into this game..." - Full form summary
  if (lower.includes('coming into this game')) {
    let result = '';

    // Extract points
    const pointsMatch = lower.match(/picked up (\d+) points from the last (\d+) games/);
    if (pointsMatch) {
      const points = pointsMatch[1];
      const games = pointsMatch[2];
      result += `Bu maça gelirken son ${games} maçta ${points} puan topladı`;

      // Home and away mention
      if (lower.includes('both home and away')) {
        result += ' (ev sahibi ve deplasman)';
      }
    }

    // Extract PPG
    const ppgMatch = lower.match(/that's ([\d.]+) points per game/);
    if (ppgMatch) {
      result += `, maç başı ortalama ${ppgMatch[1]} puan`;
    }

    // Extract BTTS
    const bttsMatch = lower.match(/btts has landed in (?:an intriguing )?(\d+) of those games/);
    if (bttsMatch) {
      result += `. Bu maçların ${bttsMatch[1]}'inde karşılıklı gol gerçekleşti`;
    }

    // Extract goals scored
    const goalsMatch = lower.match(/scored (\d+) times in the last (\d+) fixtures/);
    if (goalsMatch) {
      result += `. Son ${goalsMatch[2]} maçta ${goalsMatch[1]} gol attı`;
    }

    return result + '.';
  }

  // Pattern 2: "It's possible/likely we will see goals..." - Goal prediction
  if (lower.includes('possible') && lower.includes('goals')) {
    let result = 'Gol beklentisi yüksek';

    // Extract "last X games ending with Y goals or more"
    const goalGamesMatch = lower.match(/last (\d+) games.*?ending with (\d+) goals or more/);
    if (goalGamesMatch) {
      result = `Son ${goalGamesMatch[1]} maçta ${goalGamesMatch[2]} veya daha fazla gol atıldı, bu maçta da gol görülebilir`;
    }

    return result + '.';
  }

  // Pattern 3: "We might see some goals..." - High scoring
  if (lower.includes('we might see') && lower.includes('goals')) {
    let result = '';

    // Extract "last X games with Y or more goals"
    const highScoreMatch = lower.match(/last (\d+) games.*?ended with (\d+) or more goals/);
    if (highScoreMatch) {
      result = `Bu maçta gol seyri olabilir, son ${highScoreMatch[1]} maç ${highScoreMatch[2]} veya daha fazla golle sonuçlandı`;
    }

    // Extract total goals
    const totalGoalsMatch = lower.match(/total of (\d+) goals in the last (\d+) games/);
    if (totalGoalsMatch) {
      result += `. Son ${totalGoalsMatch[2]} maçta toplam ${totalGoalsMatch[1]} gol atıldı`;
    }

    return result + '.';
  }

  // Pattern 4: "Can X turn this around?" - Win drought
  if (lower.includes('turn this around') || lower.includes('not won in')) {
    const gamesMatch = lower.match(/not won in the last (\d+) games/);
    const drawsMatch = lower.match(/(\d+) draws?/);
    const defeatsMatch = lower.match(/(\d+) defeats?/);

    if (gamesMatch) {
      let result = `Son ${gamesMatch[1]} maçta galibiyet alamadı`;
      if (drawsMatch && defeatsMatch) {
        result += ` (${drawsMatch[1]} beraberlik, ${defeatsMatch[1]} mağlubiyet)`;
      }
      return result + '.';
    }
  }

  // Pattern 5: "In the last X matches, Y ended with BTTS" - BTTS frequency
  if (lower.includes('ended with both teams scoring') || lower.includes('btts landing')) {
    const bttsCountMatch = lower.match(/(\d+) of those games.*?ended with both teams scoring/);
    const bttsSeasonMatch = lower.match(/(\d+) matches \((\d+)%.*?\) involving.*?btts/);

    let result = '';
    if (bttsCountMatch) {
      result = `Son maçların ${bttsCountMatch[1]}'inde karşılıklı gol gerçekleşti`;
    }

    if (bttsSeasonMatch) {
      result += `. Bu sezon ${bttsSeasonMatch[1]} maçta (%${bttsSeasonMatch[2]}) karşılıklı gol oldu`;
    }

    return result + '.';
  }

  // Pattern 6: "It's likely X will score" - Scoring streak
  if (lower.includes("likely") && lower.includes("will score")) {
    const streakMatch = lower.match(/netted in the last (\d+) games/);
    const goalsMatch = lower.match(/scored (\d+) goals in the last (\d+) games/);

    let result = 'Gol atma olasılığı yüksek';
    if (streakMatch) {
      result = `Son ${streakMatch[1]} maçta gol attı, bu maçta da gol atması muhtemel`;
    }
    if (goalsMatch) {
      result += `, son ${goalsMatch[2]} maçta ${goalsMatch[1]} gol kaydetti`;
    }

    return result + '.';
  }

  // Pattern 7: Won/Lost streaks
  if (lower.includes('won') && lower.includes('last')) {
    const wonMatch = lower.match(/won (?:the )?last (\d+)/);
    const homeMatch = lower.includes('home');
    const awayMatch = lower.includes('away');

    if (wonMatch) {
      let location = '';
      if (homeMatch) location = ' ev sahibi';
      if (awayMatch) location = ' deplasman';
      return `Son ${wonMatch[1]}${location} maçı kazandı.`;
    }
  }

  // Pattern 8: Scoring statistics
  if (lower.includes('scored') && lower.includes('last')) {
    const goalsMatch = lower.match(/scored (\d+).*?last (\d+)/);
    if (goalsMatch) {
      return `Son ${goalsMatch[2]} maçta ${goalsMatch[1]} gol attı.`;
    }
  }

  // Pattern 9: Conceding statistics
  if (lower.includes('conceded') && lower.includes('last')) {
    const goalsMatch = lower.match(/conceded (\d+).*?last (\d+)/);
    if (goalsMatch) {
      return `Son ${goalsMatch[2]} maçta ${goalsMatch[1]} gol yedi.`;
    }
  }

  // Pattern 10: Clean sheets
  if (lower.includes('clean sheet')) {
    const countMatch = lower.match(/(\d+) clean sheets?/);
    if (countMatch) {
      return `${countMatch[1]} maçta kalesini gole kapatmadı.`;
    }
  }

  // Pattern 11: "Things have not been going well in front of goal" - Scoring struggles
  if (lower.includes('not been going') && lower.includes('front of goal')) {
    const failedToScoreMatch = lower.match(/failing to score in (\d+) of the last (\d+) games/);
    if (failedToScoreMatch) {
      return `Hücumda zorlanıyor, son ${failedToScoreMatch[2]} maçın ${failedToScoreMatch[1]}'inde gol atamadı.`;
    }
    return 'Gol yollarında sıkıntı yaşıyor.';
  }

  // Pattern 12: "fired blanks" - Failed to score
  if (lower.includes('fired blanks')) {
    let result = '';
    const blanksMatch = lower.match(/fired blanks in (\d+) games/);
    const percentMatch = lower.match(/that's (\d+)% of games/);
    const scoredMatch = lower.match(/last (\d+) games.*?scored.*?(\d+) goals/);

    if (blanksMatch) {
      result = `Sezon boyunca ${blanksMatch[1]} maçta gol atamadı`;
      if (percentMatch) {
        result += ` (maçların %${percentMatch[1]}'i)`;
      }
      if (scoredMatch) {
        result += `. Buna rağmen son ${scoredMatch[1]} maçta ${scoredMatch[2]} gol attı`;
      }
      return result + '.';
    }
  }

  // Pattern 13: "Superb stuff ... unbeaten" - Unbeaten streak
  if ((lower.includes('superb stuff') || lower.includes('excellent')) && lower.includes('unbeaten')) {
    const venue = lower.includes('away from home') ? 'deplasmanda' : lower.includes('at home') ? 'ev sahibi' : '';
    const unbeatenMatch = lower.match(/unbeaten in (\d+) games/);

    if (unbeatenMatch) {
      const games = unbeatenMatch[1];
      if (venue) {
        return `${venue.charAt(0).toUpperCase() + venue.slice(1)} son ${games} maçtır yenilmiyor. Bu seriye devam edebilecek mi?`;
      }
      return `Son ${games} maçtır yenilmiyor. Harika bir performans sergiliyor.`;
    }
  }

  // Pattern 14: "Scoring is not an issue" - Strong scoring record
  if (lower.includes('scoring is not an issue')) {
    const venue = lower.includes('away from home') ? 'deplasmanda' : lower.includes('at home') ? 'ev sahibi' : '';
    const streakMatch = lower.match(/scored in the last (\d+) games/);

    if (streakMatch) {
      const games = streakMatch[1];
      if (venue) {
        return `${venue.charAt(0).toUpperCase() + venue.slice(1)} gol atmada sıkıntı yaşamıyor, son ${games} maçın hepsinde gol attı.`;
      }
      return `Son ${games} maçın hepsinde gol attı. Golcü formda.`;
    }
    return 'Gol atmada hiç sıkıntı yaşamıyor.';
  }

  // Pattern 15: "Momentum is really building" - Building momentum
  if (lower.includes('momentum') && lower.includes('building')) {
    const streakMatch = lower.match(/gone (\d+) games without losing/);
    const winsMatch = lower.match(/won (\d+) of the last (\d+) games/);

    let result = 'Momentum yakalıyor';
    if (streakMatch) {
      result += `, son ${streakMatch[1]} maçtır kaybetmiyor`;
    }
    if (winsMatch) {
      result += `. Son ${winsMatch[2]} maçta ${winsMatch[1]} galibiyet aldı`;
    }
    return result + '.';
  }

  // Pattern 16: "has enjoyed playing at home/away ... unbeaten in X games"
  if (lower.includes('enjoyed playing') || (lower.includes('currently unbeaten') && (lower.includes('at home') || lower.includes('away')))) {
    const venue = lower.includes('at home') ? 'ev sahibi' : lower.includes('away') ? 'deplasman' : '';
    const unbeatenMatch = lower.match(/unbeaten in (\d+) games/);

    if (unbeatenMatch) {
      const games = unbeatenMatch[1];
      if (venue) {
        return `${venue.charAt(0).toUpperCase() + venue.slice(1)} oynarken son ${games} maçtır yenilmiyor.`;
      }
      return `Son ${games} maçtır yenilmiyor.`;
    }
  }

  // Pattern 17: "will be confident of scoring ... record of scoring in every single home/away game"
  if (lower.includes('confident of scoring') || lower.includes('record of scoring')) {
    const venue = lower.includes('home game') ? 'ev sahibi' : lower.includes('away game') ? 'deplasman' : '';
    if (lower.includes('every single')) {
      if (venue) {
        return `${venue.charAt(0).toUpperCase() + venue.slice(1)} maçlarında her maç gol atıyor ve bugün de güvenli görünüyor.`;
      }
      return 'Her maç gol atıyor, bugün de gol atacağına güveniyor.';
    }
  }

  // Pattern 18: "has had no trouble finding the back of the net ... scored in last X games"
  if (lower.includes('no trouble finding the back of the net') || lower.includes('no trouble') && lower.includes('scoring')) {
    const venue = lower.includes('home games') ? 'ev sahibi' : lower.includes('away games') ? 'deplasman' : '';
    const streakMatch = lower.match(/last (\d+) (?:home |away )?games/);
    const goalsMatch = lower.match(/scored (\d+) goals/);

    let result = 'Gol bulmakta hiç zorlanmıyor';
    if (streakMatch) {
      result += `, son ${streakMatch[1]} ${venue} maçın hepsinde gol attı`;
    }
    if (goalsMatch) {
      result += ` (${goalsMatch[1]} gol)`;
    }
    return result + '.';
  }

  // Pattern 19: "put together a good run of form ... gone X games without defeat"
  if (lower.includes('put together') && lower.includes('run of form')) {
    const withoutDefeatMatch = lower.match(/gone (\d+) games without defeat/);
    if (withoutDefeatMatch) {
      return `İyi bir form yakaladı ve son ${withoutDefeatMatch[1]} maçtır yenilmiyor.`;
    }
    return 'İyi bir form tutturdu.';
  }

  // Pattern 20: "looking to keep up the momentum ... having lost just X game from the last Y"
  if (lower.includes('keep up') && (lower.includes('momentum') || lower.includes('form'))) {
    const lostMatch = lower.match(/lost just (\d+) games? from the last (\d+)/);
    if (lostMatch) {
      const lost = lostMatch[1];
      const total = lostMatch[2];
      return `Momentumu sürdürmek istiyor, son ${total} maçta sadece ${lost} mağlubiyet aldı.`;
    }
    return 'Momentumu sürdürmek istiyor.';
  }

  // Pattern 21: "has been on fire recently" - Hot streak
  if (lower.includes('on fire') || lower.includes('in hot form')) {
    return 'Son dönemde ateş püskürüyor.';
  }

  // Pattern 22: "keep a clean sheet" / "kept X clean sheets"
  if (lower.includes('clean sheet')) {
    const keptMatch = lower.match(/kept (\d+) clean sheets? in (?:the )?last (\d+)/);
    if (keptMatch) {
      return `Son ${keptMatch[2]} maçta ${keptMatch[1]} kez kalesini gole kapatmış.`;
    }
  }

  // Pattern 23: "X's defence will have to be at their best to stop Y from scoring"
  if (lower.includes('defence will have to be at their best') || lower.includes('defense will have to be at their best')) {
    // Extract team names
    const stopFromScoringMatch = lower.match(/stop ([\w\s]+) from scoring/);
    if (stopFromScoringMatch) {
      const opponent = stopFromScoringMatch[1].trim();
      return `Savunma çok dikkatli olmalı, ${opponent} gol atmakta zorlanmıyor.`;
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
export function generateTurkishTrends(
  homeTeam: string,
  awayTeam: string,
  data: FootyStatsData
): { home: string[]; away: string[] } {
  logger.info('[TrendsGenerator] Input data:', {
    hasFootyStatsTrends: !!data.trends?.home,
    footyStatsTrendsCount: data.trends?.home?.length || 0,
    hasForm: !!data.form,
    hasXg: !!data.xg,
    hasH2h: !!data.h2h,
    hasPotentials: !!data.potentials,
  });

  // PRIORITY 1: Use FootyStats trends if available, then SUPPLEMENT with calculated trends
  let homeTrends: string[] = [];
  let awayTrends: string[] = [];

  if (data.trends?.home && data.trends.home.length > 0) {
    logger.info('[TrendsGenerator] Using FootyStats trends as base');
    homeTrends = convertFootyStatsTrendsToTurkish(data.trends.home, homeTeam);
    awayTrends = convertFootyStatsTrendsToTurkish(data.trends.away || [], awayTeam);

    // If we have enough trends (5+ each), return immediately
    if (homeTrends.length >= 5 && awayTrends.length >= 5) {
      logger.info('[TrendsGenerator] FootyStats provided enough trends');
      return { home: homeTrends, away: awayTrends };
    }

    logger.info('[TrendsGenerator] Supplementing with calculated trends');
  } else {
    logger.info('[TrendsGenerator] Using rule-based generation');
  }

  // PRIORITY 2: Calculate additional trends from Form/H2H/xG data
  // (Add to existing homeTrends and awayTrends arrays)

  // Add calculated trends using helper function
  const calculatedHomeTrends = calculateAdditionalTrends(homeTeam, true, data);
  const calculatedAwayTrends = calculateAdditionalTrends(awayTeam, false, data);

  // Add calculated trends that don't duplicate existing ones
  for (const trend of calculatedHomeTrends) {
    if (homeTrends.length < 8 && !homeTrends.some(t => t.includes(trend.substring(0, 20)))) {
      homeTrends.push(trend);
    }
  }

  for (const trend of calculatedAwayTrends) {
    if (awayTrends.length < 8 && !awayTrends.some(t => t.includes(trend.substring(0, 20)))) {
      awayTrends.push(trend);
    }
  }

  // PRIORITY 3: Legacy fallback trends (only if still needed)

  // Home trends from Form
  if (data.form?.home?.ppg != null) {  // != null checks both null and undefined
    if (data.form.home.ppg >= 2.0) {
      homeTrends.push(`İyi formda (${data.form.home.ppg.toFixed(1)} puan/maç)`);
    } else if (data.form.home.ppg < 1.0) {
      homeTrends.push(`Zayıf form (${data.form.home.ppg.toFixed(1)} puan/maç)`);
    } else {
      homeTrends.push(`Orta seviye form (${data.form.home.ppg.toFixed(1)} puan/maç)`);
    }
  }

  if (data.form?.home?.btts_pct && data.form.home.btts_pct >= 50) {
    homeTrends.push(`Maçların %${data.form.home.btts_pct}'inde karşılıklı gol`);
  }

  if (data.form?.home?.over25_pct && data.form.home.over25_pct >= 50) {
    homeTrends.push(`Maçların %${data.form.home.over25_pct}'inde 2.5 üst`);
  }

  // Away trends from Form
  if (data.form?.away?.ppg != null) {  // != null checks both null and undefined
    if (data.form.away.ppg >= 2.0) {
      awayTrends.push(`Deplasmanda güçlü (${data.form.away.ppg.toFixed(1)} puan/maç)`);
    } else if (data.form.away.ppg < 1.0) {
      awayTrends.push(`Deplasmanda zayıf (${data.form.away.ppg.toFixed(1)} puan/maç)`);
    } else {
      awayTrends.push(`Orta seviye deplasman formu (${data.form.away.ppg.toFixed(1)} puan/maç)`);
    }
  }

  if (data.form?.away?.btts_pct && data.form?.away.btts_pct >= 50) {
    awayTrends.push(`Deplasman maçlarının %${data.form.away.btts_pct}'inde KG`);
  }

  if (data.form?.away?.over25_pct && data.form.away.over25_pct >= 50) {
    awayTrends.push(`Deplasman maçlarının %${data.form.away.over25_pct}'inde 2.5 üst`);
  }

  // Derive from Potentials/xG/H2H if Form missing
  if (homeTrends.length < 5) {
    // Add xG-based trend
    if (data.xg?.home !== undefined && data.xg?.away !== undefined) {
      const totalXg = data.xg.home + data.xg.away;
      if (totalXg >= 2.5) {
        homeTrends.push(`Yüksek gol beklentisi (xG: ${totalXg.toFixed(1)})`);
      } else {
        homeTrends.push(`Orta gol beklentisi (xG: ${totalXg.toFixed(1)})`);
      }
    }

    // Add H2H trend
    if (homeTrends.length < 5 && data.h2h?.avg_goals) {
      homeTrends.push(`H2H ortalama ${data.h2h.avg_goals.toFixed(1)} gol`);
    }

    // Add H2H BTTS trend
    if (homeTrends.length < 5 && data.h2h?.btts_pct && data.h2h.btts_pct >= 50) {
      homeTrends.push(`H2H'de %${data.h2h.btts_pct} karşılıklı gol`);
    }

    // Add Potentials trend
    if (homeTrends.length < 5 && data.potentials?.over25) {
      homeTrends.push(`2.5 üst potansiyeli %${data.potentials.over25}`);
    }

    // Add BTTS potential
    if (homeTrends.length < 5 && data.potentials?.btts) {
      homeTrends.push(`BTTS potansiyeli %${data.potentials.btts}`);
    }
  }

  // Same for away trends
  if (awayTrends.length < 5) {
    // Add xG-based trend for away
    if (data.xg?.away !== undefined) {
      if (data.xg.away >= 1.5) {
        awayTrends.push(`Deplasmanda ofansif (xG: ${data.xg.away.toFixed(1)})`);
      } else {
        awayTrends.push(`Deplasmanda pasif ofans (xG: ${data.xg.away.toFixed(1)})`);
      }
    }

    // Add H2H away wins
    if (awayTrends.length < 5 && data.h2h?.away_wins !== undefined && data.h2h?.total_matches) {
      const winPct = ((data.h2h.away_wins / data.h2h.total_matches) * 100).toFixed(0);
      awayTrends.push(`H2H'de %${winPct} galibiyet oranı`);
    }

    // Add potentials
    if (awayTrends.length < 5 && data.potentials?.btts) {
      awayTrends.push(`Karşılıklı gol potansiyeli %${data.potentials.btts}`);
    }

    if (awayTrends.length < 5 && data.potentials?.over25) {
      awayTrends.push(`2.5 üst potansiyeli %${data.potentials.over25}`);
    }
  }

  // FINAL FALLBACK: Generic insights if still < 3 bullets
  while (homeTrends.length < 5) {
    if (homeTrends.length === 0) homeTrends.push('Ev sahibi avantajı mevcut');
    else if (homeTrends.length === 1) homeTrends.push('Orta seviyede hücum performansı');
    else if (homeTrends.length === 2) homeTrends.push('Savunma dengeli yapıda');
  }

  while (awayTrends.length < 5) {
    if (awayTrends.length === 0) awayTrends.push('Deplasman performansı takip ediliyor');
    else if (awayTrends.length === 1) awayTrends.push('Orta seviye deplasman formu');
    else if (awayTrends.length === 2) awayTrends.push('Kontra atak potansiyeli var');
  }

  const result = {
    home: homeTrends.slice(0, 8),  // Max 8 bullets (FootyStats shows 5-8)
    away: awayTrends.slice(0, 8),  // Max 8 bullets (FootyStats shows 5-8)
  };

  logger.info('[TrendsGenerator] Final result:', {
    home_count: result.home.length,
    away_count: result.away.length,
    home: result.home,
    away: result.away,
  });

  return result;
}
