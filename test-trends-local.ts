import { generateTurkishTrends } from './src/services/telegram/trends.generator';

// Test with Arsenal match data (from message 14)
const arsenalData = {
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
    home: { ppg: null },
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
  trends: undefined
};

console.log('Testing generateTurkishTrends with Arsenal data:');
console.log('='.repeat(80));

const result = generateTurkishTrends('Arsenal', 'Manchester United', arsenalData);

console.log('\nRESULT:');
console.log('Home trends count:', result.home.length);
console.log('Away trends count:', result.away.length);
console.log('\nHome trends:');
result.home.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
console.log('\nAway trends:');
result.away.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
