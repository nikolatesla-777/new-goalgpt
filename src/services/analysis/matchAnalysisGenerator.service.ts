/**
 * Match Analysis Generator Service
 *
 * Generates detailed Turkish match analysis text from FootyStats data
 * for publishing to Telegram channels
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { logger } from '../../utils/logger';

// ============================================================================
// INTERFACES
// ============================================================================

interface MatchData {
  home_name: string;
  away_name: string;
  competition_name: string;
  date_unix: number;
  btts_potential?: number;
  o25_potential?: number;
  o15_potential?: number;
  ht_over_05_potential?: number;
  team_a_xg_prematch?: number;
  team_b_xg_prematch?: number;
  team_a_form?: string;
  team_b_form?: string;
  team_a_form_string?: string;  // W-W-D-L-W formatında son 5 maç
  team_b_form_string?: string;  // W-W-D-L-W formatında son 5 maç

  // First Half Stats (Home/Away specific)
  team_a_ht_goals_scored?: number;   // Ev sahibi ilk yarı gol ortalaması (ev sahibi olarak)
  team_a_ht_goals_conceded?: number; // Ev sahibi ilk yarı yediği gol ortalaması (ev sahibi olarak)
  team_b_ht_goals_scored?: number;   // Deplasman ilk yarı gol ortalaması (deplasman olarak)
  team_b_ht_goals_conceded?: number; // Deplasman ilk yarı yediği gol ortalaması (deplasman olarak)

  corners_potential?: number;
  cards_potential?: number;
  shots_potential?: number;
  fouls_potential?: number;
  odds_ft_1?: number;
  odds_ft_x?: number;
  odds_ft_2?: number;
  h2h?: {
    total_matches?: number;
    home_wins?: number;
    draws?: number;
    away_wins?: number;
    btts_pct?: number;
    avg_goals?: number;
    over15_pct?: number;
    over25_pct?: number;
    over35_pct?: number;
  };
  trends?: {
    home?: Array<{ sentiment: string; text: string }>;
    away?: Array<{ sentiment: string; text: string }>;
  };
}

interface MatchAnalysis {
  title: string;
  fullAnalysis: string;
  recommendations: Array<{
    market: string;
    prediction: string;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  generatedAt: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date in Turkish
 */
function formatMatchDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get confidence level emoji
 */
function getConfidenceEmoji(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high': return '🔥';
    case 'medium': return '⭐';
    case 'low': return '💡';
  }
}

/**
 * Determine confidence level from percentage
 */
function getConfidenceLevel(percentage: number): 'high' | 'medium' | 'low' {
  if (percentage >= 70) return 'high';
  if (percentage >= 55) return 'medium';
  return 'low';
}

// ============================================================================
// ANALYSIS GENERATORS
// ============================================================================

/**
 * Generate BTTS (Both Teams To Score) analysis
 */
function generateBTTSAnalysis(match: MatchData): string | null {
  if (!match.btts_potential) return null;

  const bttsPercent = match.btts_potential;
  const hasH2H = match.h2h && match.h2h.btts_pct !== undefined;

  let analysis = `**Karşılıklı Gol (BTTS):**\n`;
  analysis += `FootyStats modelimiz, bu maçta her iki takımın da gol atma olasılığını %${bttsPercent} olarak hesaplamaktadır. `;

  if (hasH2H && match.h2h!.btts_pct) {
    analysis += `İki takım arasındaki son ${match.h2h!.total_matches || 0} maçın ${match.h2h!.btts_pct}%'sinde karşılıklı gol görülmüştür. `;
  }

  if (bttsPercent >= 65) {
    analysis += `Bu yüksek oran, her iki takımın da defansif zaafiyetlere sahip olduğunu ve golcü formda olduğunu göstermektedir.`;
  } else if (bttsPercent >= 50) {
    analysis += `Orta seviyedeki bu oran, maçın gol potansiyeli taşıdığını ancak kesin olmadığını işaret etmektedir.`;
  } else {
    analysis += `Düşük oran, takımlardan en az birinin defansif güce sahip olduğunu veya hücumda sıkıntı yaşadığını gösterebilir.`;
  }

  return analysis;
}

/**
 * Generate Over 2.5 Goals analysis
 */
