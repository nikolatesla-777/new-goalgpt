// Debug Fenerbahçe message formatting
import { formatTelegramMessage } from './src/services/telegram/turkish.formatter';

const fenerbahceData = {
  home_name: 'Fenerbahçe',
  away_name: 'Göztepe',
  league_name: 'Unknown',
  date_unix: 1737824400, // 25/01 17:00
  potentials: {
    btts: 48,
    over25: 48,
    over15: 78,
  },
  xg: {
    home: 2.31,
    away: 1.53,
  },
  form: {
    home: { ppg: null },
    away: { ppg: null },
  },
  h2h: {
    total_matches: 13,
    home_wins: 6,
    draws: 5,
    away_wins: 2,
    avg_goals: 2.8,
    btts_pct: 62,
  },
  trends: undefined,
  odds: {
    home: 1.43,
    draw: 4.30,
    away: 6.60,
  },
};

const picks = [
  { market_type: 'BTTS_YES' as const },
  { market_type: 'O25_OVER' as const },
  { market_type: 'O15_OVER' as const },
  { market_type: 'HT_O05_OVER' as const },
];

const confidenceScore = {
  score: 50,
  tier: 'medium' as const,
  stars: 2.5,
  missing_fields: [],
  missingCount: 0,
};

console.log('='.repeat(80));
console.log('FENERBAHÇE MESSAGE DEBUG');
console.log('='.repeat(80));
console.log();

const message = formatTelegramMessage(fenerbahceData, picks, confidenceScore);

console.log(message);
console.log();
console.log('='.repeat(80));
console.log('Has Trends:', message.includes('Trendler') ? '✅ YES' : '❌ NO');
console.log('Message Length:', message.length, 'chars');
console.log('='.repeat(80));

// Extract trends if present
if (message.includes('Trendler')) {
  const evMatch = message.match(/🧠 <b>Trendler \(Ev\):<\/b>\n((?:• .*\n)+)/);
  const depMatch = message.match(/🧠 <b>Trendler \(Dep\):<\/b>\n((?:• .*\n)+)/);

  if (evMatch) {
    console.log('\nEv Trends:');
    console.log(evMatch[1]);
  }

  if (depMatch) {
    console.log('Dep Trends:');
    console.log(depMatch[1]);
  }
}

process.exit(message.includes('Trendler') ? 0 : 1);
