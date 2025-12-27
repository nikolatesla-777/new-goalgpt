
import { TheSportsClient } from './services/thesports/client/client';
import { logger } from './utils/logger';

async function diagnose() {
    const client = new TheSportsClient();
    const matchId = 'x7lm7phjo39gm2w';

    console.log('--- DIAGNOSTIC START ---');

    console.log('1. Fetching /match/detail_live...');
    try {
        const liveData = await client.get<any>('/match/detail_live');
        const match = liveData.results.find((m: any) => m.id === matchId);
        if (match) {
            console.log('Live Data Stats:', JSON.stringify(match.stats, null, 2));
        } else {
            console.log('Match not found in detail_live');
        }
    } catch (e) {
        console.error('Error fetching detail_live', e);
    }

    console.log('2. Fetching /match/team_stats/detail...');
    try {
        const teamStats = await client.get<any>('/match/team_stats/detail', { match_id: matchId });
        console.log('Team Stats Detail:', JSON.stringify(teamStats, null, 2));
    } catch (e) {
        console.error('Error fetching team_stats/detail', e);
    }

    console.log('3. Fetching /match/analysis...');
    try {
        const analysis = await client.get<any>('/match/analysis', { match_id: matchId });
        console.log('Match Analysis:', JSON.stringify(analysis, null, 2));
    } catch (e) {
        console.error('Error fetching match/analysis', e);
    }

    console.log('--- DIAGNOSTIC END ---');
}

diagnose();
