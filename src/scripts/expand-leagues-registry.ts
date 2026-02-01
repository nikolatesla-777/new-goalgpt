/**
 * Expand leagues_registry.json from 10 to 50 leagues
 *
 * Fetches leagues from fs_competitions_allowlist and matches with TheSports data
 */
import dotenv from 'dotenv';
import { pool } from '../database/connection';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface LeagueRegistry {
  version: string;
  last_updated: string;
  description: string;
  leagues: LeagueEntry[];
  notes: any;
}

interface LeagueEntry {
  id: string;
  name: string;
  display_name: string;
  country: string;
  country_code: string;
  priority: number;
  thesports: {
    competition_id: string | null;
    season_2025_2026_id: string | null;
    db_name: string | null;
  };
  footystats: {
    league_name: string;
    country: string;
  };
}

// Country code mapping
const COUNTRY_CODES: Record<string, string> = {
  'England': 'ENG',
  'Spain': 'ESP',
  'Germany': 'GER',
  'Italy': 'ITA',
  'France': 'FRA',
  'Turkey': 'TUR',
  'Netherlands': 'NED',
  'Belgium': 'BEL',
  'Scotland': 'SCO',
  'Portugal': 'POR',
  'Russia': 'RUS',
  'Ukraine': 'UKR',
  'Greece': 'GRE',
  'Austria': 'AUT',
  'Switzerland': 'SUI',
  'Denmark': 'DEN',
  'Norway': 'NOR',
  'Sweden': 'SWE',
  'Poland': 'POL',
  'Czech Republic': 'CZE',
  'Romania': 'ROU',
  'Croatia': 'CRO',
  'Serbia': 'SRB',
  'Bulgaria': 'BUL',
  'Hungary': 'HUN',
  'Finland': 'FIN',
  'Slovakia': 'SVK',
  'Slovenia': 'SVN',
  'Israel': 'ISR',
  'Cyprus': 'CYP',
  'Mexico': 'MEX',
  'USA': 'USA',
  'Brazil': 'BRA',
  'Argentina': 'ARG',
  'Chile': 'CHI',
  'Colombia': 'COL',
  'Paraguay': 'PAR',
  'Uruguay': 'URU',
  'Peru': 'PER',
  'Ecuador': 'ECU',
  'Japan': 'JPN',
  'South Korea': 'KOR',
  'China': 'CHN',
  'Australia': 'AUS',
  'Saudi Arabia': 'KSA',
  'UAE': 'UAE',
  'Qatar': 'QAT',
  'Egypt': 'EGY',
  'South Africa': 'RSA'
};

function generateLeagueId(name: string, country: string): string {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  return cleanName;
}

