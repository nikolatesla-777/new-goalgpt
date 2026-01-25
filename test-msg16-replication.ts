import { formatTelegramMessage } from './src/services/telegram/turkish.formatter';
import { ConfidenceScoreResult } from './src/services/telegram/confidenceScorer.service';

// Replicate the data from message 16 (Lille vs Strasbourg)
const matchData = {
  home_name: 'Lille',
  away_name: 'Strasbourg',
  league_name: 'Unknown',
  date_unix: 1769356800, // Approx 25/01 19:45
  potentials: {
    btts: 56,
    over25: 45,
    over15: 62,
  },
  xg: {
    home: 1.65,
    away: 1.14,
  },
  form: {
    home: { ppg: null },
    away: { ppg: null },
  },
  h2h: {
    total_matches: 18,
    home_wins: 9,
    draws: 4,
    away_wins: 5,
    avg_goals: 2.5,
    btts_pct: 50,
  },
  trends: undefined,
  odds: {
    home: 2.25,
    draw: 3.55,
    away: 2.97,
  },
};

const picks = [
  { market_type: 'O25_OVER' as const },
  { market_type: 'O15_OVER' as const },
  { market_type: 'HT_O05_OVER' as const },
  { market_type: 'BTTS_YES' as const },
];

const confidenceScore: ConfidenceScoreResult = {
  score: 50,
  tier: 'medium' as const,
  stars: 2.5,
  missing_fields: [],
  missingCount: 0,
};

console.log('Testing with Lille vs Strasbourg (Message 16) data...\n');
console.log('='.repeat(80));

const message = formatTelegramMessage(matchData, picks, confidenceScore);

console.log(message);
console.log('='.repeat(80));

// Check for trends
console.log('\n');
if (message.includes('Trendler (Ev)')) {
  console.log('✅ TRENDS (EV) SECTION PRESENT');
} else {
  console.log('❌ TRENDS (EV) SECTION MISSING');
}

if (message.includes('Trendler (Dep)')) {
  console.log('✅ TRENDS (DEP) SECTION PRESENT');
} else {
  console.log('❌ TRENDS (DEP) SECTION MISSING');
}
