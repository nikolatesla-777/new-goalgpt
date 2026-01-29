/**
 * AI Summary Formatter Service - Phase-3B.1
 *
 * Generates structured match summaries deterministically
 * Uses Week-2A scoring data + FootyStats data
 * Output is schema-validated and localized (TR/EN)
 */

import type {
  AISummaryRequest,
  AISummaryResponse,
  AISummaryKeyAngle,
  AISummaryBetIdea,
  MatchSummaryInput,
  ValidationResult,
} from '../../types/aiSummary.types';
import { logger } from '../../utils/logger';

/**
 * Localization strings
 */
const LOCALE_STRINGS = {
  tr: {
    title_template: '{home} vs {away} - {competition} Analizi',
    high_scoring_angle: 'Yüksek Gol Potansiyeli',
    high_scoring_desc: 'Her iki takım da yüksek xG değerlerine sahip ({xg_total}). Gollü bir maç bekleniyor.',
    btts_angle: 'Karşılıklı Gol',
    btts_desc: 'İki takım da son maçlarında {btts_pct}% BTTS oranıyla golcü performans sergiledi.',
    form_angle: 'Takım Formu',
    form_desc: '{home} ev sahasında güçlü ({home_ppg} PPG), {away} ise deplasmanda {away_ppg} PPG ortalamasına sahip.',
    odds_value_angle: 'Oran Değeri',
    odds_value_desc: 'Market oranları scoring engine ile karşılaştırıldığında değer var.',
    corners_angle: 'Korner Beklentisi',
    corners_desc: 'Takımların ortalama korner sayısı ({corners_avg}) yüksek seviyede.',
    bet_idea_over25: 'Yüksek xG ve takım formu nedeniyle 2.5 üst gol öneriliyor.',
    bet_idea_btts: 'Her iki takımın da gol atma kapasitesi yüksek.',
    bet_idea_ht_o05: 'İlk yarıda erken gol beklentisi var.',
    bet_idea_home_o15: '{home} ev sahasında saldırgan oyun sergiliyor.',
    disclaimer: '⚠️ Bu analiz istatistiksel verilere dayanır. Bahis riski içerir. Sorumlu bahis yapınız.',
  },
  en: {
    title_template: '{home} vs {away} - {competition} Analysis',
    high_scoring_angle: 'High Scoring Potential',
    high_scoring_desc: 'Both teams have high xG values ({xg_total}). A goal-filled match is expected.',
    btts_angle: 'Both Teams To Score',
    btts_desc: 'Both teams have shown scoring form with {btts_pct}% BTTS rate in recent matches.',
    form_angle: 'Team Form',
    form_desc: '{home} is strong at home ({home_ppg} PPG), while {away} has {away_ppg} PPG away.',
    odds_value_angle: 'Odds Value',
    odds_value_desc: 'Market odds show value compared to scoring engine probabilities.',
    corners_angle: 'Corner Expectation',
    corners_desc: 'Teams average corner count ({corners_avg}) is at a high level.',
    bet_idea_over25: 'Over 2.5 goals recommended due to high xG and team form.',
    bet_idea_btts: 'Both teams have strong scoring capacity.',
    bet_idea_ht_o05: 'Early goal expected in first half.',
    bet_idea_home_o15: '{home} plays aggressive football at home.',
    disclaimer: '⚠️ This analysis is based on statistical data. Betting involves risk. Please bet responsibly.',
  },
};

/**
 * Validate summary response schema
 */
