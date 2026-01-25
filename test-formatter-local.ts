import { formatTelegramMessage } from './src/services/telegram/turkish.formatter';

// Test with Arsenal vs Manchester United data (from FootyStats)
const arsenalMatchData = {
  home_name: 'Arsenal',
  away_name: 'Manchester United',
  league_name: 'Premier League',
  date_unix: 1769358600,
  potentials: {
    btts: 68,
    over25: 69,
    over15: 91
  },
  xg: {
    home: 1.85,
    away: 1.69
  },
  form: {
    home: { ppg: null },  // FootyStats returns null when no data
    away: { ppg: null }
  },
  h2h: {
    total_matches: 43,
    home_wins: 15,
    draws: 11,
    away_wins: 17,
    avg_goals: 2.7,
    btts_pct: 60
  },
  trends: undefined,  // No FootyStats trends
  odds: {
    home: 1.57,
    draw: 4.20,
    away: 4.90
  }
};

const picks = [
  { market_type: 'BTTS_YES' as const, odds: 1.70 },
  { market_type: 'O25_OVER' as const, odds: 1.65 }
];

const confidenceScore = {
  score: 75,
  tier: 'high' as const,
  stars: 4,
  missing_fields: [],
  missingCount: 0
};

console.log('Testing formatTelegramMessage with Arsenal data:');
console.log('='.repeat(80));

const message = formatTelegramMessage(arsenalMatchData, picks, confidenceScore);

console.log(message);
console.log('='.repeat(80));

// Check if trends section exists
if (message.includes('🧠 <b>Trendler')) {
  console.log('\n✅ TRENDS SECTION PRESENT');
} else {
  console.log('\n❌ TRENDS SECTION MISSING');
}
