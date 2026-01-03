
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { formatTheSportsDate } from '../utils/thesports/timestamp.util';

async function main() {
    const client = new TheSportsClient();
    const dateStr = formatTheSportsDate(new Date()).replace(/-/g, ''); // YYYYMMDD
    console.log(`Fetching match diary for date: ${dateStr}`);

    try {
        const response = await client.get<any>('/match/diary', { date: dateStr });
        const matches = response.results || [];
        console.log(`API returned ${matches.length} matches.`);

        const relevant = matches.filter((m: any) =>
        (m.home_team_id === '27' || m.competition_id === '27' ||
            JSON.stringify(m).toLowerCase().includes('ittihad'))
        );

        console.log(`Found ${relevant.length} relevant matches (Ittihad or Comp 27):`);
        relevant.forEach((m: any) => {
            console.log(`[${m.match_time}] ${m.home_team_id} vs ${m.away_team_id} (Comp: ${m.competition_id}) Status: ${m.status_id}`);
            // Try to find names in results_extra if available
            const homeName = response.results_extra?.team?.[m.home_team_id]?.name || 'Unknown';
            const awayName = response.results_extra?.team?.[m.away_team_id]?.name || 'Unknown';
            console.log(`   Names: ${homeName} vs ${awayName}`);
        });

    } catch (e: any) {
        console.error('Error fetching diary:', e.message);
    }
}

main();