function generateO25Analysis(match: MatchData): string | null {
  if (!match.o25_potential) return null;

  const o25Percent = match.o25_potential;
  const totalXG = (match.team_a_xg_prematch || 0) + (match.team_b_xg_prematch || 0);
  const hasH2H = match.h2h && match.h2h.avg_goals !== undefined;

  let analysis = `**2.5 Üst (Over 2.5 Goals):**\n`;
  analysis += `Maçta 3 veya daha fazla gol görülme olasılığı %${o25Percent} olarak tahmin edilmektedir. `;

  if (match.team_a_xg_prematch !== undefined && match.team_b_xg_prematch !== undefined) {
    analysis += `Expected Goals (xG) analizi, ${match.home_name} için ${match.team_a_xg_prematch.toFixed(2)} ve ${match.away_name} için ${match.team_b_xg_prematch.toFixed(2)} gol beklentisi göstermektedir (Toplam: ${totalXG.toFixed(2)}). `;
  }

  if (hasH2H && match.h2h!.avg_goals) {
    analysis += `İki takım karşılaşmalarında ortalama ${match.h2h!.avg_goals.toFixed(2)} gol atılmıştır. `;
  }

  if (o25Percent >= 65) {
    analysis += `Yüksek skor beklentisi, her iki takımın da hücum odaklı oyun tarzına sahip olduğunu işaret ediyor.`;
  } else if (o25Percent >= 50) {
    analysis += `Orta seviyedeki oran, maçın gol potansiyeli taşıdığını gösteriyor ancak savunma hatları da etkili olabilir.`;
  } else {
    analysis += `Düşük oran, maçın defansif bir karaktere sahip olabileceğini veya takımların temkinli yaklaşabileceğini gösteriyor.`;
  }

  return analysis;
}

/**
 * Generate Over 1.5 Goals analysis
 */
function generateO15Analysis(match: MatchData): string | null {
  if (!match.o15_potential) return null;

  const o15Percent = match.o15_potential;
  const hasH2H = match.h2h && match.h2h.over15_pct !== undefined;

  let analysis = `**1.5 Üst (Over 1.5 Goals):**\n`;
  analysis += `Maçta en az 2 gol görülme ihtimali %${o15Percent} seviyesindedir. `;

  if (hasH2H && match.h2h!.over15_pct) {
    analysis += `Geçmiş karşılaşmalarda bu barajın aşılma oranı %${match.h2h!.over15_pct} olarak kaydedilmiştir. `;
  }

  if (o15Percent >= 80) {
    analysis += `Bu çok yüksek oran, düşük skorlu bir maç beklentisinin oldukça zayıf olduğunu göstermektedir.`;
  } else if (o15Percent >= 65) {
    analysis += `Yüksek oran, maçta gol göreceğimize dair güçlü bir işaret vermektedir.`;
  } else {
    analysis += `Oran, maçta gol olması muhtemel olsa da düşük skorlu bir maç ihtimalini tamamen bertaraf etmemektedir.`;
  }

  return analysis;
}

/**
 * Generate xG (Expected Goals) analysis
 */
function generateXGAnalysis(match: MatchData): string | null {
  if (match.team_a_xg_prematch === undefined || match.team_b_xg_prematch === undefined) {
    return null;
  }

  const homeXG = match.team_a_xg_prematch;
  const awayXG = match.team_b_xg_prematch;
  const totalXG = homeXG + awayXG;
  const difference = Math.abs(homeXG - awayXG);

  let analysis = `**Beklenen Gol (Expected Goals - xG):**\n`;
  analysis += `${match.home_name} için beklenen gol: ${homeXG.toFixed(2)}, ${match.away_name} için: ${awayXG.toFixed(2)}. `;
  analysis += `Toplam beklenen gol sayısı ${totalXG.toFixed(2)}'dir. `;

  if (difference > 0.5) {
    const favorite = homeXG > awayXG ? match.home_name : match.away_name;
    analysis += `xG farkı (${difference.toFixed(2)}), ${favorite} takımının hücum gücü açısından belirgin bir avantaja sahip olduğunu göstermektedir.`;
  } else {
    analysis += `xG değerleri dengeli bir maç beklentisi ortaya koymaktadır. Her iki takım da gol şansı yaratabilir.`;
  }

  return analysis;
}

/**
 * Generate corners analysis
 */
