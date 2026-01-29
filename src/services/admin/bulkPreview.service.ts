/**
 * Phase-3B.2: Bulk Preview Service
 *
 * Generates bulk daily list previews by:
 * 1. Fetching candidate matches from database
 * 2. Scoring each match via Week-2A endpoint
 * 3. Applying deterministic filters
 * 4. Ranking and grouping by market
 */

import { getDb } from '../../database/connection';
import {
  BulkPreviewRequest,
  BulkPreviewResponse,
  BulkMarketPreview,
  BulkPickPreview,
  MarketId,
  BulkPreviewFilters,
} from '../../types/bulkOperations.types';

// ============================================================================
// MARKET REGISTRY (Localized Names + Emojis)
// ============================================================================

const MARKET_REGISTRY: Record<
  MarketId,
  { name_tr: string; name_en: string; emoji: string }
> = {
  O25: {
    name_tr: '2.5 Üst Gol',
    name_en: 'Over 2.5 Goals',
    emoji: '📈',
  },
  BTTS: {
    name_tr: 'Karşılıklı Gol',
    name_en: 'Both Teams To Score',
    emoji: '⚽',
  },
  HT_O05: {
    name_tr: 'İlk Yarı 0.5 Üst',
    name_en: 'Half-Time Over 0.5',
    emoji: '⏱️',
  },
  O35: {
    name_tr: '3.5 Üst Gol',
    name_en: 'Over 3.5 Goals',
    emoji: '🎯',
  },
  HOME_O15: {
    name_tr: 'Ev Sahibi 1.5 Üst',
    name_en: 'Home Over 1.5',
    emoji: '🏠',
  },
  CORNERS_O85: {
    name_tr: 'Korner 8.5 Üst',
    name_en: 'Corners Over 8.5',
    emoji: '🚩',
  },
  CARDS_O25: {
    name_tr: 'Kart 2.5 Üst',
    name_en: 'Cards Over 2.5',
    emoji: '🟨',
  },
};

// ============================================================================
// INTERFACES (Scoring Endpoint Response)
// ============================================================================

interface ScoringEndpointResponse {
  success: boolean;
  data?: {
    match: {
      id: string;
      fs_match_id: number;
      home_team: string;
      away_team: string;
      league: string;
      kickoff_time: number;
    };
    markets: MarketScoring[];
  };
}

