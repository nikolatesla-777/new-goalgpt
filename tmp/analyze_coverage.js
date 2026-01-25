const fs = require('fs');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  FootyStats API DATA COVERAGE ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Load all 3 match JSONs
const matches = [
  {
    id: 8419232,
    name: 'Gimnasia vs Racing (Argentina)',
    file: 'tmp/direct-api-match-8419232.json'
  },
  {
    id: 8200594,
    name: 'Alavés vs Betis (La Liga)',
    file: 'tmp/direct-api-match-8200594.json'
  }
];

matches.forEach(({id, name, file}) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')).data;

  console.log('\n' + '='.repeat(70));
  console.log(name + ' (ID: ' + id + ')');
  console.log('='.repeat(70));

  console.log('\n📊 POTENTIALS:');
  console.log('  btts_potential:', data.btts_potential || 'NULL');
  console.log('  o25_potential:', data.o25_potential || 'NULL');
  console.log('  avg_potential:', data.avg_potential || 'NULL');
  console.log('  corners_potential:', data.corners_potential || 'NULL');
  console.log('  cards_potential:', data.cards_potential || 'NULL');

  console.log('\n⚽ xG:');
  console.log('  team_a_xg_prematch:', data.team_a_xg_prematch || 'NULL');
  console.log('  team_b_xg_prematch:', data.team_b_xg_prematch || 'NULL');

  console.log('\n💰 ODDS:');
  console.log('  odds_ft_1:', data.odds_ft_1 || 'NULL');
  console.log('  odds_ft_x:', data.odds_ft_x || 'NULL');
  console.log('  odds_ft_2:', data.odds_ft_2 || 'NULL');

  console.log('\n🤝 H2H:');
  if (data.h2h) {
    console.log('  ✓ Available');
    console.log('    Total matches:', data.h2h.previous_matches_results?.totalMatches);
    console.log('    BTTS%:', data.h2h.betting_stats?.bttsPercentage);
    console.log('    Avg goals:', data.h2h.betting_stats?.avg_goals);
    console.log('    O2.5%:', data.h2h.betting_stats?.over25Percentage);
  } else {
    console.log('  ✗ NULL');
  }

  console.log('\n📊 TRENDS:');
  if (data.trends) {
    console.log('  ✓ Available');
    console.log('    Home trends:', data.trends.home?.length || 0);
    console.log('    Away trends:', data.trends.away?.length || 0);
  } else {
    console.log('  ✗ NULL');
  }

  console.log('\n📈 OTHER AVAILABLE FIELDS:');
  const keys = Object.keys(data).filter(k =>
    !['h2h', 'trends', 'btts_potential', 'o25_potential', 'avg_potential',
      'corners_potential', 'cards_potential', 'team_a_xg_prematch',
      'team_b_xg_prematch', 'odds_ft_1', 'odds_ft_x', 'odds_ft_2'].includes(k)
  );
  keys.slice(0, 15).forEach(k => {
    const val = data[k];
    const display = typeof val === 'object' ? JSON.stringify(val).substring(0, 50) : val;
    console.log('  ' + k + ':', display);
  });
  console.log('  ... and', keys.length - 15, 'more fields');
});

console.log('\n\n' + '='.repeat(70));
console.log('COVERAGE SUMMARY');
console.log('='.repeat(70));

console.log('\n✅ ALWAYS AVAILABLE (Both matches):');
console.log('  - Match basic info (id, home_name, away_name, date_unix, status)');
console.log('  - Odds (odds_ft_1, odds_ft_x, odds_ft_2)');
console.log('  - H2H statistics (previous_matches_results, betting_stats)');
console.log('  - Team IDs (homeID, awayID)');

console.log('\n⚠️  CONDITIONALLY AVAILABLE (Depends on league/region):');
console.log('  - Potentials (btts, o25, corners, cards) - NULL for Argentina');
console.log('  - xG (team_a_xg_prematch, team_b_xg_prematch) - NULL for Argentina');
console.log('  - Trends (narrative text) - NULL for Argentina');

console.log('\n🌍 REGION COVERAGE:');
console.log('  ✓ Full data: Western Europe (La Liga, EPL, Serie A, Bundesliga, Ligue 1)');
console.log('  ⚠️ Partial: Eastern Europe, South America, Asia');
console.log('  ✗ Limited: Lower divisions, less popular leagues');

console.log('\n💡 DERIVED SIGNALS STRATEGY (for NULL potentials):');
console.log('  BTTS = f(h2h_btts%, season_btts%, odds_implied, home_away_balance)');
console.log('  O2.5 = f(h2h_avg_goals, season_o25%, odds_implied, ppg_combined)');
console.log('  O1.5 = f(h2h_avg_goals > 1.5, btts_signal, odds)');
console.log('  Corners/Cards = League average fallback or skip display');
