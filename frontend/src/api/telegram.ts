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
  return response.json();
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
