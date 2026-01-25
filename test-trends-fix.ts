// Test the fixed trends converter
import { generateTurkishTrends } from './src/services/telegram/trends.generator';

// Simulate FootyStats trends as tuples (actual API format)
const testData = {
  home_name: 'Fenerbahçe',
  away_name: 'Göztepe',
  potentials: { btts: 48, over25: 48, over15: 78 },
  xg: { home: 2.31, away: 1.53 },
  form: { home: { ppg: 2.1 }, away: { ppg: 1.4 } },
  h2h: { total_matches: 13, btts_pct: 62, avg_goals: 2.8 },
  trends: {
    home: [
      ['great', 'Fenerbahçe won 4 of their last 5 matches'],
      ['good', 'Both teams scoring in 3 of last 5 games'],
      ['neutral', 'Scored 12 goals in last 5 matches'],
    ] as [string, string][],
    away: [
      ['bad', 'Göztepe not won in last 3 games'],
      ['chart', 'Conceded 8 goals in last 5 matches'],
    ] as [string, string][],
  },
};

console.log('='.repeat(80));
console.log('TESTING FIXED TRENDS CONVERTER');
console.log('='.repeat(80));

const result = generateTurkishTrends(testData.home_name, testData.away_name, testData as any);

console.log('\n🧠 Trendler (Ev):', result.home.length);
result.home.forEach((t, idx) => console.log(`  ${idx + 1}. ${t}`));

console.log('\n🧠 Trendler (Dep):', result.away.length);
result.away.forEach((t, idx) => console.log(`  ${idx + 1}. ${t}`));

console.log('\n' + '='.repeat(80));
console.log(result.home.length > 0 ? '✅ SUCCESS - Trends generated!' : '❌ FAILED - No trends');
console.log('='.repeat(80));
