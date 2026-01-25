/**
 * Confidence Scorer Service
 *
 * Calculates confidence scores for match predictions (PHASE-2B)
 */

export interface ConfidenceScoreResult {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  emoji: string;
}

/**
 * Calculate confidence score based on match data
 */
export function calculateConfidenceScore(matchData: any): ConfidenceScoreResult {
  let score = 50; // Base score

  // Adjust based on potentials
  if (matchData.potentials?.btts && matchData.potentials.btts >= 70) {
    score += 10;
  }
  if (matchData.potentials?.over25 && matchData.potentials.over25 >= 65) {
    score += 10;
  }

  // Adjust based on xG
  if (matchData.xg?.home && matchData.xg?.away) {
    const totalXG = matchData.xg.home + matchData.xg.away;
    if (totalXG >= 2.5) {
      score += 10;
    }
  }

  // Adjust based on form
  if (matchData.form?.home?.ppg && matchData.form?.away?.ppg) {
    const avgPPG = (matchData.form.home.ppg + matchData.form.away.ppg) / 2;
    if (avgPPG >= 1.8) {
      score += 5;
    }
  }

  // Cap at 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: 'low' | 'medium' | 'high';
  let emoji: string;

  if (score >= 75) {
    level = 'high';
    emoji = '🔥';
  } else if (score >= 50) {
    level = 'medium';
    emoji = '⭐';
  } else {
    level = 'low';
    emoji = '⚠️';
  }

  return { score, level, emoji };
}

/**
 * Format confidence score for Telegram message
 */
export function formatConfidenceScoreForTelegram(confidence: ConfidenceScoreResult): string {
  const levelText = {
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
  }[confidence.level];

  return `${confidence.emoji} <b>Güven Skoru:</b> ${confidence.score}/100 (${levelText})`;
}