interface MarketScoring {
  market_id: MarketId;
  probability: number;
  confidence: number;
  pick: 'YES' | 'NO' | 'SKIP';
  can_publish: boolean;
  risk_flags: string[];
  reasons: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateBulkPreview(
  request: BulkPreviewRequest
): Promise<BulkPreviewResponse> {
  try {
    // Step 1: Fetch candidate matches
    const matches = await fetchCandidateMatches(
      request.date_from,
      request.date_to
    );

    if (matches.length === 0) {
      return {
        success: true,
        data: {
          generated_at: new Date().toISOString(),
          filters_applied: request.filters,
          markets: [],
        },
      };
    }

    // Step 2: Score all matches for requested markets
    const scoredMatches = await scoreAllMatches(matches, request.markets);

    // Step 3: Apply filters and rank per market
    const marketPreviews: BulkMarketPreview[] = [];

    for (const marketId of request.markets) {
      const marketData = MARKET_REGISTRY[marketId];
      const marketName =
        request.locale === 'tr' ? marketData.name_tr : marketData.name_en;

      // Filter picks for this market
      const candidates = scoredMatches
        .map((m) => ({
          match: m.match,
          market: m.markets.find((mk) => mk.market_id === marketId),
        }))
        .filter((item) => item.market !== undefined) as Array<{
        match: any;
        market: MarketScoring;
      }>;

      // Apply filters
      const filtered = applyFilters(candidates, request.filters);

      // Apply diversity constraints
      const diverse = applyDiversityConstraints(
        filtered,
        request.filters.max_per_league,
        request.filters.time_spread_minutes
      );

      // Rank and limit
      const ranked = diverse
        .sort(
          (a, b) =>
            b.market.confidence - a.market.confidence ||
            b.market.probability - a.market.probability
        )
        .slice(0, request.limit_per_market);

      // Convert to BulkPickPreview
      const picks: BulkPickPreview[] = ranked.map((item) => ({
        match_id: item.match.id,
        fs_match_id: item.match.fs_match_id,
        kickoff_time: item.match.kickoff_time,
        league: item.match.league,
        home_team: item.match.home_team,
        away_team: item.match.away_team,
        probability: item.market.probability,
        confidence: item.market.confidence,
        pick: item.market.pick,
        can_publish: item.market.can_publish,
        risk_flags: item.market.risk_flags,
        reasons: generateReasons(item.market, request.filters),
      }));

      marketPreviews.push({
        market_id: marketId,
        market_name: marketName,
        market_name_tr: marketData.name_tr,
        market_name_en: marketData.name_en,
        emoji: marketData.emoji,
        picks,
        total_candidates: candidates.length,
        total_selected: picks.length,
      });
    }

    return {
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        filters_applied: request.filters,
        markets: marketPreviews,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to generate bulk preview',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchCandidateMatches(
  dateFrom: string,
  dateTo: string
): Promise<any[]> {
  const db = getDb();

  const fromTimestamp = Math.floor(new Date(dateFrom).getTime() / 1000);
  const toTimestamp = Math.floor(new Date(dateTo).getTime() / 1000);

  const result = await db
    .selectFrom('ts_matches')
    .select([
      'id',
      'external_id as fs_match_id',
      'home_team_name as home_team',
      'away_team_name as away_team',
      'competition_name as league',
      'start_timestamp as kickoff_time',
    ])
    .where('start_timestamp', '>=', fromTimestamp)
    .where('start_timestamp', '<=', toTimestamp)
    .where('status_id', '=', 1) // NOT_STARTED only
    .orderBy('start_timestamp', 'asc')
    .execute();

  return result;
}

async function scoreAllMatches(
  matches: any[],
  markets: MarketId[]
): Promise<
  Array<{
    match: any;
    markets: MarketScoring[];
  }>
> {
  const scoredMatches = [];

  for (const match of matches) {
    try {
      // Call Week-2A scoring endpoint
      const scoringResult = await fetchScoringForMatch(match.id);

      if (scoringResult.success && scoringResult.data) {
        scoredMatches.push({
          match,
          markets: scoringResult.data.markets.filter((m) =>
            markets.includes(m.market_id)
          ),
        });
      }
    } catch (error) {
      // Skip matches that fail to score
      console.error(`Failed to score match ${match.id}:`, error);
    }
  }

  return scoredMatches;
}

async function fetchScoringForMatch(
  matchId: string
): Promise<ScoringEndpointResponse> {
  // TODO: Replace with actual Week-2A endpoint call
  // For now, this is a stub that will be implemented when Week-2A is merged

  // Stub implementation:
  // In production, this would be:
  // const response = await fetch(`http://localhost:3000/api/matches/${matchId}/scoring`);
  // return response.json();

  throw new Error(
    'Week-2A scoring endpoint not available yet. This service requires PR#5 (Week-2A) to be merged.'
  );
}

function applyFilters(
  candidates: Array<{ match: any; market: MarketScoring }>,
  filters: BulkPreviewFilters
): Array<{ match: any; market: MarketScoring }> {
  return candidates.filter((item) => {
    // Must have YES pick
    if (item.market.pick !== 'YES') return false;

    // Confidence threshold
    if (item.market.confidence < filters.min_confidence) return false;

    // Probability threshold
    if (item.market.probability < filters.min_probability) return false;

    // Risk flags threshold
    if (item.market.risk_flags.length > filters.max_risk_flags) return false;

    // Must be publishable
    if (!item.market.can_publish) return false;

    return true;
  });
}

function applyDiversityConstraints(
  candidates: Array<{ match: any; market: MarketScoring }>,
  maxPerLeague: number,
  timeSpreadMinutes: number
): Array<{ match: any; market: MarketScoring }> {
  const leagueCounts: Record<string, number> = {};
  const selected: Array<{ match: any; market: MarketScoring }> = [];
  let lastKickoffTime = 0;

  for (const candidate of candidates) {
    const league = candidate.match.league;
    const kickoffTime = candidate.match.kickoff_time;

    // Check league limit
    const leagueCount = leagueCounts[league] || 0;
    if (leagueCount >= maxPerLeague) continue;

    // Check time spread
    if (lastKickoffTime > 0) {
      const minutesDiff = (kickoffTime - lastKickoffTime) / 60;
      if (minutesDiff < timeSpreadMinutes) continue;
    }

    // Add to selected
    selected.push(candidate);
    leagueCounts[league] = leagueCount + 1;
    lastKickoffTime = kickoffTime;
  }

  return selected;
}

function generateReasons(
  market: MarketScoring,
  filters: BulkPreviewFilters
): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];

  // Passed reasons
  passed.push(
    `Confidence ${market.confidence}/100 (threshold: ${filters.min_confidence})`
  );
  passed.push(
    `Probability ${(market.probability * 100).toFixed(1)}% (threshold: ${(filters.min_probability * 100).toFixed(1)}%)`
  );
  passed.push(
    `Risk flags: ${market.risk_flags.length} (max: ${filters.max_risk_flags})`
  );
  passed.push(`Pick: ${market.pick}`);
  passed.push(`Publishable: ${market.can_publish ? 'Yes' : 'No'}`);

  // Failed reasons (close calls)
  if (market.confidence < filters.min_confidence + 5) {
    failed.push(
      `Confidence barely met threshold (${market.confidence} vs ${filters.min_confidence})`
    );
  }

  if (market.probability < filters.min_probability + 0.05) {
    failed.push(
      `Probability barely met threshold (${(market.probability * 100).toFixed(1)}% vs ${(filters.min_probability * 100).toFixed(1)}%)`
    );
  }

  if (market.risk_flags.length >= filters.max_risk_flags - 1) {
    failed.push(
      `Close to risk flag limit (${market.risk_flags.length}/${filters.max_risk_flags})`
    );
  }

  return { passed, failed };
}