function generateCornersAnalysis(match: MatchData): string | null {
  if (!match.corners_potential) return null;

  const corners = match.corners_potential;

  let analysis = `**Korner İstatistikleri:**\n`;
  analysis += `Maç başına beklenen toplam korner sayısı yaklaşık ${corners.toFixed(1)} olarak hesaplanmaktadır. `;

  if (corners >= 10) {
    analysis += `Yüksek korner beklentisi, her iki takımın da kanat oyununa önem verdiğini ve hücum bölgesinde yoğun baskı kuracağını gösteriyor.`;
  } else if (corners >= 8) {
    analysis += `Orta seviyedeki korner beklentisi, maçın dengeli bir tempo ile oynanacağını işaret ediyor.`;
  } else {
    analysis += `Düşük korner beklentisi, takımların orta sahada daha çok top kontrolü sağlayacağını veya kontratak futbolu oynayacağını gösterebilir.`;
  }

  return analysis;
}

/**
 * Generate HT Over 0.5 (First Half Goals) analysis
 */
function generateHTOver05Analysis(match: MatchData): string | null {
  if (!match.ht_over_05_potential) return null;

  const htOver05 = match.ht_over_05_potential;

  let analysis = `**İlk Yarı Gol (HT Over 0.5):**\n`;
  analysis += `İlk yarıda en az 1 gol görülme olasılığı %${htOver05} olarak hesaplanmaktadır. `;

  if (htOver05 >= 70) {
    analysis += `Yüksek oran, her iki takımın da maça hızlı başlayacağını ve erken gol arayışında olacağını gösteriyor. İlk 45 dakikada tempolu bir oyun beklenmektedir.`;
  } else if (htOver05 >= 55) {
    analysis += `Orta seviyedeki oran, takımların tempo tuttuğunu ve ilk yarıda gol görmemizin muhtemel olduğunu işaret ediyor.`;
  } else {
    analysis += `Düşük oran, takımların temkinli başlayabileceğini ve ilk yarının daha taktiksel geçebileceğini gösteriyor. Asıl hareketlilik ikinci yarıda olabilir.`;
  }

  // Add team-specific first half stats
  const hasHomeStats = match.team_a_ht_goals_scored !== undefined || match.team_a_ht_goals_conceded !== undefined;
  const hasAwayStats = match.team_b_ht_goals_scored !== undefined || match.team_b_ht_goals_conceded !== undefined;

  if (hasHomeStats || hasAwayStats) {
    analysis += `\n\n**Takım Bazında İlk Yarı İstatistikleri:**\n`;

    if (hasHomeStats) {
      const homeScored = match.team_a_ht_goals_scored ?? 0;
      const homeConceded = match.team_a_ht_goals_conceded ?? 0;
      const scoringEmoji = homeScored >= 0.7 ? '⚽' : homeScored >= 0.5 ? '🎯' : '🔻';
      const defendingEmoji = homeConceded <= 0.4 ? '🛡️' : homeConceded <= 0.7 ? '⚠️' : '🔴';

      analysis += `${scoringEmoji} **${match.home_name} (Ev Sahibi)**: İlk yarıda ortalama ${homeScored.toFixed(2)} gol atıyor, ${homeConceded.toFixed(2)} gol yiyor.\n`;
    }

    if (hasAwayStats) {
      const awayScored = match.team_b_ht_goals_scored ?? 0;
      const awayConceded = match.team_b_ht_goals_conceded ?? 0;
      const scoringEmoji = awayScored >= 0.7 ? '⚽' : awayScored >= 0.5 ? '🎯' : '🔻';
      const defendingEmoji = awayConceded <= 0.4 ? '🛡️' : awayConceded <= 0.7 ? '⚠️' : '🔴';

      analysis += `${scoringEmoji} **${match.away_name} (Deplasman)**: İlk yarıda ortalama ${awayScored.toFixed(2)} gol atıyor, ${awayConceded.toFixed(2)} gol yiyor.`;
    }
  }

  return analysis;
}

/**
 * Generate cards analysis
 */
function generateCardsAnalysis(match: MatchData): string | null {
  if (!match.cards_potential) return null;

  const cards = match.cards_potential;

  let analysis = `**Kart İstatistikleri:**\n`;
  analysis += `Maçta beklenen toplam kart sayısı yaklaşık ${cards.toFixed(1)}'dir. `;

  if (cards >= 4) {
    analysis += `Yüksek kart beklentisi, maçın fiziksel ve sert geçebileceğini, hakem kontrolünün önemli olacağını göstermektedir. Sarı kart bahisleri için uygun bir maç olabilir.`;
  } else if (cards >= 2.5) {
    analysis += `Orta seviyedeki kart beklentisi, normal düzeyde fiziksel mücadele beklediğimizi gösteriyor.`;
  } else {
    analysis += `Düşük kart beklentisi, maçın fair-play çerçevesinde, teknik ağırlıklı oynanacağını işaret ediyor.`;
  }

  return analysis;
}

