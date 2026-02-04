/**
 * Phase-3A: Simplified Scoring Preview Service
 *
 * Provides basic scoring information for admin panel MVP.
 * This is a simplified version before Week-2A scoring pipeline is merged.
 *
 * IMPORTANT: When Week-2A is merged, replace this with full scoring system.
 */

import { footyStatsAPI } from '../footystats/footystats.client';
import { logger } from '../../utils/logger';

// Market definitions for Phase-3A
export const MARKETS = {
  O25: { id: 'O25', name: 'Over 2.5 Goals', name_tr: '2.5 Üst Gol', emoji: '📈' },
  BTTS: { id: 'BTTS', name: 'Both Teams To Score', name_tr: 'Karşılıklı Gol', emoji: '⚽' },
  HT_O05: { id: 'HT_O05', name: 'HT Over 0.5', name_tr: 'İY 0.5 Üst', emoji: '⏱️' },
  O35: { id: 'O35', name: 'Over 3.5 Goals', name_tr: '3.5 Üst Gol', emoji: '🎯' },
  HOME_O15: { id: 'HOME_O15', name: 'Home Over 1.5', name_tr: 'Ev Sahibi 1.5 Üst', emoji: '🏠' },
  CORNERS_O85: { id: 'CORNERS_O85', name: 'Corners Over 8.5', name_tr: 'Korner 8.5 Üst', emoji: '🚩' },
  CARDS_O25: { id: 'CARDS_O25', name: 'Cards Over 2.5', name_tr: 'Kart 2.5 Üst', emoji: '🟨' },
};

export type MarketId = keyof typeof MARKETS;

export interface ScoringPreview {
  match_id: string;
  fs_match_id: number;
  match_info: {
    home_team: string;
    away_team: string;
    league: string;
    kickoff_time: number;
  };
  markets: MarketPreview[];
  data_quality: {
    has_xg: boolean;
    has_potentials: boolean;
    has_odds: boolean;
    has_trends: boolean;
  };
}

export interface MarketPreview {
  market_id: MarketId;
  market_name: string;
  market_name_tr: string;
  emoji: string;
  probability: number; // 0-1 (e.g., 0.65 = 65%)
  confidence: number; // 0-100
  pick: 'YES' | 'NO' | 'SKIP';
  can_publish: boolean;
  reason: string;
  data_source: {
    xg?: { home: number; away: number; total: number };
    potential?: number;
    odds?: { home: number; draw: number; away: number };
  };
}

/**
 * Simplified scoring for Phase-3A
 * Uses FootyStats potentials + xG data
 */
export async function getMatchScoringPreview(
  fsMatchId: number
): Promise<ScoringPreview> {
  logger.info(`[ScoringPreview] Fetching scoring preview for fs_match_id=${fsMatchId}`);

  // Fetch match data from FootyStats
  const matchData = await footyStatsAPI.getMatchById(fsMatchId);

  if (!matchData) {
    throw new Error(`Match not found: fs_match_id=${fsMatchId}`);
  }

  // Check data quality
  const dataQuality = {
    has_xg: Boolean(matchData.team_a_xg_prematch && matchData.team_b_xg_prematch),
    has_potentials: Boolean(matchData.o25_potential || matchData.btts_potential),
    has_odds: Boolean(matchData.odds_ft_1 && matchData.odds_ft_x && matchData.odds_ft_2),
    has_trends: Boolean(matchData.trends),
  };

  // Generate market previews
  const markets: MarketPreview[] = [];

  // O25 Market
  if (matchData.o25_potential !== undefined) {
    markets.push(
      scoreO25Market(matchData, dataQuality)
    );
  }

  // BTTS Market
  if (matchData.btts_potential !== undefined) {
    markets.push(
      scoreBTTSMarket(matchData, dataQuality)
    );
  }

  // HT O0.5 Market
  if (matchData.o05HT_potential !== undefined) {
    markets.push(
      scoreHTOver05Market(matchData, dataQuality)
    );
  }

  // O3.5 Market (derived from O2.5 + xG)
  if (matchData.o25_potential !== undefined && dataQuality.has_xg) {
    markets.push(
      scoreO35Market(matchData, dataQuality)
    );
  }

  // HOME O1.5 Market
  if (matchData.o15_potential !== undefined) {
    markets.push(
      scoreHomeOver15Market(matchData, dataQuality)
    );
  }

  // Corners Market
  if (matchData.corners_potential !== undefined) {
    markets.push(
      scoreCornersMarket(matchData, dataQuality)
    );
  }

  // Cards Market
  if (matchData.cards_potential !== undefined) {
    markets.push(
      scoreCardsMarket(matchData, dataQuality)
    );
  }

  return {
    match_id: matchData.id.toString(),
    fs_match_id: fsMatchId,
    match_info: {
      home_team: matchData.home_name,
      away_team: matchData.away_name,
      league: matchData.competition_name || 'Bilinmeyen Lig',
      kickoff_time: matchData.date_unix,
    },
    markets,
    data_quality: dataQuality,
  };
}