function matchTheSportsCompetition(fsName: string, fsCountry: string, tsCompetitions: any[]): any | null {
  const fsNameLower = fsName.toLowerCase().trim();
  const fsCountryLower = fsCountry.toLowerCase().trim();

  // Build expected keywords from country
  const countryKeywords: Record<string, string[]> = {
    'england': ['english', 'england', 'efl'],
    'spain': ['spanish', 'spain', 'españa'],
    'germany': ['german', 'germany', 'deutschland'],
    'italy': ['italian', 'italy', 'italia'],
    'france': ['french', 'france'],
    'turkey': ['turkish', 'turkey', 'türkiye'],
    'netherlands': ['dutch', 'netherlands', 'holland'],
    'belgium': ['belgian', 'belgium'],
    'scotland': ['scottish', 'scotland'],
    'portugal': ['portuguese', 'portugal'],
    'greece': ['greek', 'greece'],
    'austria': ['austrian', 'austria'],
    'switzerland': ['swiss', 'switzerland'],
    'denmark': ['danish', 'denmark'],
    'norway': ['norwegian', 'norway'],
    'sweden': ['swedish', 'sweden'],
    'poland': ['polish', 'poland'],
    'czech republic': ['czech'],
    'romania': ['romanian', 'romania'],
    'croatia': ['croatian', 'croatia'],
    'serbia': ['serbian', 'serbia'],
    'bulgaria': ['bulgarian', 'bulgaria'],
    'hungary': ['hungarian', 'hungary'],
    'finland': ['finnish', 'finland'],
    'japan': ['japanese', 'japan'],
    'south korea': ['korean', 'korea'],
    'mexico': ['mexican', 'mexico'],
    'usa': ['american', 'usa', 'united states', 'mls'],
    'brazil': ['brazilian', 'brazil', 'brasil'],
    'argentina': ['argentinian', 'argentina'],
    'russia': ['russian', 'russia'],
    'ukraine': ['ukrainian', 'ukraine'],
    'israel': ['israeli', 'israel'],
    'cyprus': ['cypriot', 'cyprus']
  };

  const expectedKeywords = countryKeywords[fsCountryLower] || [fsCountryLower];

  for (const ts of tsCompetitions) {
    if (!ts.name) continue;
    const tsNameLower = ts.name.toLowerCase().trim();

    // Check if TheSports name contains any country keyword
    const hasCountryMatch = expectedKeywords.some(kw => tsNameLower.includes(kw));
    if (!hasCountryMatch) continue; // Skip if country doesn't match

    // Exact match
    if (tsNameLower === fsNameLower) return ts;

    // Special league name mappings
    const leagueNameMapping: Record<string, string[]> = {
      'premier league': ['premier league'],
      'championship': ['championship'],
      'league one': ['league one'],
      'league two': ['league two'],
      'la liga': ['la liga', 'primera división'],
      'segunda división': ['segunda división', 'laliga2'],
      'bundesliga': ['bundesliga', '1. bundesliga'],
      '2. bundesliga': ['2. bundesliga'],
      'serie a': ['serie a'],
      'serie b': ['serie b'],
      'ligue 1': ['ligue 1'],
      'ligue 2': ['ligue 2'],
      'eredivisie': ['eredivisie'],
      'eerste divisie': ['eerste divisie'],
      'süper lig': ['super league', 'süper lig', 'super lig'],
      'scottish premiership': ['premiership'],
      'belgian pro league': ['pro league', 'jupiler'],
      'primeira liga': ['primeira liga', 'liga portugal'],
      'super league': ['super league'],
      'superliga': ['superliga'],
      'eliteserien': ['eliteserien'],
      'allsvenskan': ['allsvenskan'],
      'ekstraklasa': ['ekstraklasa'],
      'j1 league': ['j1 league', 'j.league'],
      'k league 1': ['k league'],
      'liga mx': ['liga mx'],
      'mls': ['mls', 'major league soccer']
    };

    // Check mapped names
    const mappedNames = leagueNameMapping[fsNameLower] || [fsNameLower];
    for (const mapped of mappedNames) {
      if (tsNameLower.includes(mapped)) {
        return ts;
      }
    }
  }

  return null;
}