/**
 * Generate form and trends analysis
 */
function generateFormAnalysis(match: MatchData): string | null {
  const hasTrends = match.trends && (match.trends.home?.length || match.trends.away?.length);
  const hasForm = match.team_a_form || match.team_b_form;

  if (!hasTrends && !hasForm) return null;

  let analysis = `**Form ve Trend Analizi:**\n`;

  // Home team trends
  if (match.trends?.home && match.trends.home.length > 0) {
    const positiveTrends = match.trends.home.filter(t => t.sentiment === 'positive').length;
    const negativeTrends = match.trends.home.filter(t => t.sentiment === 'negative').length;

    analysis += `${match.home_name}: `;
    if (positiveTrends > negativeTrends) {
      analysis += `Son dönemde yükselen bir grafik çiziyor. ${match.trends.home.slice(0, 2).map(t => t.text).join(', ')}. `;
    } else if (negativeTrends > positiveTrends) {
      analysis += `Son maçlarda zorluk yaşıyor. ${match.trends.home.slice(0, 2).map(t => t.text).join(', ')}. `;
    } else {
      analysis += `İstikrarlı bir performans sergiliyor. `;
    }
  }

  // Away team trends
  if (match.trends?.away && match.trends.away.length > 0) {
    const positiveTrends = match.trends.away.filter(t => t.sentiment === 'positive').length;
    const negativeTrends = match.trends.away.filter(t => t.sentiment === 'negative').length;

    analysis += `${match.away_name}: `;
    if (positiveTrends > negativeTrends) {
      analysis += `İyi bir formda. ${match.trends.away.slice(0, 2).map(t => t.text).join(', ')}. `;
    } else if (negativeTrends > positiveTrends) {
      analysis += `Form düşüklüğü yaşıyor. ${match.trends.away.slice(0, 2).map(t => t.text).join(', ')}. `;
    } else {
      analysis += `Dengeli bir süreç geçiriyor. `;
    }
  }

  // Detailed form analysis with W-D-L breakdown
  analysis += `\n\n**Sezon Performansı:**\n`;

  if (match.team_a_form_string) {
    // Parse form string: "5G-2B-3M (10 maç)"
    const homeWins = parseInt(match.team_a_form_string.match(/(\d+)G/)?.[1] || '0');
    const homeLosses = parseInt(match.team_a_form_string.match(/(\d+)M/)?.[1] || '0');
    const homeEmoji = homeWins >= homeLosses + 2 ? '🔥' : homeWins > homeLosses ? '⭐' : homeLosses >= homeWins + 2 ? '❄️' : '➡️';
    analysis += `${homeEmoji} **${match.home_name}**: ${match.team_a_form_string}\n`;
  }

  if (match.team_b_form_string) {
    // Parse form string: "5G-2B-3M (10 maç)"
    const awayWins = parseInt(match.team_b_form_string.match(/(\d+)G/)?.[1] || '0');
    const awayLosses = parseInt(match.team_b_form_string.match(/(\d+)M/)?.[1] || '0');
    const awayEmoji = awayWins >= awayLosses + 2 ? '🔥' : awayWins > awayLosses ? '⭐' : awayLosses >= awayWins + 2 ? '❄️' : '➡️';
    analysis += `${awayEmoji} **${match.away_name}**: ${match.team_b_form_string}`;
  }

  return analysis;
}

/**
 * Generate H2H (Head-to-Head) analysis
 */