// ============================================================================
// MARKET SCORERS
// ============================================================================

function scoreO25Market(matchData: any, dataQuality: any): MarketPreview {
  const potential = matchData.o25_potential / 100; // Convert to 0-1
  const xgTotal = dataQuality.has_xg
    ? matchData.team_a_xg_prematch + matchData.team_b_xg_prematch
    : 0;

  // Simple confidence: based on data completeness
  let confidence = 50;
  if (dataQuality.has_xg) confidence += 20;
  if (dataQuality.has_odds) confidence += 15;
  if (dataQuality.has_trends) confidence += 10;

  // Pick logic
  const pick = potential >= 0.65 ? 'YES' : potential >= 0.45 ? 'NO' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 65;

  return {
    market_id: 'O25',
    market_name: MARKETS.O25.name,
    market_name_tr: MARKETS.O25.name_tr,
    emoji: MARKETS.O25.emoji,
    probability: potential,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `Strong O2.5 potential (${Math.round(potential * 100)}%)`
      : `Low confidence (${confidence}/100)`,
    data_source: {
      xg: dataQuality.has_xg
        ? { home: matchData.team_a_xg_prematch, away: matchData.team_b_xg_prematch, total: xgTotal }
        : undefined,
      potential: matchData.o25_potential,
      odds: dataQuality.has_odds
        ? { home: matchData.odds_ft_1, draw: matchData.odds_ft_x, away: matchData.odds_ft_2 }
        : undefined,
    },
  };
}

function scoreBTTSMarket(matchData: any, dataQuality: any): MarketPreview {
  const potential = matchData.btts_potential / 100;

  let confidence = 50;
  if (dataQuality.has_xg) confidence += 20;
  if (dataQuality.has_odds) confidence += 15;
  if (dataQuality.has_trends) confidence += 10;

  const pick = potential >= 0.65 ? 'YES' : potential >= 0.45 ? 'NO' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 65;

  return {
    market_id: 'BTTS',
    market_name: MARKETS.BTTS.name,
    market_name_tr: MARKETS.BTTS.name_tr,
    emoji: MARKETS.BTTS.emoji,
    probability: potential,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `Strong BTTS potential (${Math.round(potential * 100)}%)`
      : `Low confidence (${confidence}/100)`,
    data_source: {
      xg: dataQuality.has_xg
        ? { home: matchData.team_a_xg_prematch, away: matchData.team_b_xg_prematch, total: 0 }
        : undefined,
      potential: matchData.btts_potential,
      odds: dataQuality.has_odds
        ? { home: matchData.odds_ft_1, draw: matchData.odds_ft_x, away: matchData.odds_ft_2 }
        : undefined,
    },
  };
}

function scoreHTOver05Market(matchData: any, dataQuality: any): MarketPreview {
  const potential = matchData.o05HT_potential / 100;

  let confidence = 45; // Slightly lower baseline for HT
  if (dataQuality.has_xg) confidence += 15;
  if (dataQuality.has_trends) confidence += 10;

  const pick = potential >= 0.70 ? 'YES' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 60;

  return {
    market_id: 'HT_O05',
    market_name: MARKETS.HT_O05.name,
    market_name_tr: MARKETS.HT_O05.name_tr,
    emoji: MARKETS.HT_O05.emoji,
    probability: potential,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `Strong HT O0.5 potential (${Math.round(potential * 100)}%)`
      : `Low confidence (${confidence}/100)`,
    data_source: {
      potential: matchData.o05HT_potential,
    },
  };
}

