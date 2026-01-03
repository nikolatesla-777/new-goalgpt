
import { TheSportsClient } from '../services/thesports/client/thesports-client';

async function main() {
    const client = new TheSportsClient();
    const dates = ['20260102', '20260104']; // Check yesterday and tomorrow

    for (const dateStr of dates) {
        console.log(`\nFetching match diary for date: ${dateStr}`);
        try {
            const response = await client.get<any>('/match/diary', { date: dateStr });
            const matches = response.results || [];
            console.log(`API returned ${matches.length} matches.`);

            // Build map of team/comp names
            const teamNames: Record<string, string> = {};
            if (response.results_extra?.team) {
                Object.values(response.results_extra.team).forEach((t: any) => {
                    teamNames[t.id] = t.name;
                });
            }
            const compNames: Record<string, string> = {};
            if (response.results_extra?.competition) {
                Object.values(response.results_extra.competition).forEach((c: any) => {
                    compNames[c.id] = c.name;
                });
            }

            matches.forEach((m: any) => {
                const home = teamNames[m.home_team_id] || m.home_team_id;
                const away = teamNames[m.away_team_id] || m.away_team_id;
                const comp = compNames[m.competition_id] || m.competition_id;

                const fullStr = `${home} ${away} ${comp}`.toLowerCase();

                if (fullStr.includes('ittihad') || fullStr.includes('taawon') || fullStr.includes('saudi')) {
                    console.log(`Match: [${m.match_time}] ${home} vs ${away} (Comp: ${comp}, ID: ${m.competition_id}) Status: ${m.status_id}`);
                }
            });

        } catch (e: any) {
            console.error('Error fetching diary:', e.message);
        }
    }
}

main();
