/**
 * Analyze Unmatched Prediction
 * 
 * Analyzes why a specific prediction failed to match with TheSports data
 * Example: Simba Sports Club - Muembe Makumbi City FC
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

interface AnalysisResult {
    prediction: any;
    homeTeamMatch: any;
    awayTeamMatch: any;
    matchSearch: any;
    aliasCheck: any;
    recommendations: string[];
}

async function analyzeUnmatchedPrediction(
    homeTeamName: string,
    awayTeamName: string,
    leagueName?: string
): Promise<AnalysisResult> {
    const client = await pool.connect();
    const recommendations: string[] = [];

    try {
        // 1. Find the prediction in database
        const predictionQuery = `
            SELECT * FROM ai_predictions 
            WHERE home_team_name ILIKE $1 
              AND away_team_name ILIKE $2
              AND processed = false
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const predResult = await client.query(predictionQuery, [
            `%${homeTeamName}%`,
            `%${awayTeamName}%`
        ]);

        if (predResult.rows.length === 0) {
            logger.warn(`No pending prediction found for: ${homeTeamName} vs ${awayTeamName}`);
            return {
                prediction: null,
                homeTeamMatch: null,
                awayTeamMatch: null,
                matchSearch: null,
                aliasCheck: null,
                recommendations: ['Prediction not found in database']
            };
        }

        const prediction = predResult.rows[0];
        logger.info(`\n📊 Analyzing prediction: ${prediction.id}`);
        logger.info(`   Teams: ${prediction.home_team_name} vs ${prediction.away_team_name}`);
        logger.info(`   League: ${prediction.league_name}`);
        logger.info(`   Created: ${prediction.created_at}`);

        // 2. Check team name matching
        logger.info(`\n🔍 Step 1: Team Name Matching`);
        
        const homeMatch = await teamNameMatcherService.findTeamByAlias(prediction.home_team_name);
        const awayMatch = await teamNameMatcherService.findTeamByAlias(prediction.away_team_name);

        logger.info(`   Home Team "${prediction.home_team_name}":`);
        if (homeMatch) {
            logger.info(`   ✅ Matched: ${homeMatch.teamName} (${homeMatch.teamId}) - Confidence: ${(homeMatch.confidence * 100).toFixed(1)}%`);
        } else {
            logger.info(`   ❌ No match found`);
            recommendations.push(`Add alias for "${prediction.home_team_name}" in ts_team_aliases table`);
        }

        logger.info(`   Away Team "${prediction.away_team_name}":`);
        if (awayMatch) {
            logger.info(`   ✅ Matched: ${awayMatch.teamName} (${awayMatch.teamId}) - Confidence: ${(awayMatch.confidence * 100).toFixed(1)}%`);
        } else {
            logger.info(`   ❌ No match found`);
            recommendations.push(`Add alias for "${prediction.away_team_name}" in ts_team_aliases table`);
        }

        // 3. Check alias table
        logger.info(`\n🔍 Step 2: Alias Table Check`);
        const aliasQuery = `
            SELECT ta.*, t.name as team_name, t.external_id as team_external_id
            FROM ts_team_aliases ta
            JOIN ts_teams t ON t.external_id = ta.team_external_id
            WHERE LOWER(ta.alias) IN (LOWER($1), LOWER($2))
        `;
        const aliasResult = await client.query(aliasQuery, [
            prediction.home_team_name,
            prediction.away_team_name
        ]);

        if (aliasResult.rows.length > 0) {
            logger.info(`   Found ${aliasResult.rows.length} alias(es):`);
            aliasResult.rows.forEach((row: any) => {
                logger.info(`   - "${row.alias}" → ${row.team_name} (${row.team_external_id})`);
            });
        } else {
            logger.info(`   ❌ No aliases found for these team names`);
        }

        // 4. Search for similar team names in ts_teams
        logger.info(`\n🔍 Step 3: Similar Team Names in Database`);
        const similarHomeQuery = `
            SELECT external_id, name, short_name
            FROM ts_teams
            WHERE name ILIKE $1 OR short_name ILIKE $1
            LIMIT 5
        `;
        const similarAwayQuery = `
            SELECT external_id, name, short_name
            FROM ts_teams
            WHERE name ILIKE $1 OR short_name ILIKE $1
            LIMIT 5
        `;

        const similarHome = await client.query(similarHomeQuery, [`%${prediction.home_team_name.split(' ')[0]}%`]);
        const similarAway = await client.query(similarAwayQuery, [`%${prediction.away_team_name.split(' ')[0]}%`]);

        logger.info(`   Similar to "${prediction.home_team_name}":`);
        if (similarHome.rows.length > 0) {
            similarHome.rows.forEach((row: any) => {
                logger.info(`   - ${row.name} (${row.external_id})`);
            });
        } else {
            logger.info(`   ❌ No similar teams found`);
        }

        logger.info(`   Similar to "${prediction.away_team_name}":`);
        if (similarAway.rows.length > 0) {
            similarAway.rows.forEach((row: any) => {
                logger.info(`   - ${row.name} (${row.external_id})`);
            });
        } else {
            logger.info(`   ❌ No similar teams found`);
        }

        // 5. Try to find match using teamNameMatcherService
        logger.info(`\n🔍 Step 4: Match Lookup Attempt`);
        const matchResult = await teamNameMatcherService.findMatchByTeams(
            prediction.home_team_name,
            prediction.away_team_name,
            prediction.minute_at_prediction,
            prediction.score_at_prediction
        );

        if (matchResult) {
            logger.info(`   ✅ Match found!`);
            logger.info(`   Match ID: ${matchResult.matchExternalId}`);
            logger.info(`   Overall Confidence: ${(matchResult.overallConfidence * 100).toFixed(1)}%`);
            logger.info(`   Home: ${matchResult.homeTeam.teamName} (${matchResult.homeTeam.confidence * 100}%)`);
            logger.info(`   Away: ${matchResult.awayTeam.teamName} (${matchResult.awayTeam.confidence * 100}%)`);
            logger.info(`   Status: ${matchResult.statusId}`);
            
            if (matchResult.overallConfidence < 0.6) {
                recommendations.push(`Match found but confidence (${(matchResult.overallConfidence * 100).toFixed(1)}%) is below threshold (60%)`);
            }
        } else {
            logger.info(`   ❌ No match found`);
            
            // 6. Check if teams exist but match doesn't
            if (homeMatch && awayMatch) {
                logger.info(`\n🔍 Step 5: Checking for Live Match`);
                const liveMatchQuery = `
                    SELECT 
                        m.external_id,
                        m.id as match_uuid,
                        m.status_id,
                        m.match_time,
                        ht.name as home_team_name,
                        at.name as away_team_name,
                        m.home_score_display,
                        m.away_score_display
                    FROM ts_matches m
                    JOIN ts_teams ht ON m.home_team_id = ht.external_id
                    JOIN ts_teams at ON m.away_team_id = at.external_id
                    WHERE (
                        (m.home_team_id = $1 AND m.away_team_id = $2)
                        OR (m.home_team_id = $2 AND m.away_team_id = $1)
                    )
                    AND m.status_id IN (2, 3, 4, 5, 7)
                    ORDER BY m.match_time DESC
                    LIMIT 5
                `;
                const liveMatchResult = await client.query(liveMatchQuery, [
                    homeMatch.teamId,
                    awayMatch.teamId
                ]);

                if (liveMatchResult.rows.length > 0) {
                    logger.info(`   ✅ Found ${liveMatchResult.rows.length} live match(es) with these teams:`);
                    liveMatchResult.rows.forEach((row: any) => {
                        logger.info(`   - ${row.home_team_name} vs ${row.away_team_name} (${row.external_id}) - Status: ${row.status_id}`);
                    });
                    recommendations.push(`Match exists but eşleştirme failed - check matching logic`);
                } else {
                    logger.info(`   ❌ No live match found with these teams`);
                    recommendations.push(`Teams matched but no live match found - match may not be live or doesn't exist`);
                }
            }
        }

        // 7. Check league/competition
        if (prediction.league_name) {
            logger.info(`\n🔍 Step 6: League/Competition Check`);
            const leagueQuery = `
                SELECT external_id, name, country_id
                FROM ts_competitions
                WHERE name ILIKE $1
                LIMIT 5
            `;
            const leagueResult = await client.query(leagueQuery, [`%${prediction.league_name}%`]);
            
            if (leagueResult.rows.length > 0) {
                logger.info(`   Found ${leagueResult.rows.length} similar competition(s):`);
                leagueResult.rows.forEach((row: any) => {
                    logger.info(`   - ${row.name} (${row.external_id})`);
                });
            } else {
                logger.info(`   ❌ No competition found matching "${prediction.league_name}"`);
                recommendations.push(`League "${prediction.league_name}" not found in database - may be a new/unknown league`);
            }
        }

        return {
            prediction,
            homeTeamMatch: homeMatch,
            awayTeamMatch: awayMatch,
            matchSearch: matchResult,
            aliasCheck: aliasResult.rows,
            recommendations
        };

    } catch (error) {
        logger.error('Analysis error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// CLI runner
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: npx tsx analyze-unmatched-prediction.ts <home_team> <away_team> [league]');
        console.log('\nExample:');
        console.log('  npx tsx analyze-unmatched-prediction.ts "Simba Sports Club" "Muembe Makumbi City FC" "Zanzibar Mapinduzi Cup"');
        process.exit(1);
    }

    const homeTeam = args[0];
    const awayTeam = args[1];
    const league = args[2];

    console.log('\n🔍 Analyzing Unmatched Prediction');
    console.log('='.repeat(60));
    console.log(`Home Team: ${homeTeam}`);
    console.log(`Away Team: ${awayTeam}`);
    if (league) console.log(`League: ${league}`);
    console.log('='.repeat(60) + '\n');

    try {
        const result = await analyzeUnmatchedPrediction(homeTeam, awayTeam, league);

        console.log('\n' + '='.repeat(60));
        console.log('📋 SUMMARY & RECOMMENDATIONS');
        console.log('='.repeat(60));

        if (result.recommendations.length > 0) {
            result.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        } else {
            console.log('✅ No issues found - prediction should match');
        }

        console.log('\n');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { analyzeUnmatchedPrediction };


