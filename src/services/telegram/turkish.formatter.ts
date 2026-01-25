/**
 * Turkish Message Formatter
 *
 * Formats match data into Turkish Telegram messages with:
 * - Match header (teams, league, time)
 * - Statistics (BTTS, Over/Under potentials)
 * - Expected Goals (xG)
 * - Form analysis
 * - Head-to-head stats
 * - Turkish trends (Ev/Dep sections)
 * - Prediction markets
 * - Betting odds
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { generateTurkishTrends } from './trends.generator';

interface Pick {
  market_type: 'BTTS_YES' | 'O25_OVER' | 'O15_OVER' | 'HT_O05_OVER';
  odds?: number;
}

interface MatchData {
  home_name: string;
  away_name: string;
  league_name?: string;
  date_unix: number;
  potentials?: any;
  xg?: any;
  form?: any;
  h2h?: any;
  trends?: any;
  odds?: { home?: number; draw?: number; away?: number };
}

/**
 * Format complete Telegram message in Turkish
 */
export function formatTelegramMessage(
  matchData: MatchData,
  picks: Pick[] = []
): string {
  const { home_name, away_name, league_name, date_unix, potentials, xg, odds, form, h2h, trends } = matchData;

  // Date formatting
  const matchDate = new Date(date_unix * 1000);
  const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = matchDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

  let message = `⚽ <b>${home_name} vs ${away_name}</b>\n`;
  message += `🏆 ${league_name || 'Bilinmeyen Lig'} | 🕐 ${dateStr} ${timeStr}\n\n`;

  // Potentials section
  if (potentials?.btts || potentials?.over25 || potentials?.over15) {
    message += `📊 <b>İstatistikler:</b>\n`;
    if (potentials.btts) message += `• BTTS: %${potentials.btts} ⚽⚽\n`;
    if (potentials.over25) message += `• Alt/Üst 2.5: %${potentials.over25}\n`;
    if (potentials.over15) message += `• Alt/Üst 1.5: %${potentials.over15}\n`;
    message += `\n`;
  }

  // xG section
  if (xg?.home !== undefined && xg?.away !== undefined) {
    message += `⚡ <b>Beklenen Gol (xG):</b>\n`;
    message += `${home_name}: ${xg.home.toFixed(2)} | ${away_name}: ${xg.away.toFixed(2)}\n`;
    message += `Toplam: ${(xg.home + xg.away).toFixed(2)}\n\n`;
  }

  // Form section
  if (form?.home?.ppg || form?.away?.ppg) {
    message += `📈 <b>Form (Puan/Maç):</b>\n`;
    if (form.home?.ppg) message += `${home_name}: ${form.home.ppg.toFixed(1)} PPG\n`;
    if (form.away?.ppg) message += `${away_name}: ${form.away.ppg.toFixed(1)} PPG\n`;
    message += `\n`;
  }

  // H2H section
  if (h2h?.total_matches) {
    message += `🤝 <b>Kafa Kafaya (${h2h.total_matches} maç):</b>\n`;
    message += `${h2h.home_wins || 0}G-${h2h.draws || 0}B-${h2h.away_wins || 0}M\n`;
    if (h2h.avg_goals) message += `Ort. ${h2h.avg_goals.toFixed(1)} gol\n`;
    if (h2h.btts_pct) message += `BTTS: %${h2h.btts_pct}\n`;
    message += `\n`;
  }

  // Turkish trends with 2-section structure
  const trendData = generateTurkishTrends(home_name, away_name, {
    potentials,
    xg,
    form,
    h2h,
    trends,
  });

  if (trendData.home.length > 0) {
    message += `🧠 <b>Trendler (Ev):</b>\n`;
    trendData.home.forEach(trend => {
      message += `• ${trend}\n`;
    });
    message += `\n`;
  }

  if (trendData.away.length > 0) {
    message += `🧠 <b>Trendler (Dep):</b>\n`;
    trendData.away.forEach(trend => {
      message += `• ${trend}\n`;
    });
    message += `\n`;
  }

  // Picks section
  if (picks.length > 0) {
    message += `🎯 <b>Tahmini Piyasalar:</b>\n`;
    picks.forEach(pick => {
      const label = {
        BTTS_YES: 'Karşılıklı Gol (BTTS)',
        O25_OVER: 'Alt/Üst 2.5 Gol',
        O15_OVER: 'Alt/Üst 1.5 Gol',
        HT_O05_OVER: 'İlk Yarı 0.5 Üst',
      }[pick.market_type] || pick.market_type;

      const oddsStr = pick.odds ? ` @${pick.odds.toFixed(2)}` : '';
      message += `• ${label}${oddsStr}\n`;
    });
    message += `\n`;
  }

  // Odds section
  if (odds?.home && odds?.draw && odds?.away) {
    message += `💰 <b>Oranlar:</b> ${odds.home.toFixed(2)} | ${odds.draw.toFixed(2)} | ${odds.away.toFixed(2)}`;
  }

  return message;
}