function scoreO35Market(matchData: any, dataQuality: any): MarketPreview {
  // Derived from O2.5 potential + xG
  const o25Potential = matchData.o25_potential / 100;
  const xgTotal = matchData.team_a_xg_prematch + matchData.team_b_xg_prematch;

  // If xG > 3.5 and O2.5 is high, boost O3.5
  let probability = o25Potential * 0.6; // Base from O2.5
  if (xgTotal >= 3.5) probability += 0.15;
  probability = Math.min(probability, 0.95);

  let confidence = 40; // Lower baseline for harder market
  if (dataQuality.has_xg) confidence += 15;
  if (dataQuality.has_odds) confidence += 10;

  const pick = probability >= 0.60 ? 'YES' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 55;

  return {
    market_id: 'O35',
    market_name: MARKETS.O35.name,
    market_name_tr: MARKETS.O35.name_tr,
    emoji: MARKETS.O35.emoji,
    probability,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `High xG total (${xgTotal.toFixed(2)}) + O2.5 potential`
      : `Low confidence (${confidence}/100)`,
    data_source: {
      xg: { home: matchData.team_a_xg_prematch, away: matchData.team_b_xg_prematch, total: xgTotal },
      potential: matchData.o25_potential,
    },
  };
}

function scoreHomeOver15Market(matchData: any, dataQuality: any): MarketPreview {
  const potential = matchData.o15_potential / 100;

  let confidence = 45;
  if (dataQuality.has_xg) confidence += 15;
  if (dataQuality.has_odds) confidence += 10;

  const pick = potential >= 0.65 ? 'YES' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 60;

  return {
    market_id: 'HOME_O15',
    market_name: MARKETS.HOME_O15.name,
    market_name_tr: MARKETS.HOME_O15.name_tr,
    emoji: MARKETS.HOME_O15.emoji,
    probability: potential,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `Strong home scoring potential (${Math.round(potential * 100)}%)`
      : `Low confidence (${confidence}/100)`,
    data_source: {
      xg: dataQuality.has_xg
        ? { home: matchData.team_a_xg_prematch, away: 0, total: 0 }
        : undefined,
      potential: matchData.o15_potential,
    },
  };
}

function scoreCornersMarket(matchData: any, dataQuality: any): MarketPreview {
  const potential = matchData.corners_potential / 100;

  let confidence = 35; // Lower baseline - corners data quality varies
  if (dataQuality.has_trends) confidence += 10;

  const pick = potential >= 0.60 ? 'YES' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 50;

  return {
    market_id: 'CORNERS_O85',
    market_name: MARKETS.CORNERS_O85.name,
    market_name_tr: MARKETS.CORNERS_O85.name_tr,
    emoji: MARKETS.CORNERS_O85.emoji,
    probability: potential,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `Corner potential (${Math.round(potential * 100)}%)`
      : `Low confidence (${confidence}/100)`,
    data_source: {
      potential: matchData.corners_potential,
    },
  };
}

function scoreCardsMarket(matchData: any, dataQuality: any): MarketPreview {
  const potential = matchData.cards_potential / 100;

  let confidence = 30; // Lowest baseline - missing referee data
  if (dataQuality.has_trends) confidence += 10;

  const pick = potential >= 0.55 ? 'YES' : 'SKIP';
  const canPublish = pick === 'YES' && confidence >= 45;

  return {
    market_id: 'CARDS_O25',
    market_name: MARKETS.CARDS_O25.name,
    market_name_tr: MARKETS.CARDS_O25.name_tr,
    emoji: MARKETS.CARDS_O25.emoji,
    probability: potential,
    confidence,
    pick,
    can_publish: canPublish,
    reason: canPublish
      ? `Card potential (${Math.round(potential * 100)}%)`
      : `Low confidence (${confidence}/100) - missing referee data`,
    data_source: {
      potential: matchData.cards_potential,
    },
  };
}
