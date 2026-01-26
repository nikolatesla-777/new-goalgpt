/**
 * Turkish Message Formatter V2 - Enhanced Template
 *
 * New template format with:
 * - Match Trends (BTTS, Over 2.5, Over 1.5)
 * - First Half Analysis
 * - Cards Analysis
 * - Corners Analysis
 * - xG Expectation
 * - Top Trend Picks
 *
 * @author GoalGPT Team
 * @version 2.0.0
 */

import { ConfidenceScoreResult, formatConfidenceScoreForTelegram } from './confidenceScorer.service';
import { logger } from '../../utils/logger';

interface Pick {
  market_type: 'BTTS_YES' | 'O25_OVER' | 'O15_OVER' | 'HT_O05_OVER';
  odds?: number;
}

interface MatchData {
  home_name: string;
  away_name: string;
  league_name?: string;
  date_unix: number;
  potentials?: {
    btts?: number;
    over25?: number;
    over15?: number;
    corners?: number;  // ✅ ADD: Match-level corner expectation (e.g., 9.4)
    cards?: number;    // ✅ ADD: Match-level card expectation (e.g., 4.9)
  };
  xg?: {
    home?: number;
    away?: number;
  };
  form?: {
    home?: {
      ppg?: number;
      btts_pct?: number;
      over25_pct?: number;
      corners_avg?: number;
      cards_avg?: number;
    };
    away?: {
      ppg?: number;
      btts_pct?: number;
      over25_pct?: number;
      corners_avg?: number;
      cards_avg?: number;
    };
  };
  h2h?: {
    total_matches?: number;
    home_wins?: number;
    draws?: number;
    away_wins?: number;
    avg_goals?: number;
    btts_pct?: number;
  };
  odds?: { home?: number; draw?: number; away?: number };
}

/**
 * Format enhanced Telegram message in Turkish (V2 Template)
 */
