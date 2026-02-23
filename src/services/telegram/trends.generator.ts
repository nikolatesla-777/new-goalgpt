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

  for (const trendTuple of trends.slice(0, 10)) {
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
 * Professional Turkish translation matching FootyStats website style
 */
function translateFullTrend(text: string, teamName: string): string {
  const lower = text.toLowerCase();

  // Pattern 1: "Coming into this game..." - Full form summary
  if (lower.includes('coming into this game')) {
    let result = '';

    const pointsMatch = lower.match(/picked up (\d+) points from the last (\d+) games/);
    if (pointsMatch) {
      const points = pointsMatch[1];
      const games = pointsMatch[2];
      result += `${teamName} bu maça gelirken, iç saha ve deplasman dahil son ${games} maçta ${points} puan topladı`;
    }

    const ppgMatch = lower.match(/that's ([\d.]+) points per game/);
    if (ppgMatch) {
      result += `. Bu da maç başına ortalama ${ppgMatch[1]} puan demek`;
    }

    const bttsMatch = lower.match(/btts has landed in (?:an intriguing )?(\d+) of those games/);
    if (bttsMatch) {
      result += `. "Karşılıklı gol var" (BTTS) bu maçların ${bttsMatch[1]}'inde gerçekleşti`;
    }

    const goalsMatch = lower.match(/scored (\d+) times in the last (\d+) fixtures/);
    if (goalsMatch) {
      result += `. ${teamName} son ${goalsMatch[2]} maçta toplam ${goalsMatch[1]} gol attı`;
    }

    return result + '.';
  }

  // Pattern 2: "It's possible/likely we will see goals..." - Goal prediction
  if (lower.includes('possible') && lower.includes('goals')) {
    const goalGamesMatch = lower.match(/last (\d+) games.*?ending with (\d+) goals or more/);
    if (goalGamesMatch) {
      return `${teamName} son ${goalGamesMatch[1]} maçta ${goalGamesMatch[2]} veya daha fazla gol atıldı; bu maçta da gol görülebilir.`;
    }
    return `${teamName} bu maçta gol beklentisi yüksek.`;
  }

  // Pattern 3: "We might see some goals..." - High scoring
  if (lower.includes('we might see') && lower.includes('goals')) {
    let result = '';

    const highScoreMatch = lower.match(/last (\d+) games.*?ended with (\d+) or more goals/);
    if (highScoreMatch) {
      result = `Burada birkaç gol görebiliriz; ${teamName}'nın oynadığı son ${highScoreMatch[1]} maçın tamamı ${highScoreMatch[2]} veya daha fazla golle bitti`;
    }

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
      let result = `${teamName} son ${gamesMatch[1]} maçta galibiyet alamadı`;
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
      result = `${teamName}'nın son maçlarının ${bttsCountMatch[1]}'inde iki takım da gol attı`;
    }

    if (bttsSeasonMatch) {
      result += `. Bu sezon ${teamName}'nın oynadığı ${bttsSeasonMatch[1]} maçta (tüm maçlarının %${bttsSeasonMatch[2]}'si) "karşılıklı gol var" (BTTS) gerçekleşti`;
    }

    return result + '.';
  }

  // Pattern 6: "It's likely X will score" - Scoring streak
  if (lower.includes('likely') && lower.includes('will score')) {
    const streakMatch = lower.match(/netted in the last (\d+) games/);
    const goalsMatch = lower.match(/scored (\d+) goals in the last (\d+) games/);

    let result = `${teamName} gol atma konusunda kendine güveniyor`;
    if (streakMatch) {
      result = `${teamName} son ${streakMatch[1]} maçta gol attı; bu seride devam etmesi bekleniyor`;
    }
    if (goalsMatch) {
      result += `, son ${goalsMatch[2]} maçta toplam ${goalsMatch[1]} gol kaydetti`;
    }

    return result + '.';
  }

  // Pattern 7: Won/Lost streaks
  if (lower.includes('won') && lower.includes('last')) {
    const wonMatch = lower.match(/won (?:the )?last (\d+)/);
    const isHome = lower.includes('home');
    const isAway = lower.includes('away');

    if (wonMatch) {
      let location = '';
      if (isHome) location = ' iç saha';
      if (isAway) location = ' deplasman';
      return `${teamName} son ${wonMatch[1]}${location} maçını kazandı.`;
    }
  }

  // Pattern 8: Scoring statistics
  if (lower.includes('scored') && lower.includes('last')) {
    const goalsMatch = lower.match(/scored (\d+).*?last (\d+)/);
    if (goalsMatch) {
      return `${teamName} son ${goalsMatch[2]} maçta toplam ${goalsMatch[1]} gol attı.`;
    }
  }

  // Pattern 9: Conceding statistics
  if (lower.includes('conceded') && lower.includes('last')) {
    const goalsMatch = lower.match(/conceded (\d+).*?last (\d+)/);
    if (goalsMatch) {
      return `${teamName} son ${goalsMatch[2]} maçta ${goalsMatch[1]} gol yedi.`;
    }
  }

  // Pattern 10: Clean sheets
  if (lower.includes('clean sheet') && lower.includes('kept')) {
    const keptMatch = lower.match(/kept (\d+) clean sheets? in (?:the )?last (\d+)/);
    if (keptMatch) {
      return `${teamName} son ${keptMatch[2]} maçta ${keptMatch[1]} kez kalesini gole kapattı.`;
    }
    const countMatch = lower.match(/(\d+) clean sheets?/);
    if (countMatch) {
      return `${teamName} ${countMatch[1]} maçta kalesini gole kapattı.`;
    }
  }

  // Pattern 11: "Things have not been going well in front of goal" - Scoring struggles
  if (lower.includes('not been going') && lower.includes('front of goal')) {
    const failedToScoreMatch = lower.match(/failing to score in (\d+) of the last (\d+) games/);
    if (failedToScoreMatch) {
      return `${teamName} hücumda zorlanıyor; son ${failedToScoreMatch[2]} maçın ${failedToScoreMatch[1]}'inde gol atamadı.`;
    }
    return `${teamName} son dönemde gol yollarında sıkıntı yaşıyor.`;
  }

  // Pattern 12: "fired blanks" - Failed to score
  if (lower.includes('fired blanks')) {
    const blanksMatch = lower.match(/fired blanks in (\d+) games/);
    const percentMatch = lower.match(/that's (\d+)% of games/);
    const scoredMatch = lower.match(/last (\d+) games.*?scored.*?(\d+) goals/);

    if (blanksMatch) {
      let result = `${teamName} sezon boyunca ${blanksMatch[1]} maçta gol atamadı`;
      if (percentMatch) {
        result += ` (maçlarının %${percentMatch[1]}'i)`;
      }
      if (scoredMatch) {
        result += `. Buna rağmen son ${scoredMatch[1]} maçta ${scoredMatch[2]} gol attı`;
      }
      return result + '.';
    }
  }

  // Pattern 13: "Superb stuff ... unbeaten" - Unbeaten streak at home/away
  if ((lower.includes('superb stuff') || lower.includes('excellent')) && lower.includes('unbeaten')) {
    const isAwayFrom = lower.includes('away from home');
    const isAtHome = lower.includes('at home');
    const unbeatenMatch = lower.match(/unbeaten in (\d+) games/);

    if (unbeatenMatch) {
      const games = unbeatenMatch[1];
      if (isAtHome) {
        return `${teamName} son dönemde sahasında oynamaktan keyif alıyor; takım şu anda iç sahada ${games} maçtır yenilmiyor.`;
      }
      if (isAwayFrom) {
        return `${teamName} deplasmanda güçlü bir form tutturdu; son ${games} maçtır deplasmanda yenilmiyor.`;
      }
      return `${teamName} harika bir performans sergiliyor; son ${games} maçtır yenilmiyor.`;
    }
  }

  // Pattern 14: "Scoring is not an issue" - Strong scoring record
  if (lower.includes('scoring is not an issue')) {
    const isAtHome = lower.includes('at home');
    const isAwayFrom = lower.includes('away from home');
    const streakMatch = lower.match(/scored in the last (\d+) games/);

    if (streakMatch) {
      const games = streakMatch[1];
      if (isAtHome) {
        return `${teamName} ev sahipliğinde gol atmada hiç sıkıntı yaşamıyor; iç sahada oynadığı son ${games} maçın hepsinde gol attı.`;
      }
      if (isAwayFrom) {
        return `${teamName} deplasmanda gol bulmakta hiç zorlanmıyor; deplasmanda oynadığı son ${games} maçın hepsinde gol attı.`;
      }
      return `${teamName} gol atmada hiç sıkıntı yaşamıyor; son ${games} maçın hepsinde gol attı.`;
    }
    return `${teamName} gol atmada hiç zorlanmıyor.`;
  }

  // Pattern 15: "Momentum is really building" - Building momentum
  if (lower.includes('momentum') && lower.includes('building')) {
    const streakMatch = lower.match(/gone (\d+) games without losing/);
    const winsMatch = lower.match(/won (\d+) of the last (\d+) games/);

    let result = `${teamName} momentum yakalıyor`;
    if (streakMatch) {
      result += `; son ${streakMatch[1]} maçtır kaybetmiyor`;
    }
    if (winsMatch) {
      result += `. Son ${winsMatch[2]} maçta ${winsMatch[1]} galibiyet aldı`;
    }
    return result + '.';
  }

  // Pattern 16: "has enjoyed playing at home/away ... unbeaten in X games"
  if (lower.includes('enjoyed playing') || (lower.includes('currently unbeaten') && (lower.includes('at home') || lower.includes('away')))) {
    const isAtHome = lower.includes('at home');
    const isAway = lower.includes('away');
    const unbeatenMatch = lower.match(/unbeaten in (\d+) games/);

    if (unbeatenMatch) {
      const games = unbeatenMatch[1];
      if (isAtHome) {
        return `${teamName} son dönemde sahasında oynamaktan keyif alıyor; takım şu anda iç sahada ${games} maçtır yenilmiyor.`;
      }
      if (isAway) {
        return `${teamName} deplasmanda rahat hissediyor; son ${games} deplasman maçtır yenilmiyor.`;
      }
      return `${teamName} son ${games} maçtır yenilmiyor.`;
    }
  }

  // Pattern 17: "will be confident of scoring ... record of scoring in every single home/away game"
  if (lower.includes('confident of scoring') || lower.includes('record of scoring')) {
    const isHome = lower.includes('home game');
    const isAway = lower.includes('away game');
    if (lower.includes('every single')) {
      if (isHome) {
        return `${teamName} ev sahipliğinde her maç gol atıyor; bugün de bu seri devam edebilir.`;
      }
      if (isAway) {
        return `${teamName} deplasmanda her maç gol atıyor; bu seriyi sürdürmesi bekleniyor.`;
      }
      return `${teamName} her maç gol atıyor; bugün de bu seri devam edebilir.`;
    }
  }

  // Pattern 18: "has had no trouble finding the back of the net"
  if (lower.includes('no trouble finding the back of the net') || (lower.includes('no trouble') && lower.includes('scoring'))) {
    const isHome = lower.includes('home games');
    const isAway = lower.includes('away games');
    const streakMatch = lower.match(/last (\d+) (?:home |away )?games/);
    const goalsMatch = lower.match(/scored (\d+) goals/);

    let venue = '';
    if (isHome) venue = ' iç saha';
    if (isAway) venue = ' deplasman';

    let result = `${teamName} gol bulmakta hiç zorlanmıyor`;
    if (streakMatch) {
      result += `; son ${streakMatch[1]}${venue} maçın hepsinde gol attı`;
    }
    if (goalsMatch) {
      result += ` (toplam ${goalsMatch[1]} gol)`;
    }
    return result + '.';
  }

  // Pattern 19: "put together a good run of form ... gone X games without defeat"
  if (lower.includes('put together') && lower.includes('run of form')) {
    const withoutDefeatMatch = lower.match(/gone (\d+) games without defeat/);
    if (withoutDefeatMatch) {
      return `${teamName} iyi bir form yakaladı ve şu anda ${withoutDefeatMatch[1]} maçtır mağlup olmuyor.`;
    }
    return `${teamName} iyi bir form tutturdu.`;
  }

  // Pattern 20: "looking to keep up the momentum ... having lost just X game from the last Y"
  if (lower.includes('keep up') && (lower.includes('momentum') || lower.includes('form'))) {
    const lostMatch = lower.match(/lost just (\d+) games? from the last (\d+)/);
    if (lostMatch) {
      return `${teamName} momentumunu sürdürmek isteyecek; son ${lostMatch[2]} maçın sadece ${lostMatch[1]}'ini kaybettiler.`;
    }
    return `${teamName} momentumunu sürdürmek istiyor.`;
  }

  // Pattern 21: "has been on fire recently" - Hot streak
  if (lower.includes('on fire') || lower.includes('in hot form')) {
    return `${teamName} son dönemde ateş püskürüyor.`;
  }

  // Pattern 22: "X's defence will have to be at their best to stop Y from scoring"
  if (lower.includes('defence will have to be at their best') || lower.includes('defense will have to be at their best')) {
    // Use original text (not lowercased) to preserve proper casing of team names
    const stopFromScoringMatch = text.match(/stop ([\w\s]+) from scoring/i);
    const scoredInLastMatch = lower.match(/scored in (?:each of )?(?:the )?(?:their )?last (\d+) (?:home )?games/);
    const failedMatch = lower.match(/(?:only )?failed to score in (\d+)/);

    let result = '';
    if (stopFromScoringMatch) {
      const opponent = stopFromScoringMatch[1].trim();
      result = `Rakip savunmanın bugün ${opponent}'ın gol atmasını engellemek için zirvesinde olması gerekecek`;
    } else {
      result = `Rakip savunma bugün en iyi seviyesinde olmalı`;
    }

    if (scoredInLastMatch) {
      result += `; ${teamName} oynadığı son ${scoredInLastMatch[1]} maçta da gol attı`;
    }

    if (failedMatch) {
      result += `. Bu sezon yalnızca ${failedMatch[1]} maçta gol atamadılar`;
    }

    return result + '.';
  }

  // Pattern 23: "The last X games for [Team] has each seen both teams scoring..."
  // e.g. "The last 5 games for Hougang United has each seen both teams scoring. Will they improve their defence,
  //        or will we see more of the same here? This season Hougang United has seen a total of 6/9 fixtures end
  //        with both teams scoring. That's 67% of all matches played."
  if (lower.includes('has each seen both teams scoring')) {
    const recentMatch = lower.match(/the last (\d+) games for .+ has each seen both teams scoring/);
    const seasonMatch = lower.match(/a total of (\d+)\/(\d+) fixtures end with both teams scoring/);
    const pctMatch = lower.match(/that's (\d+)% of all matches played/);

    let result = '';
    if (recentMatch) {
      result = `${teamName}'nın son ${recentMatch[1]} maçında iki takım da gol attı`;
    }
    if (seasonMatch && pctMatch) {
      result += `. Bu sezon ${teamName}'nın oynadığı ${seasonMatch[2]} maçın ${seasonMatch[1]}'inde (%${pctMatch[1]}) "Karşılıklı gol var" (BTTS) gerçekleşti`;
    }
    return result + '.';
  }

  // Pattern 24: "[Team] is unbeaten in the last X games coming into this fixture against [Opponent],
  //              having won Y and drawn Z. They have scored N goals in those X games."
  if (lower.includes('is unbeaten in the last') && lower.includes('coming into this fixture')) {
    const unbeatenMatch = lower.match(/is unbeaten in the last (\d+) games coming into this fixture/);
    const wdMatch = lower.match(/having won (\d+) and drawn (\d+)/);
    const goalsMatch = lower.match(/scored (\d+) goals in those (\d+) games/);

    if (unbeatenMatch) {
      let result = `${teamName} son ${unbeatenMatch[1]} maçtır yenilmiyor`;
      if (wdMatch) {
        result += ` (${wdMatch[1]} galibiyet, ${wdMatch[2]} beraberlik)`;
      }
      if (goalsMatch) {
        result += ` ve bu maçlarda toplam ${goalsMatch[1]} gol attı`;
      }
      return result + '.';
    }
  }

  // Pattern 25: "[Team] will need to improve their attack if they're to get anything out of this game.
  //              They have not scored in the last X matches. During the last five games they have scored Y times
  //              and overall this season they have scored Z goals per game."
  if (lower.includes('will need to improve their attack')) {
    const noScoreMatch = lower.match(/not scored in the last (\d+) matches/);
    const lastFiveMatch = lower.match(/last five games they have scored (\d+) times/);
    const avgMatch = lower.match(/this season they have scored ([\d.]+) goals per game/);

    let result = `${teamName} bu maçtan bir şeyler çıkarmak istiyorsa hücumunu geliştirmesi gerekiyor`;
    if (noScoreMatch) {
      result += `; son ${noScoreMatch[1]} maçta gol atamadı`;
    }
    if (lastFiveMatch) {
      result += `. Son 5 maçta ${lastFiveMatch[1]} gol attı`;
    }
    if (avgMatch) {
      result += ` ve bu sezon maç başına ortalama ${avgMatch[1]} gol kaydediyor`;
    }
    return result + '.';
  }

  // Fallback: Generic translation based on sentiment
  if (lower.includes('great') || lower.includes('good form')) {
    return `${teamName} iyi bir performans sergiliyor.`;
  }
  if (lower.includes('struggling') || lower.includes('poor')) {
    return `${teamName} zorlu bir dönemden geçiyor.`;
  }

  // No pattern matched — return empty string to exclude from output rather than showing English
  logger.warn(`[TrendsGenerator] No pattern matched for trend text: "${text.substring(0, 80)}..."`);
  return '';
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

  // PRIORITY 1: Use FootyStats trends ONLY — no synthetic supplements
  // Goal: 100% match with FootyStats website data
  if (data.trends?.home && data.trends.home.length > 0) {
    logger.info('[TrendsGenerator] Using FootyStats trends exclusively');
    const homeTrends = convertFootyStatsTrendsToTurkish(data.trends.home, homeTeam);
    const awayTrends = convertFootyStatsTrendsToTurkish(data.trends.away || [], awayTeam);

    const result = {
      home: homeTrends.slice(0, 10),
      away: awayTrends.slice(0, 10),
    };

    logger.info('[TrendsGenerator] Final result:', {
      home_count: result.home.length,
      away_count: result.away.length,
      home: result.home,
      away: result.away,
    });

    return result;
  }

  // PRIORITY 2: No FootyStats trends — use form-string analysis only (WWLDW based)
  // This is the only supplement allowed as it's derived from actual FootyStats form strings
  logger.info('[TrendsGenerator] No FootyStats trends, using form-string analysis');
  const homeTrends = calculateAdditionalTrends(homeTeam, true, data);
  const awayTrends = calculateAdditionalTrends(awayTeam, false, data);

  const result = {
    home: homeTrends.slice(0, 10),
    away: awayTrends.slice(0, 10),
  };

  logger.info('[TrendsGenerator] Final result:', {
    home_count: result.home.length,
    away_count: result.away.length,
    home: result.home,
    away: result.away,
  });

  return result;
}