export function validateSummarySchema(summary: any): ValidationResult {
  const errors: string[] = [];

  if (!summary || typeof summary !== 'object') {
    errors.push('Summary must be an object');
    return { valid: false, errors };
  }

  // Required fields
  if (!summary.match_id || typeof summary.match_id !== 'string') {
    errors.push('match_id is required and must be a string');
  }

  if (!summary.title || typeof summary.title !== 'string') {
    errors.push('title is required and must be a string');
  }

  if (!Array.isArray(summary.key_angles)) {
    errors.push('key_angles must be an array');
  } else {
    summary.key_angles.forEach((angle: any, idx: number) => {
      if (!angle.icon || typeof angle.icon !== 'string') {
        errors.push(`key_angles[${idx}].icon is required`);
      }
      if (!angle.title || typeof angle.title !== 'string') {
        errors.push(`key_angles[${idx}].title is required`);
      }
      if (!angle.description || typeof angle.description !== 'string') {
        errors.push(`key_angles[${idx}].description is required`);
      }
    });
  }

  if (!Array.isArray(summary.bet_ideas)) {
    errors.push('bet_ideas must be an array');
  } else {
    summary.bet_ideas.forEach((idea: any, idx: number) => {
      if (!idea.market || typeof idea.market !== 'string') {
        errors.push(`bet_ideas[${idx}].market is required`);
      }
      if (!idea.reason || typeof idea.reason !== 'string') {
        errors.push(`bet_ideas[${idx}].reason is required`);
      }
      if (typeof idea.confidence !== 'number' || idea.confidence < 0 || idea.confidence > 100) {
        errors.push(`bet_ideas[${idx}].confidence must be a number between 0-100`);
      }
    });
  }

  if (!summary.disclaimer || typeof summary.disclaimer !== 'string') {
    errors.push('disclaimer is required');
  }

  if (!summary.generated_at || typeof summary.generated_at !== 'string') {
    errors.push('generated_at is required');
  }

  if (!['tr', 'en'].includes(summary.locale)) {
    errors.push('locale must be "tr" or "en"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate AI summary deterministically
 * Uses template-based approach with scoring data
 */
export async function generateAISummary(
  input: MatchSummaryInput,
  locale: 'tr' | 'en' = 'tr'
): Promise<AISummaryResponse> {
  try {
    const strings = LOCALE_STRINGS[locale];

    // Extract data from inputs
    const scoringData = input.scoring_data || {};
    const footystatsData = input.footystats_data || {};

    // Build title
    const title = strings.title_template
      .replace('{home}', input.home_team)
      .replace('{away}', input.away_team)
      .replace('{competition}', input.competition);

    // Build key angles
    const keyAngles: AISummaryKeyAngle[] = [];

    // 1. High scoring potential (if xG data available)
    const xgHome = scoringData.xg?.home || 0;
    const xgAway = scoringData.xg?.away || 0;
    const xgTotal = xgHome + xgAway;

    if (xgTotal > 2.3) {
      keyAngles.push({
        icon: '⚡',
        title: strings.high_scoring_angle,
        description: strings.high_scoring_desc.replace('{xg_total}', xgTotal.toFixed(2)),
      });
    }

    // 2. BTTS potential
    const bttsPct = footystatsData.btts_pct || scoringData.btts_percentage || 0;
    if (bttsPct > 60) {
      keyAngles.push({
        icon: '⚽',
        title: strings.btts_angle,
        description: strings.btts_desc.replace('{btts_pct}', Math.round(bttsPct)),
      });
    }

    // 3. Team form
    const homePPG = footystatsData.home_ppg || scoringData.home_form?.ppg || 0;
    const awayPPG = footystatsData.away_ppg || scoringData.away_form?.ppg || 0;

    if (homePPG > 0 || awayPPG > 0) {
      keyAngles.push({
        icon: '📊',
        title: strings.form_angle,
        description: strings.form_desc
          .replace('{home}', input.home_team)
          .replace('{home_ppg}', homePPG.toFixed(2))
          .replace('{away}', input.away_team)
          .replace('{away_ppg}', awayPPG.toFixed(2)),
      });
    }

    // 4. Odds value (if edge data available)
    const hasEdge = scoringData.markets?.some((m: any) => m.edge && m.edge > 0.05);
    if (hasEdge) {
      keyAngles.push({
        icon: '💎',
        title: strings.odds_value_angle,
        description: strings.odds_value_desc,
      });
    }

    // 5. Corners potential
    const cornersAvg = footystatsData.corners_avg || 0;
    if (cornersAvg > 9) {
      keyAngles.push({
        icon: '🚩',
        title: strings.corners_angle,
        description: strings.corners_desc.replace('{corners_avg}', cornersAvg.toFixed(1)),
      });
    }

    // Limit to max 5 angles
    const finalAngles = keyAngles.slice(0, 5);

    // Build bet ideas
    const betIdeas: AISummaryBetIdea[] = [];

    // Over 2.5 idea
    const over25Confidence = scoringData.markets?.find((m: any) => m.market_id === 'O25')?.confidence || 0;
    if (over25Confidence >= 60) {
      betIdeas.push({
        market: 'Over 2.5',
        reason: strings.bet_idea_over25,
        confidence: over25Confidence,
      });
    }

    // BTTS idea
    const bttsConfidence = scoringData.markets?.find((m: any) => m.market_id === 'BTTS')?.confidence || 0;
    if (bttsConfidence >= 60) {
      betIdeas.push({
        market: 'BTTS',
        reason: strings.bet_idea_btts,
        confidence: bttsConfidence,
      });
    }

    // HT O0.5 idea
    const htO05Confidence = scoringData.markets?.find((m: any) => m.market_id === 'HT_O05')?.confidence || 0;
    if (htO05Confidence >= 60) {
      betIdeas.push({
        market: 'HT Over 0.5',
        reason: strings.bet_idea_ht_o05,
        confidence: htO05Confidence,
      });
    }

    // Home O1.5 idea
    const homeO15Confidence = scoringData.markets?.find((m: any) => m.market_id === 'HOME_O15')?.confidence || 0;
    if (homeO15Confidence >= 60) {
      betIdeas.push({
        market: `${input.home_team} Over 1.5`,
        reason: strings.bet_idea_home_o15.replace('{home}', input.home_team),
        confidence: homeO15Confidence,
      });
    }

    // Limit to max 4 bet ideas
    const finalBetIdeas = betIdeas.slice(0, 4);

    // Build final summary
    const summary = {
      match_id: input.home_team + '_vs_' + input.away_team, // Will be replaced with actual match_id
      title,
      key_angles: finalAngles,
      bet_ideas: finalBetIdeas,
      disclaimer: strings.disclaimer,
      generated_at: new Date().toISOString(),
      locale,
    };

    // Validate schema
    const validation = validateSummarySchema(summary);
    if (!validation.valid) {
      logger.error('[AISummaryFormatter] Schema validation failed:', validation.errors);
      return {
        success: false,
        error: `Schema validation failed: ${validation.errors.join(', ')}`,
      };
    }

    return {
      success: true,
      data: summary,
    };
  } catch (error: any) {
    logger.error('[AISummaryFormatter] Error generating summary:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Generate summary from match ID
 * Fetches data from Week-2A endpoint and FootyStats
 */
export async function generateSummaryFromMatchId(
  matchId: string,
  locale: 'tr' | 'en' = 'tr'
): Promise<AISummaryResponse> {
  try {
    // TODO: Fetch data from Week-2A endpoint
    // For now, return mock implementation
    logger.info(`[AISummaryFormatter] Generating summary for match ${matchId} (locale: ${locale})`);

    // This will be implemented when Week-2A is available
    return {
      success: false,
      error: 'Week-2A endpoint not available yet. Use generateAISummary() with input data.',
    };
  } catch (error: any) {
    logger.error('[AISummaryFormatter] Error in generateSummaryFromMatchId:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}