function generateH2HAnalysis(match: MatchData): string | null {
  if (!match.h2h || !match.h2h.total_matches || match.h2h.total_matches === 0) {
    return null;
  }

  const h2h = match.h2h;

  let analysis = `**Kafa Kafaya İstatistikler:**\n`;
  analysis += `İki takım son ${h2h.total_matches} maçta karşılaştı. `;
  analysis += `${match.home_name} ${h2h.home_wins || 0} galibiyet, ${match.away_name} ${h2h.away_wins || 0} galibiyet aldı, ${h2h.draws || 0} maç berabere sonuçlandı. `;

  if (h2h.avg_goals) {
    analysis += `Bu karşılaşmalarda ortalama ${h2h.avg_goals.toFixed(2)} gol atıldı. `;
  }

  if (h2h.btts_pct) {
    analysis += `Maçların %${h2h.btts_pct}'sinde her iki takım da gol attı. `;
  }

  // Determine dominant team
  const homeWins = h2h.home_wins || 0;
  const awayWins = h2h.away_wins || 0;
  if (homeWins > awayWins + 1) {
    analysis += `Geçmiş performans, ${match.home_name}'nın bu eşleşmede psikolojik üstünlüğe sahip olduğunu gösteriyor.`;
  } else if (awayWins > homeWins + 1) {
    analysis += `${match.away_name}'nın bu eşleşmedeki geçmiş başarısı, takıma güven verebilir.`;
  } else {
    analysis += `Dengeli geçmiş sonuçlar, her iki takımın da kazanma şansına sahip olduğunu gösteriyor.`;
  }

  return analysis;
}

/**
 * Generate odds analysis
 */
function generateOddsAnalysis(match: MatchData): string | null {
  if (!match.odds_ft_1 || !match.odds_ft_x || !match.odds_ft_2) {
    return null;
  }

  const homeOdds = match.odds_ft_1;
  const drawOdds = match.odds_ft_x;
  const awayOdds = match.odds_ft_2;

  let analysis = `**Bahis Oranları:**\n`;
  analysis += `Ev sahibi galibiyeti: ${homeOdds.toFixed(2)}, Beraberlik: ${drawOdds.toFixed(2)}, Deplasman galibiyeti: ${awayOdds.toFixed(2)}. `;

  // Determine favorite
  const minOdds = Math.min(homeOdds, drawOdds, awayOdds);
  if (minOdds === homeOdds && homeOdds < awayOdds - 0.5) {
    analysis += `Bahis piyasası ${match.home_name}'yı net favorisi olarak görüyor.`;
  } else if (minOdds === awayOdds && awayOdds < homeOdds - 0.5) {
    analysis += `Bahis piyasası ${match.away_name}'yı favorisi olarak değerlendiriyor.`;
  } else {
    analysis += `Oranlar dengeli bir maç beklentisini yansıtıyor, her iki takımın da kazanma şansı var.`;
  }

  return analysis;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(match: MatchData): Array<{
  market: string;
  prediction: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  const recommendations = [];

  // BTTS Recommendation
  if (match.btts_potential && match.btts_potential >= 50) {
    const confidence = getConfidenceLevel(match.btts_potential);
    recommendations.push({
      market: 'Karşılıklı Gol',
      prediction: 'Var',
      reasoning: `Her iki takımın da gol atma olasılığı %${match.btts_potential} seviyesindedir. ${
        match.h2h?.btts_pct
          ? `Son karşılaşmaların %${match.h2h.btts_pct}'sinde karşılıklı gol görülmüştür.`
          : 'İstatistiksel veriler bu tahmini desteklemektedir.'
      }`,
      confidence,
    });
  }

  // Over 2.5 Recommendation
  if (match.o25_potential && match.o25_potential >= 50) {
    const confidence = getConfidenceLevel(match.o25_potential);
    const totalXG = (match.team_a_xg_prematch || 0) + (match.team_b_xg_prematch || 0);
    recommendations.push({
      market: '2.5 Üst',
      prediction: 'Var',
      reasoning: `Maçta 3+ gol görülme olasılığı %${match.o25_potential}'dir. ${
        totalXG > 2.5
          ? `Toplam xG değeri (${totalXG.toFixed(2)}) bu beklentiyi desteklemektedir.`
          : 'İstatistiksel analiz yüksek skor beklentisini göstermektedir.'
      }`,
      confidence,
    });
  }

  // Over 1.5 Recommendation
  if (match.o15_potential && match.o15_potential >= 70) {
    const confidence = getConfidenceLevel(match.o15_potential);
    recommendations.push({
      market: '1.5 Üst',
      prediction: 'Var',
      reasoning: `Maçta en az 2 gol görülme ihtimali %${match.o15_potential} gibi yüksek bir seviyededir. Düşük skorlu bir maç beklentisi oldukça zayıftır.`,
      confidence,
    });
  }

  // HT Over 0.5 Recommendation
  if (match.ht_over_05_potential && match.ht_over_05_potential >= 60) {
    const confidence = getConfidenceLevel(match.ht_over_05_potential);
    recommendations.push({
      market: 'İlk Yarı Gol',
      prediction: '0.5 Üst',
      reasoning: `İlk yarıda en az 1 gol görülme olasılığı %${match.ht_over_05_potential} seviyesindedir. Takımlar maça hızlı başlayacak ve erken gol arayışında olacaktır.`,
      confidence,
    });
  }

  // Corners Recommendation
  if (match.corners_potential && match.corners_potential >= 9) {
    const confidence = match.corners_potential >= 10 ? 'high' : 'medium';
    recommendations.push({
      market: 'Korner',
      prediction: `${Math.floor(match.corners_potential)}.5 Üst`,
      reasoning: `Maç başına beklenen korner sayısı ${match.corners_potential.toFixed(1)}'dir. Her iki takım da kanat oyununa önem veren bir tarz sergiliyor.`,
      confidence,
    });
  }

  // Cards Recommendation
  if (match.cards_potential && match.cards_potential >= 3.5) {
    const confidence = match.cards_potential >= 4.5 ? 'high' : 'medium';
    recommendations.push({
      market: 'Kart',
      prediction: `${Math.floor(match.cards_potential)}.5 Üst`,
      reasoning: `Maçta beklenen toplam kart sayısı ${match.cards_potential.toFixed(1)}'dir. Fiziksel bir mücadele ve yüksek tempo beklenmektedir.`,
      confidence,
    });
  }

  return recommendations;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate complete match analysis
 */
