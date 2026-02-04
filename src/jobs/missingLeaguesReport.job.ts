/**
 * Missing Leagues Report Job
 *
 * Generates a daily report of unmapped matches grouped by league.
 * Helps identify which leagues need to be added to leagues_registry.json
 * or which team name mappings need improvement.
 *
 * Schedule: Daily at 12:00 UTC (after daily lists are generated and published)
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

export async function runMissingLeaguesReport(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'missingLeaguesReport',
      overlapGuard: true,
      advisoryLockKey: LOCK_KEYS.MISSING_LEAGUES_REPORT || 920000000300n,
      timeoutMs: 60000, // 1 minute max
    },
    async (_ctx) => {
      logger.info('[MissingLeaguesReport] 📊 Starting missing leagues report...');

      try {
        // Query unmapped matches from today's daily lists
        const query = `
          SELECT
            (matches->'match'->>'league_name') as league_name,
            (matches->'match'->>'home_name') as home_team,
            (matches->'match'->>'away_name') as away_team,
            (matches->'match'->>'fs_id')::int as fs_id,
            (matches->'match'->>'date_unix')::bigint as match_time,
            list_date
          FROM telegram_daily_lists,
               jsonb_array_elements(matches) as matches
          WHERE list_date = CURRENT_DATE
            AND (matches->'match'->'match_id') IS NULL
            OR (matches->'match'->>'match_id') = 'null'
          ORDER BY league_name, match_time
        `;

        const unmappedMatches = await pool.query(query);

        if (unmappedMatches.rows.length === 0) {
          logger.info('[MissingLeaguesReport] ✅ No unmapped matches found for today. Perfect mapping!');
          return;
        }

        // Group by league
        const leagueGroups: Record<string, any[]> = {};
        unmappedMatches.rows.forEach(row => {
          const league = row.league_name || 'Bilinmeyen Lig';
          if (!leagueGroups[league]) {
            leagueGroups[league] = [];
          }
          leagueGroups[league].push(row);
        });

        // Sort leagues by count (descending)
        const sortedLeagues = Object.entries(leagueGroups).sort((a, b) => b[1].length - a[1].length);

        // Log summary
        logger.warn(
          `[MissingLeaguesReport] ⚠️ Found ${unmappedMatches.rows.length} unmapped matches across ${sortedLeagues.length} leagues`
        );

        // Log detailed breakdown
        logger.info('[MissingLeaguesReport] 📋 Unmapped Matches by League:');
        sortedLeagues.forEach(([leagueName, matches]) => {
          logger.info(`   ${leagueName}: ${matches.length} matches`);

          // Log first 3 matches as examples
          const exampleMatches = matches.slice(0, 3);
          exampleMatches.forEach((match: any) => {
            logger.debug(`      - ${match.home_team} vs ${match.away_team} (FS ID: ${match.fs_id})`);
          });

          if (matches.length > 3) {
            logger.debug(`      ... and ${matches.length - 3} more matches`);
          }
        });

        // Calculate mapping success rate
        const totalMatchesQuery = `
          SELECT COUNT(*) as total_matches
          FROM telegram_daily_lists,
               jsonb_array_elements(matches) as matches
          WHERE list_date = CURRENT_DATE
        `;

        const totalResult = await pool.query(totalMatchesQuery);
        const totalMatches = parseInt(totalResult.rows[0]?.total_matches || '0', 10);
        const mappedMatches = totalMatches - unmappedMatches.rows.length;
        const successRate = totalMatches > 0 ? Math.round((mappedMatches / totalMatches) * 100) : 0;

        logger.info(
          `[MissingLeaguesReport] 📈 Mapping Success Rate: ${mappedMatches}/${totalMatches} (${successRate}%)`
        );

        // Warning if success rate is low
        if (successRate < 80) {
          logger.error(
            `[MissingLeaguesReport] 🚨 LOW MAPPING RATE: Only ${successRate}% of matches were mapped. ` +
            `Consider adding missing leagues to leagues_registry.json or improving team name matching.`
          );
        } else if (successRate < 90) {
          logger.warn(
            `[MissingLeaguesReport] ⚠️ Mapping rate is ${successRate}%. Target is 95%+. ` +
            `Review the leagues listed above.`
          );
        } else {
          logger.info(
            `[MissingLeaguesReport] ✅ Good mapping rate (${successRate}%). ` +
            `${100 - successRate}% unmapped matches are within acceptable range.`
          );
        }

        logger.info('[MissingLeaguesReport] ✅ Report completed successfully');

      } catch (error: any) {
        logger.error(
          `[MissingLeaguesReport] ❌ Failed to generate report: ${error.message}`,
          { error: error.stack }
        );
        throw error;
      }
    }
  );
}
