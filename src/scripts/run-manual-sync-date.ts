
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

async function main() {
    const client = new TheSportsClient();
    const diaryService = new MatchDiaryService(client);
    const teamDataService = new TeamDataService(client);
    const compService = new CompetitionService(client);
    const matchSyncService = new MatchSyncService(teamDataService, compService);

    const dateStr = '20260104'; // The date where the match is found
    console.log(`Manually syncing date: ${dateStr}`);

    try {
        const response = await diaryService.getMatchDiary({ date: dateStr });
        if (!response.results || response.results.length === 0) {
            console.log('No matches found.');
            return;
        }

        console.log(`Found ${response.results.length} matches. Syncing...`);

        // Convert to MatchSyncData
        // (Simplified conversion for script, reusing simplified logic from BootstrapService)
        // Note: We duplicate some logic here for the script to be standalone-ish
        // Ideally we'd call a shared service method, but BootstrapService.syncTodaySchedule is private.
        // We will do a best-effort mapping here. 

        // Actually, let's rely on matchSyncService to handle the heavy lifting if we shape the data right.
        const matchesToSync = response.results.map((match: any) => {
            return {
                external_id: match.id,
                match_time: match.match_time,
                status_id: match.status_id || match.status,
                competition_id: match.competition_id,
                home_team_id: match.home_team_id,
                away_team_id: match.away_team_id,
                home_scores: match.home_scores, // Pass array directly
                away_scores: match.away_scores,
                // Add key fields
                home_score_display: match.home_scores?.[0], // Simplified
                away_score_display: match.away_scores?.[0],

            } as any; // Cast to any to bypass strict checks in script, MatchSyncService will validate criticals
        });

        // We use the full logic from Bootstrap to ensure correctness
        // But since I can't import private methods, I'll essentially trust MatchSyncService

        // Wait! MatchSyncService expects strict MatchSyncData.
        // I should copy the mapping logic correctly or else verification fails.
        // Let's copy the mapping from BootstrapService above.

        const mappedMatches = response.results.map((match: any) => {
            const statusId = typeof match.status === 'number' ? match.status : (match.status_id || null);
            const homeScores = match.home_scores;
            const awayScores = match.away_scores;
            const homeDisplay = (homeScores && homeScores.length > 0) ? homeScores[0] : 0; // Simplified
            const awayDisplay = (awayScores && awayScores.length > 0) ? awayScores[0] : 0;

            return {
                external_id: match.id,
                competition_id: match.competition_id,
                home_team_id: match.home_team_id,
                away_team_id: match.away_team_id,
                status_id: statusId,
                match_time: match.match_time,
                home_scores: homeScores,
                away_scores: awayScores,
                home_score_display: homeDisplay,
                away_score_display: awayDisplay,
                // Add other fields as nulls if strictly required, but syncMatch only requires external_id and match_time
            };
        });

        console.log('Starting batch sync...');
        await matchSyncService.syncMatches(mappedMatches, response.results_extra);
        console.log('Sync complete.');

    } catch (e: any) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}

main();
