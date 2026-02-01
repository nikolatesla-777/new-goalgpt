import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.FOOTYSTATS_API_KEY;

  // Test problematic competitions
  const competitions = [
    { id: 22, name: 'Belgian Pro League' },
    { id: 25, name: 'Russian Premier League' },
    { id: 26, name: 'Ukrainian Premier League' },
    { id: 27, name: 'Greek Super League' },
    { id: 3, name: 'Championship (England)' },
  ];

  for (const comp of competitions) {
    console.log('='.repeat(80));
    console.log(`Testing: [${comp.id}] ${comp.name}`);
    console.log('='.repeat(80));

    try {
      const url = new URL('https://api.football-data-api.com/league-teams');
      url.searchParams.set('key', apiKey!);
      url.searchParams.set('league_id', String(comp.id));

      const res = await fetch(url.toString());

      if (!res.ok) {
        console.log(`❌ Status: ${res.status} ${res.statusText}`);
        const body = await res.text();
        console.log(`Response: ${body.slice(0, 200)}`);
        console.log('');
        continue;
      }

      const data = await res.json();

      if (!data.success || !Array.isArray(data.data)) {
        console.log('❌ Invalid response structure');
        console.log('');
        continue;
      }

      console.log(`✅ Status: 200 OK`);
      console.log(`Teams returned: ${data.data.length}`);

      if (data.data.length > 0) {
        const first = data.data[0];
        console.log('');
        console.log('First team:');
        console.log(`  id: ${first.id}`);
        console.log(`  name: ${first.name}`);
        console.log(`  clean_name: ${first.clean_name}`);
        console.log(`  competition_id: ${first.competition_id}`);
        console.log('');

        // Check if Birmingham exists
        const birmingham = data.data.find((t: any) =>
          t.name && t.name.toLowerCase().includes('birmingham')
        );

        if (birmingham) {
          console.log('⚠️  BIRMINGHAM FOUND IN THIS LEAGUE!');
          console.log(`  id: ${birmingham.id}`);
          console.log(`  name: ${birmingham.name}`);
          console.log(`  competition_id: ${birmingham.competition_id}`);
        }

        // Show all team names (first 5)
        console.log('All teams (first 5):');
        data.data.slice(0, 5).forEach((t: any, idx: number) => {
          console.log(`  ${idx + 1}. [${t.id}] ${t.name} (comp_id: ${t.competition_id})`);
        });
      }

      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }
  }

  process.exit(0);
}

main();