export function generateMatchAnalysis(match: MatchData): MatchAnalysis {
  logger.info(`[MatchAnalysisGenerator] Generating analysis for ${match.home_name} vs ${match.away_name}`);

  // Generate title
  const matchDate = formatMatchDate(match.date_unix);
  const title = `🍀 Maçı Hakkında Analizim\n\nFutbol\n${match.competition_name}\n${match.home_name} - ${match.away_name}\n${matchDate}`;

  // Generate analysis sections
  const sections = [
    generateXGAnalysis(match),
    generateBTTSAnalysis(match),
    generateO25Analysis(match),
    generateO15Analysis(match),
    generateHTOver05Analysis(match),
    generateCornersAnalysis(match),
    generateCardsAnalysis(match),
    generateFormAnalysis(match),
    generateH2HAnalysis(match),
    generateOddsAnalysis(match),
  ].filter(Boolean); // Remove null sections

  // Combine all sections
  const fullAnalysis = sections.join('\n\n');

  // Generate recommendations
  const recommendations = generateRecommendations(match);

  logger.info(`[MatchAnalysisGenerator] ✅ Analysis generated with ${recommendations.length} recommendations`);

  return {
    title,
    fullAnalysis,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format analysis for Telegram (plain text)
 */
export function formatAnalysisForTelegram(analysis: MatchAnalysis): string {
  let formatted = `${analysis.title}\n\n`;
  formatted += `${analysis.fullAnalysis}\n\n`;
  formatted += `📊 Maç hakkında elimdeki verilere dayanarak şu önerileri verebilirim: 🍀\n\n`;

  analysis.recommendations.forEach((rec) => {
    const emoji = getConfidenceEmoji(rec.confidence);
    formatted += `${emoji} **${rec.market}** => ${rec.prediction}\n`;
    formatted += `Yorumum: ${rec.reasoning}\n\n`;
  });

  formatted += `⚠️ Bu analiz istatistiksel verilere dayanmaktadır. Lütfen kendi araştırmanızı da yapın.`;

  return formatted;
}

/**
 * Format analysis for copyable text (with markdown)
 */
export function formatAnalysisForCopy(analysis: MatchAnalysis): string {
  let formatted = analysis.title + '\n\n';
  formatted += analysis.fullAnalysis + '\n\n';
  formatted += 'Maç hakkında elimdeki verilere dayanarak şu önerileri verebilirim: 🍀\n\n';

  analysis.recommendations.forEach((rec, idx) => {
    const emoji = getConfidenceEmoji(rec.confidence);
    formatted += `${emoji} ${rec.market} => ${rec.prediction}\n\n`;
    formatted += `Yorumum: ${rec.reasoning}\n`;
    if (idx < analysis.recommendations.length - 1) {
      formatted += '\n---\n\n';
    }
  });

  return formatted;
}
