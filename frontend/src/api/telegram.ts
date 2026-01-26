/**
 * Telegram API Client
 *
 * API functions for Telegram publishing system
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Get today's matches from FootyStats
 */
export async function getTodaysMatches() {
  const response = await fetch(`${API_BASE}/footystats/today`);
  if (!response.ok) throw new Error('Failed to fetch matches');
  const json = await response.json();

  // Backend returns { count, matches }, but component expects { data }
  // Map fs_id to id and add external_id
  const matches = (json.matches || []).map((m: any) => ({
    ...m,
    id: m.fs_id,
    external_id: `fs_${m.fs_id}`,
    competition_name: m.league_name || 'Unknown League',
    btts_potential: m.potentials?.btts,
    o25_potential: m.potentials?.over25,
    o15_potential: m.potentials?.over15 || m.potentials?.avg,
    team_a_xg_prematch: m.xg?.home,
    team_b_xg_prematch: m.xg?.away,
    odds_ft_1: m.odds?.home,
    odds_ft_x: m.odds?.draw,
    odds_ft_2: m.odds?.away,
    home_logo: m.home_logo,
    away_logo: m.away_logo,
    // Analytics for detailed view
    corners_potential: m.potentials?.corners,
    cards_potential: m.potentials?.cards,
    shots_potential: m.potentials?.shots,
    fouls_potential: m.potentials?.fouls,
    trends: m.trends,
    h2h: m.h2h,
  }));

  return { data: matches };
}

/**
 * Publish a match to Telegram channel
 */
export async function publishToTelegram(
  fsMatchId: number,
  matchId: string,
  picks: Array<{ market_type: string; odds?: number }>
) {
  const response = await fetch(`${API_BASE}/telegram/publish/match/${fsMatchId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ match_id: matchId, picks }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to publish');
  }

  return response.json();
}

/**
 * Get published Telegram posts
 */
export async function getTelegramPosts() {
  const response = await fetch(`${API_BASE}/telegram/posts`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch posts');
  return response.json();
}

/**
 * Get Telegram bot health status
 */
export async function getTelegramHealth() {
  const response = await fetch(`${API_BASE}/telegram/health`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch health');
  return response.json();
}