async function main() {
  console.log('📋 Expanding leagues_registry.json to 50 leagues...\n');

  try {
    // 1. Load existing registry
    const registryPath = path.join(__dirname, '../../src/config/leagues_registry.json');
    const existingRegistry: LeagueRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    console.log(`✅ Loaded existing registry: ${existingRegistry.leagues.length} leagues\n`);

    // 2. Fetch FootyStats allowlist (50 leagues)
    const fsLeaguesResult = await pool.query(`
      SELECT competition_id, name, country
      FROM fs_competitions_allowlist
      WHERE is_enabled = TRUE
      ORDER BY name
      LIMIT 50;
    `);
    console.log(`✅ Fetched ${fsLeaguesResult.rows.length} leagues from FootyStats allowlist\n`);

    // 3. Fetch all TheSports competitions
    const tsCompetitionsResult = await pool.query(`
      SELECT c.external_id, c.name
      FROM ts_competitions c
      ORDER BY c.name;
    `);
    console.log(`✅ Fetched ${tsCompetitionsResult.rows.length} TheSports competitions\n`);

    // 4. Fetch all TheSports seasons (2025-2026)
    const tsSeasonsResult = await pool.query(`
      SELECT external_id, competition_id, year
      FROM ts_seasons
      WHERE year LIKE '%2025%' OR year LIKE '%2026%'
      ORDER BY year DESC;
    `);
    const seasonMap: Record<string, string> = {};
    tsSeasonsResult.rows.forEach((s: any) => {
      if (!seasonMap[s.competition_id]) {
        seasonMap[s.competition_id] = s.external_id;
      }
    });
    console.log(`✅ Mapped ${Object.keys(seasonMap).length} competitions to 2025-2026 seasons\n`);

    // 5. Match and build registry
    const newLeagues: LeagueEntry[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < fsLeaguesResult.rows.length; i++) {
      const fsLeague = fsLeaguesResult.rows[i];
      const priority = i + 1;

      const tsMatch = matchTheSportsCompetition(
        fsLeague.name,
        fsLeague.country,
        tsCompetitionsResult.rows
      );

      const leagueEntry: LeagueEntry = {
        id: generateLeagueId(fsLeague.name, fsLeague.country),
        name: fsLeague.name,
        display_name: fsLeague.name,
        country: fsLeague.country,
        country_code: COUNTRY_CODES[fsLeague.country] || fsLeague.country.substring(0, 3).toUpperCase(),
        priority,
        thesports: {
          competition_id: tsMatch?.external_id || null,
          season_2025_2026_id: tsMatch ? (seasonMap[tsMatch.external_id] || null) : null,
          db_name: tsMatch?.name || null
        },
        footystats: {
          league_name: fsLeague.name,
          country: fsLeague.country
        }
      };

      newLeagues.push(leagueEntry);

      if (tsMatch) {
        matchedCount++;
        console.log(`✅ ${priority}. ${fsLeague.name} (${fsLeague.country}) → ${tsMatch.name}`);
      } else {
        unmatchedCount++;
        console.log(`⚠️  ${priority}. ${fsLeague.name} (${fsLeague.country}) → NO MATCH`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Total: ${newLeagues.length} leagues`);
    console.log(`  Matched: ${matchedCount}`);
    console.log(`  Unmatched: ${unmatchedCount}\n`);

    // 6. Update registry
    const updatedRegistry: LeagueRegistry = {
      version: '2.0.0',
      last_updated: new Date().toISOString().split('T')[0],
      description: `Top ${newLeagues.length} leagues with TheSports + FootyStats mapping (Hobby Package)`,
      leagues: newLeagues,
      notes: {
        package: 'FootyStats Hobby Package - Top 50 Leagues',
        thesports_ids: 'Filled from ts_competitions table WHERE year LIKE \'%2025%\' OR year LIKE \'%2026%\'',
        footystats_ids: 'League names from FootyStats allowlist (fs_competitions_allowlist)',
        priority: '1 = Highest priority (auto-sync always), 50+ = Lower priority',
        missing_season_ids: 'Some leagues don\'t have 2025-2026 season in database yet (marked as null)',
        unmatched_leagues: 'Leagues without TheSports match will have null IDs - manual mapping needed'
      }
    };

    // 7. Write to file
    fs.writeFileSync(registryPath, JSON.stringify(updatedRegistry, null, 2), 'utf-8');
    console.log(`✅ Registry updated: ${registryPath}\n`);

    // 8. Also write to frontend
    const frontendRegistryPath = path.join(__dirname, '../../frontend/src/config/leagues_registry.json');
    fs.writeFileSync(frontendRegistryPath, JSON.stringify(updatedRegistry, null, 2), 'utf-8');
    console.log(`✅ Frontend registry updated: ${frontendRegistryPath}\n`);

    console.log('✅ Done! Registry expanded to 50 leagues.');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main();
