// Quick test script to run on VPS to verify trends generator
import { generateTurkishTrends } from './src/services/telegram/trends.generator';

const testData = {
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
};

console.log('Testing trends generator on VPS...\n');

const result = generateTurkishTrends('Lille', 'Strasbourg', testData);

console.log('Result:');
console.log(JSON.stringify(result, null, 2));

if (result.home.length === 3 && result.away.length === 3) {
  console.log('\n✅ SUCCESS - Trends generator returns 3 bullets per team');
  process.exit(0);
} else {
  console.log(`\n❌ FAIL - Got ${result.home.length} home and ${result.away.length} away trends`);
  process.exit(1);
}
