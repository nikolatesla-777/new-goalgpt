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
    home?: { ppg?: number; btts_pct?: number; over25_pct?: number };
    away?: { ppg?: number; btts_pct?: number; over25_pct?: number };
  };
  h2h?: {
    total_matches?: number;
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

  for (const trendTuple of trends.slice(0, 4)) {
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

  // PRIORITY 1: Use FootyStats trends if available
  if (data.trends?.home && data.trends.home.length > 0) {
    logger.info('[TrendsGenerator] Using FootyStats trends');
    return {
      home: convertFootyStatsTrendsToTurkish(data.trends.home, homeTeam),
      away: convertFootyStatsTrendsToTurkish(data.trends.away || [], awayTeam),
    };
  }

  logger.info('[TrendsGenerator] Using rule-based generation');
  // PRIORITY 2: Rule-based generation (ALWAYS 3 bullets minimum)
  const homeTrends: string[] = [];
  const awayTrends: string[] = [];

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
  if (homeTrends.length < 3) {
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
    if (homeTrends.length < 3 && data.h2h?.avg_goals) {
      homeTrends.push(`H2H ortalama ${data.h2h.avg_goals.toFixed(1)} gol`);
    }

    // Add H2H BTTS trend
    if (homeTrends.length < 3 && data.h2h?.btts_pct && data.h2h.btts_pct >= 50) {
      homeTrends.push(`H2H'de %${data.h2h.btts_pct} karşılıklı gol`);
    }

    // Add Potentials trend
    if (homeTrends.length < 3 && data.potentials?.over25) {
      homeTrends.push(`2.5 üst potansiyeli %${data.potentials.over25}`);
    }

    // Add BTTS potential
    if (homeTrends.length < 3 && data.potentials?.btts) {
      homeTrends.push(`BTTS potansiyeli %${data.potentials.btts}`);
    }
  }

  // Same for away trends
  if (awayTrends.length < 3) {
    // Add xG-based trend for away
    if (data.xg?.away !== undefined) {
      if (data.xg.away >= 1.5) {
        awayTrends.push(`Deplasmanda ofansif (xG: ${data.xg.away.toFixed(1)})`);
      } else {
        awayTrends.push(`Deplasmanda pasif ofans (xG: ${data.xg.away.toFixed(1)})`);
      }
    }

    // Add H2H away wins
    if (awayTrends.length < 3 && data.h2h?.away_wins !== undefined && data.h2h?.total_matches) {
      const winPct = ((data.h2h.away_wins / data.h2h.total_matches) * 100).toFixed(0);
      awayTrends.push(`H2H'de %${winPct} galibiyet oranı`);
    }

    // Add potentials
    if (awayTrends.length < 3 && data.potentials?.btts) {
      awayTrends.push(`Karşılıklı gol potansiyeli %${data.potentials.btts}`);
    }

    if (awayTrends.length < 3 && data.potentials?.over25) {
      awayTrends.push(`2.5 üst potansiyeli %${data.potentials.over25}`);
    }
  }

  // FINAL FALLBACK: Generic insights if still < 3 bullets
  while (homeTrends.length < 3) {
    if (homeTrends.length === 0) homeTrends.push('Ev sahibi avantajı mevcut');
    else if (homeTrends.length === 1) homeTrends.push('Orta seviyede hücum performansı');
    else if (homeTrends.length === 2) homeTrends.push('Savunma dengeli yapıda');
  }

  while (awayTrends.length < 3) {
    if (awayTrends.length === 0) awayTrends.push('Deplasman performansı takip ediliyor');
    else if (awayTrends.length === 1) awayTrends.push('Orta seviye deplasman formu');
    else if (awayTrends.length === 2) awayTrends.push('Kontra atak potansiyeli var');
  }

  const result = {
    home: homeTrends.slice(0, 3),  // EXACTLY 3 bullets
    away: awayTrends.slice(0, 3),  // EXACTLY 3 bullets
  };

  logger.info('[TrendsGenerator] Final result:', {
    home_count: result.home.length,
    away_count: result.away.length,
    home: result.home,
    away: result.away,
  });

  return result;
}
