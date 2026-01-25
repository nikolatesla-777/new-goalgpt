/**
 * Turkish Trends Generator
 *
 * Converts FootyStats English trends to Turkish bullet points
 * Also provides rule-based trend generation when FootyStats data is unavailable
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

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
    home?: Array<{ sentiment: string; text: string }>;
    away?: Array<{ sentiment: string; text: string }>;
  };
}

/**
 * Convert FootyStats English trends to Turkish dipnot format
 * NOT literal translation - rewrite as Turkish bullet notes
 */
function convertFootyStatsTrendsToTurkish(
  trends: Array<{ sentiment: string; text: string }>,
  teamName: string
): string[] {
  const turkish: string[] = [];

  for (const trend of trends.slice(0, 4)) {  // Max 4 per team
    // Skip if text is undefined/null
    if (!trend || !trend.text) continue;

    const text = trend.text.toLowerCase();
    const sentiment = trend.sentiment;

    // Extract key facts and convert to Turkish dipnot
    if (text.includes('won') && text.includes('last')) {
      const matchCount = text.match(/last (\d+)/)?.[1];
      const winCount = text.match(/won (\d+)/)?.[1];
      if (matchCount && winCount) {
        turkish.push(`Son ${matchCount} maçta ${winCount} galibiyet`);
      }
    } else if (text.includes('not won') || text.includes('without a win')) {
      const matchCount = text.match(/last (\d+)/)?.[1] || text.match(/(\d+) games/)?.[1];
      if (matchCount) {
        turkish.push(`Son ${matchCount} maçta galibiyetsiz`);
      }
    } else if (text.includes('clean sheet')) {
      const count = text.match(/(\d+) clean sheet/)?.[1];
      if (count) {
        turkish.push(`${count} maçta kalesini gole kapatmış`);
      } else {
        turkish.push('Savunma güçlü, temiz çıkışlar yapıyor');
      }
    } else if (text.includes('both teams scoring') || text.includes('btts')) {
      const pct = text.match(/(\d+)%/)?.[1] || text.match(/(\d+)\/(\d+)/)?.[1];
      if (pct) {
        turkish.push(`Maçların %${pct}'inde karşılıklı gol var`);
      } else {
        turkish.push('Karşılıklı gol sıklığı yüksek');
      }
    } else if (text.includes('scored') && text.includes('last')) {
      const goals = text.match(/scored (\d+)/)?.[1];
      const matches = text.match(/last (\d+)/)?.[1];
      if (goals && matches) {
        turkish.push(`Son ${matches} maçta ${goals} gol atmış`);
      }
    } else if (text.includes('conceded') && text.includes('last')) {
      const goals = text.match(/conceded (\d+)/)?.[1];
      const matches = text.match(/last (\d+)/)?.[1];
      if (goals && matches) {
        turkish.push(`Son ${matches} maçta ${goals} gol yemiş`);
      }
    } else if (text.includes('over 2.5') || text.includes('2.5 goals')) {
      const count = text.match(/(\d+) of/)?.[1] || text.match(/last (\d+)/)?.[1];
      if (count) {
        turkish.push(`Son ${count} maçın çoğunda 2.5 üst gerçekleşmiş`);
      }
    } else if (text.includes('points per game') || text.includes('ppg')) {
      const ppg = text.match(/(\d+\.\d+)/)?.[1];
      if (ppg) {
        turkish.push(`Maç başı ortalama ${ppg} puan alıyor`);
      }
    } else if (sentiment === 'great' || sentiment === 'good') {
      // Generic positive trend
      turkish.push('İyi bir performans çıkarıyor');
    } else if (sentiment === 'bad' || sentiment === 'chart') {
      // Generic negative/neutral trend
      turkish.push('Form dalgalanmaları gösteriyor');
    }
  }

  return turkish.slice(0, 4);  // Max 4 bullets per team
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
  // PRIORITY 1: Use FootyStats trends if available
  if (data.trends?.home && data.trends.home.length > 0) {
    return {
      home: convertFootyStatsTrendsToTurkish(data.trends.home, homeTeam),
      away: convertFootyStatsTrendsToTurkish(data.trends.away || [], awayTeam),
    };
  }

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

  return {
    home: homeTrends.slice(0, 3),  // EXACTLY 3 bullets
    away: awayTrends.slice(0, 3),  // EXACTLY 3 bullets
  };
}