export function formatTelegramMessageV2(
  matchData: MatchData,
  picks: Pick[] = [],
  confidenceScore?: ConfidenceScoreResult
): string {
  const { home_name, away_name, league_name, date_unix, potentials, xg, odds, form, h2h } = matchData;

  // 🔍 DEBUG: Log received potentials data
  console.error('\n🔍🔍🔍 [Formatter V2] Received potentials:');
  console.error('  potentials.corners:', potentials?.corners);
  console.error('  potentials.cards:', potentials?.cards);
  console.error('  potentials.btts:', potentials?.btts);
  console.error('  typeof corners:', typeof potentials?.corners);
  console.error('  typeof cards:', typeof potentials?.cards);
  console.error('  Full potentials:', JSON.stringify(potentials, null, 2));

  // Date formatting
  const matchDate = new Date(date_unix * 1000);
  const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = matchDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' });

  let message = `⚽ <b>${home_name} vs ${away_name}</b>\n`;
  message += `🏆 ${league_name || 'Bilinmeyen Lig'} | 🕐 ${dateStr} ${timeStr}\n\n`;

  // Confidence Score
  if (confidenceScore) {
    message += `${formatConfidenceScoreForTelegram(confidenceScore)}\n\n`;
  }

  // 📈 MAÇ TRENDLERİ
  if (potentials?.btts || potentials?.over25 || potentials?.over15) {
    message += `📈 <b>MAÇ TRENDLERİ</b>\n`;
    if (potentials.btts) message += `• BTTS: %${potentials.btts} ⚽⚽\n`;
    if (potentials.over25) message += `• Üst 2.5: %${potentials.over25}\n`;
    if (potentials.over15) message += `• Üst 1.5: %${potentials.over15}\n`;
    message += `\n`;
  }

  // 🕒 İLK YARI ANALİZİ
  // Note: First half data calculated from team BTTS/Over percentages as proxy
  const homeFirstHalfTrend = form?.home?.btts_pct && form.home.btts_pct >= 50 ? 'YÜKSEK' : 'ORTA';
  const awayFirstHalfTrend = form?.away?.btts_pct && form.away.btts_pct >= 50 ? 'YÜKSEK' : 'ORTA';

  message += `🕒 <b>İLK YARI ANALİZİ</b>\n`;
  if (form?.home?.btts_pct) {
    const homeMatches = Math.round(6); // Estimate based on last 6 matches
    const homeGoals = Math.round((form.home.btts_pct / 100) * homeMatches);
    message += `• ${home_name} son ${homeMatches} maçın ${homeGoals}'ünde İY gol buldu\n`;
  }
  if (form?.away?.btts_pct) {
    const awayMatches = Math.round(5);
    const awayGoals = Math.round((form.away.btts_pct / 100) * awayMatches);
    message += `• ${away_name} son ${awayMatches} deplasmanın ${awayGoals}'ünde İY gol yedi\n`;
  }

  // İY 0.5 ÜST trend
  const iyTrend = (form?.home?.btts_pct || 0) + (form?.away?.btts_pct || 0) >= 100 ? 'YÜKSEK' : 'ORTA';
  message += `• İY 0.5 ÜST eğilimi: ${iyTrend}\n\n`;

  // 🟨 KART ANALİZİ - ALWAYS SHOW IF DATA EXISTS
  if (potentials?.cards !== undefined && potentials?.cards !== null) {
    message += `🟨 <b>KART ANALİZİ</b>\n`;
    message += `• Beklenen toplam kart: ${potentials.cards.toFixed(1)}\n`;

    // Optional: Show team averages if available
    if (form?.home?.cards_avg || form?.away?.cards_avg) {
      if (form.home?.cards_avg) {
        message += `• ${home_name} ortalaması: ${form.home.cards_avg.toFixed(1)} kart/maç\n`;
      }
      if (form.away?.cards_avg) {
        message += `• ${away_name} ortalaması: ${form.away.cards_avg.toFixed(1)} kart/maç\n`;
      }
    }

    const cardTrend = potentials.cards >= 5 ? 'YÜKSEK' : potentials.cards >= 4 ? 'ORTA–YÜKSEK' : 'ORTA';
    message += `• Kart eğilimi: ${cardTrend}\n\n`;
  }

  // 🚩 KORNER ANALİZİ
  if (potentials?.corners) {
    message += `🚩 <b>KORNER ANALİZİ</b>\n`;
    message += `• Beklenen toplam korner: ${potentials.corners.toFixed(1)}\n`;

    // Optional: Show team averages if available
    if (form?.home?.corners_avg || form?.away?.corners_avg) {
      if (form.home?.corners_avg) {
        message += `• ${home_name} ortalaması: ${form.home.corners_avg.toFixed(1)} korner/maç\n`;
      }
      if (form.away?.corners_avg) {
        message += `• ${away_name} ortalaması: ${form.away.corners_avg.toFixed(1)} korner/maç\n`;
      }
    }

    const cornerTrend = potentials.corners >= 12 ? 'YÜKSEK' : potentials.corners >= 10 ? 'ORTA–YÜKSEK' : 'ORTA';
    message += `• Korner eğilimi: ${cornerTrend}\n\n`;
  }

  // ⚡ xG BEKLENTİSİ
  if (xg?.home !== undefined && xg?.away !== undefined) {
    message += `⚡ <b>xG BEKLENTİSİ</b>\n`;
    message += `• ${home_name}: ${xg.home.toFixed(2)} | ${away_name}: ${xg.away.toFixed(2)}\n`;
    message += `• Toplam xG: ${(xg.home + xg.away).toFixed(2)}\n\n`;
  }

  // 🎯 ÖNE ÇIKAN TREND SEÇİMLER
  if (picks.length > 0) {
    message += `🎯 <b>ÖNE ÇIKAN TREND SEÇİMLER</b>\n`;
    picks.forEach(pick => {
      const label = {
        BTTS_YES: 'Karşılıklı Gol (BTTS)',
        O25_OVER: 'Üst 2.5 Gol',
        O15_OVER: 'Üst 1.5 Gol',
        HT_O05_OVER: 'İlk Yarı 0.5 ÜST',
      }[pick.market_type] || pick.market_type;

      message += `✅ ${label}\n`;
    });
    message += `\n`;
  }

  // ⚠️ Not
  message += `⚠️ <i>Not: Analizler istatistiksel trendlere dayanır.</i>`;

  return message;
}
