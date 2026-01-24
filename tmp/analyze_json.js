const fs = require('fs');

const files = [
  'tmp/footystats-samples/8419232.json',
  'tmp/footystats-samples/8280495.json',
  'tmp/footystats-samples/8200594.json'
];

console.log('═══════════════════════════════════════════════════════════');
console.log('    FOOTYSTATS JSON FIELD ANALYSIS');
console.log('═══════════════════════════════════════════════════════════\n');

files.forEach((file, idx) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const matchId = file.match(/(\d+)\.json/)[1];

  console.log(`\n${idx + 1}. MATCH ${matchId}: ${data.home_name} vs ${data.away_name}`);
  console.log('   ' + '─'.repeat(60));

  // Core fields
  console.log('   📊 CORE DATA:');
  console.log(`      status: ${data.status || 'N/A'}`);
  console.log(`      date_unix: ${data.date_unix || 'N/A'}`);
  console.log(`      score: ${data.score || 'N/A'}`);

  // Potentials
  console.log('\n   🎯 POTENTIALS:');
  Object.entries(data.potentials || {}).forEach(([key, val]) => {
    console.log(`      ${key}: ${val !== null ? val : 'NULL'}`);
  });

  // xG
  console.log('\n   ⚽ EXPECTED GOALS (xG):');
  Object.entries(data.xg || {}).forEach(([key, val]) => {
    console.log(`      ${key}: ${val !== null ? val : 'NULL'}`);
  });

  // Odds
  console.log('\n   💰 ODDS:');
  Object.entries(data.odds || {}).forEach(([key, val]) => {
    console.log(`      ${key}: ${val !== null ? val : 'NULL'}`);
  });

  // Form
  console.log('\n   📈 FORM:');
  if (data.form?.home) {
    console.log('      HOME:');
    Object.entries(data.form.home).forEach(([key, val]) => {
      console.log(`         ${key}: ${val !== null ? val : 'NULL'}`);
    });
  } else {
    console.log('      HOME: NULL');
  }
  if (data.form?.away) {
    console.log('      AWAY:');
    Object.entries(data.form.away).forEach(([key, val]) => {
      console.log(`         ${key}: ${val !== null ? val : 'NULL'}`);
    });
  } else {
    console.log('      AWAY: NULL');
  }

  // H2H
  console.log('\n   🤝 HEAD-TO-HEAD:');
  if (data.h2h) {
    Object.entries(data.h2h).forEach(([key, val]) => {
      console.log(`      ${key}: ${val !== null ? val : 'NULL'}`);
    });
  } else {
    console.log('      NULL');
  }

  // Trends
  console.log('\n   📊 TRENDS:');
  if (data.trends?.home?.length > 0) {
    console.log(`      HOME: ${data.trends.home.length} trends`);
    data.trends.home.slice(0, 2).forEach(t => {
      console.log(`         - [${t.sentiment}] ${t.text}`);
    });
  } else {
    console.log('      HOME: []');
  }
  if (data.trends?.away?.length > 0) {
    console.log(`      AWAY: ${data.trends.away.length} trends`);
    data.trends.away.slice(0, 2).forEach(t => {
      console.log(`         - [${t.sentiment}] ${t.text}`);
    });
  } else {
    console.log('      AWAY: []');
  }
});

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('    FIELD AVAILABILITY MATRIX');
console.log('═══════════════════════════════════════════════════════════\n');

const matrix = {};
files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const matchId = file.match(/(\d+)\.json/)[1];

  const fields = {
    'potentials.btts': data.potentials?.btts,
    'potentials.over25': data.potentials?.over25,
    'potentials.over15': data.potentials?.over15,
    'potentials.corners': data.potentials?.corners,
    'potentials.cards': data.potentials?.cards,
    'xg.home': data.xg?.home,
    'xg.away': data.xg?.away,
    'xg.total': data.xg?.total,
    'odds.home': data.odds?.home,
    'odds.draw': data.odds?.draw,
    'odds.away': data.odds?.away,
    'form.home.overall': data.form?.home?.overall,
    'form.home.ppg': data.form?.home?.ppg,
    'form.home.btts_pct': data.form?.home?.btts_pct,
    'form.home.over25_pct': data.form?.home?.over25_pct,
    'form.away.overall': data.form?.away?.overall,
    'form.away.ppg': data.form?.away?.ppg,
    'form.away.btts_pct': data.form?.away?.btts_pct,
    'form.away.over25_pct': data.form?.away?.over25_pct,
    'h2h.total_matches': data.h2h?.total_matches,
    'h2h.home_wins': data.h2h?.home_wins,
    'h2h.draws': data.h2h?.draws,
    'h2h.away_wins': data.h2h?.away_wins,
    'h2h.btts_pct': data.h2h?.btts_pct,
    'h2h.avg_goals': data.h2h?.avg_goals,
    'trends.home': data.trends?.home?.length > 0,
    'trends.away': data.trends?.away?.length > 0,
  };

  Object.entries(fields).forEach(([field, value]) => {
    if (!matrix[field]) matrix[field] = {};
    matrix[field][matchId] = value !== null && value !== undefined ? '✓' : '✗';
  });
});

console.log('Field'.padEnd(30) + ' | Match 1 | Match 2 | Match 3');
console.log('-'.repeat(60));
Object.entries(matrix).forEach(([field, matches]) => {
  const vals = [matches['8419232'], matches['8280495'], matches['8200594']];
  console.log(field.padEnd(30) + ' | ' + vals.join('       | '));
});
