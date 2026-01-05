/**
 * Check if prediction is available for match display
 * 
 * Verifies that the matched prediction is returned by the API
 * and can be displayed on the match detail page
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function checkPredictionDisplay(matchExternalId: string) {
    const client = await pool.connect();
    
    try {
        console.log(`\n🔍 Checking prediction display for match: ${matchExternalId}\n`);
        
        // 1. Check if prediction match exists
        const matchQuery = `
            SELECT 
                pm.id as match_link_id,
                pm.prediction_id,
                pm.match_external_id,
                pm.overall_confidence,
                pm.prediction_result,
                pm.matched_at,
                p.bot_name,
                p.prediction_type,
                p.prediction_value,
                p.display_prediction,
                p.minute_at_prediction,
                p.processed
            FROM ai_prediction_matches pm
            JOIN ai_predictions p ON p.id = pm.prediction_id
            WHERE pm.match_external_id = $1
            ORDER BY pm.matched_at DESC
            LIMIT 1
        `;
        
        const matchResult = await client.query(matchQuery, [matchExternalId]);
        
        if (matchResult.rows.length === 0) {
            console.log('❌ No prediction match found for this match');
            return;
        }
        
        const predMatch = matchResult.rows[0];
        console.log('✅ Prediction match found:');
        console.log(`   Prediction ID: ${predMatch.prediction_id}`);
        console.log(`   Match External ID: ${predMatch.match_external_id}`);
        console.log(`   Bot: ${predMatch.bot_name}`);
        console.log(`   Type: ${predMatch.prediction_type}`);
        console.log(`   Value: ${predMatch.prediction_value}`);
        console.log(`   Confidence: ${(predMatch.overall_confidence * 100).toFixed(1)}%`);
        console.log(`   Result: ${predMatch.prediction_result || 'pending'}`);
        console.log(`   Processed: ${predMatch.processed}`);
        console.log(`   Matched At: ${predMatch.matched_at}`);
        
        // 2. Check what API returns (simulate getMatchedPredictions query)
        const apiQuery = `
            SELECT 
                p.id,
                p.external_id,
                p.bot_name,
                p.league_name,
                p.home_team_name,
                p.away_team_name,
                p.score_at_prediction,
                p.minute_at_prediction,
                p.prediction_type,
                p.prediction_value,
                p.display_prediction,
                p.processed,
                p.created_at,
                pm.match_external_id,
                pm.overall_confidence,
                pm.prediction_result,
                pm.final_home_score,
                pm.final_away_score,
                pm.matched_at,
                pm.resulted_at
            FROM ai_predictions p
            JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE pm.match_external_id = $1
            ORDER BY p.created_at DESC
            LIMIT 1
        `;
        
        const apiResult = await client.query(apiQuery, [matchExternalId]);
        
        if (apiResult.rows.length > 0) {
            const apiData = apiResult.rows[0];
            console.log('\n✅ API Query Result:');
            console.log(`   match_external_id: ${apiData.match_external_id}`);
            console.log(`   prediction_type: ${apiData.prediction_type}`);
            console.log(`   prediction_value: ${apiData.prediction_value}`);
            console.log(`   bot_name: ${apiData.bot_name}`);
            console.log(`   overall_confidence: ${apiData.overall_confidence}`);
            console.log(`   prediction_result: ${apiData.prediction_result || 'pending'}`);
            
            // 3. Verify frontend can access it
            console.log('\n📱 Frontend Access Check:');
            console.log(`   URL matchId: ${matchExternalId}`);
            console.log(`   API match_external_id: ${apiData.match_external_id}`);
            
            if (apiData.match_external_id === matchExternalId) {
                console.log('   ✅ Match ID matches - Frontend can access prediction');
                console.log(`   Frontend will use: predictions.get('${matchExternalId}')`);
            } else {
                console.log('   ❌ Match ID mismatch!');
            }
            
            // 4. Check if display_prediction is set
            if (apiData.display_prediction) {
                console.log(`\n📝 Display Prediction: "${apiData.display_prediction}"`);
            } else {
                console.log('\n⚠️  Display Prediction is NULL - Admin should set this');
                console.log('   Use: PUT /api/predictions/:id/display');
            }
            
        } else {
            console.log('\n❌ API query returned no results');
        }
        
        // 5. Check match status
        const matchStatusQuery = `
            SELECT 
                m.external_id,
                m.status_id,
                m.home_score_display,
                m.away_score_display,
                ht.name as home_team_name,
                at.name as away_team_name
            FROM ts_matches m
            JOIN ts_teams ht ON m.home_team_id = ht.external_id
            JOIN ts_teams at ON m.away_team_id = at.external_id
            WHERE m.external_id = $1
        `;
        
        const matchStatus = await client.query(matchStatusQuery, [matchExternalId]);
        
        if (matchStatus.rows.length > 0) {
            const match = matchStatus.rows[0];
            console.log('\n🏆 Match Status:');
            console.log(`   Teams: ${match.home_team_name} vs ${match.away_team_name}`);
            console.log(`   Score: ${match.home_score_display || 0}-${match.away_score_display || 0}`);
            console.log(`   Status: ${match.status_id} (${getStatusName(match.status_id)})`);
        }
        
        console.log('\n✅ Check completed!\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

function getStatusName(statusId: number): string {
    const statusMap: Record<number, string> = {
        1: 'Not Started',
        2: 'First Half',
        3: 'Half Time',
        4: 'Second Half',
        5: 'Extra Time',
        7: 'Penalties',
        8: 'Finished',
        9: 'Postponed',
        10: 'Cancelled',
        11: 'Abandoned',
        12: 'Suspended',
        13: 'Interrupted'
    };
    return statusMap[statusId] || `Unknown (${statusId})`;
}

// CLI runner
const matchId = process.argv[2] || 'k82rekhg0w8nrep';

checkPredictionDisplay(matchId)
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


