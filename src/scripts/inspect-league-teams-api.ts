import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.FOOTYSTATS_API_KEY;
  const competitionId = 14972; // Süper Lig

  console.log(`Testing FootyStats /league-teams API with competition_id=${competitionId}`);
  console.log('');

  // Test different season formats
  const seasonFormats = [
    '2025/2026',
    '2025-2026',
    '2025',
    '2026',
    null, // No season parameter
  ];

  for (const season of seasonFormats) {
    console.log('='.repeat(60));
    console.log(`Testing season format: ${season === null ? '(no season param)' : `"${season}"`}`);
    console.log('='.repeat(60));

    try {
      const url = new URL('https://api.football-data-api.com/league-teams');
      url.searchParams.set('key', apiKey!);
      url.searchParams.set('league_id', String(competitionId));

      if (season !== null) {
        url.searchParams.set('season_id', season);
      }

      console.log('URL:', url.toString().replace(apiKey!, 'KEY'));
      console.log('');

      const res = await fetch(url.toString());
      console.log('Response status:', res.status, res.statusText);
      console.log('');

      if (res.ok) {
        const data = await res.json();
        console.log('✅ SUCCESS!');
        console.log('  success:', data.success);
        console.log('  data type:', Array.isArray(data.data) ? 'array' : typeof data.data);
        console.log('  data length:', Array.isArray(data.data) ? data.data.length : 'N/A');

        if (Array.isArray(data.data) && data.data.length > 0) {
          const first = data.data[0];
          console.log('');
          console.log('First team:');
          console.log('  id:', first.id);
          console.log('  name:', first.name);
          console.log('  clean_name:', first.clean_name);
          console.log('  competition_id:', first.competition_id);
        }
      } else {
        const body = await res.text();
        console.log('❌ FAILED!');
        console.log('Response body:', body.slice(0, 200));
      }
    } catch (error: any) {
      console.log('❌ ERROR:', error.message);
    }

    console.log('');
  }

  process.exit(0);
}

main();
