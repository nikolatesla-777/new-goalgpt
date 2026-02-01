/**
 * Fix incorrect league mappings in registry
 */
import * as fs from 'fs';
import * as path from 'path';

const registryPath = path.join(__dirname, '../../src/config/leagues_registry.json');
const frontendPath = path.join(__dirname, '../../frontend/src/config/leagues_registry.json');

// Manual corrections based on known correct IDs
const MANUAL_FIXES: Record<string, { competition_id: string; season_id: string | null; db_name: string }> = {
  'premier-league': {
    competition_id: 'jednm9whz0ryox8',
    season_id: 'l965mkyhjpxr1ge',
    db_name: 'English Premier League'
  },
  'la-liga': {
    competition_id: 'vl7oqdehlyr510j',
    season_id: '56ypq3nhxw7md7o',
    db_name: 'Spanish La Liga'
  },
  'bundesliga': {
    competition_id: 'gy0or5jhg6qwzv3',
    season_id: null,
    db_name: 'Bundesliga'
  },
  'serie-a': {
    competition_id: '4zp5rzghp5q82w1',
    season_id: '4zp5rzghn83q82w',
    db_name: 'Italian Serie A'
  },
  'ligue-1': {
    competition_id: 'yl5ergphnzr8k0o',
    season_id: '9dn1m1gh645moep',
    db_name: 'French Ligue 1'
  },
  'sper-lig': {  // Note: ü removed by generateLeagueId
    competition_id: '8y39mp1h6jmojxg',
    season_id: '4zp5rzgh8xvq82w',
    db_name: 'Turkish Super League'
  },
  'eredivisie': {
    competition_id: 'vl7oqdeheyr510j',
    season_id: null,
    db_name: 'Netherlands Eredivisie'
  },
  'belgian-pro-league': {
    competition_id: '9vjxm8gh22r6odg',
    season_id: 'jednm9wh1klryox',
    db_name: 'Belgian Pro League'
  },
  'scottish-premiership': {
    competition_id: 'p4jwq2gh1gm0veo',
    season_id: 'p4jwq2ghlv3m0ve',
    db_name: 'Scottish Premiership'
  }
};

function main() {
  console.log('🔧 Fixing incorrect league mappings...\n');
  
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  
  let fixedCount = 0;
  
  for (const league of registry.leagues) {
    const fix = MANUAL_FIXES[league.id];
    if (fix) {
      league.thesports.competition_id = fix.competition_id;
      league.thesports.season_2025_2026_id = fix.season_id;
      league.thesports.db_name = fix.db_name;
      console.log(`✅ Fixed: ${league.name} → ${fix.db_name}`);
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} leagues\n`);
  
  // Write to both files
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  fs.writeFileSync(frontendPath, JSON.stringify(registry, null, 2), 'utf-8');
  
  console.log('✅ Registry updated!');
}

main();
