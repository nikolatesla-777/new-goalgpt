/**
 * Check Correct Match
 * 
 * k82rekhg12wnrep maçını kontrol et
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function checkCorrectMatch() {
    const client = await pool.connect();
    
    try {
        const matchId = 'k82rekhg12wnrep';
        
        console.log('\n🔍 Checking Match: k82rekhg12wnrep');
        console.log('='.repeat(60));
        
        // 1. Maçı bul
        const matchQuery = `
            SELECT 
                m.external_id,
                m.id as match_uuid,
                m.status_id,
                m.match_time,
                ht.name as home_team_name,
                ht.external_id as home_team_id,
                at.name as away_team_name,
                at.external_id as away_team_id,
                c.name as competition_name
            FROM ts_matches m
            JOIN ts_teams ht ON ht.external_id = m.home_team_id
            JOIN ts_teams at ON at.external_id = m.away_team_id
            LEFT JOIN ts_competitions c ON c.external_id = m.competition_id
            WHERE m.external_id = $1
        `;
        
        const matchResult = await client.query(matchQuery, [matchId]);
        
        if (matchResult.rows.length === 0) {
            console.log('❌ Match not found in database');
            return;
        }
        
        const match = matchResult.rows[0];
        console.log('\n✅ Match found:');
        console.log(`   Home: ${match.home_team_name} (${match.home_team_id})`);
        console.log(`   Away: ${match.away_team_name} (${match.away_team_id})`);
        console.log(`   Competition: ${match.competition_name}`);
        console.log(`   Status: ${match.status_id}`);
        console.log(`   Match Time: ${new Date(match.match_time * 1000).toLocaleString()}`);
        
        // 2. Tahmin isimlerini kontrol et
        console.log('\n📝 Checking prediction team names...');
        const predQuery = `
            SELECT * FROM ai_predictions
            WHERE home_team_name ILIKE '%Ittihad%'
              AND away_team_name ILIKE '%Taawon%'
              AND processed = false
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const predResult = await client.query(predQuery);
        
        if (predResult.rows.length > 0) {
            const pred = predResult.rows[0];
            console.log(`   Prediction Home: "${pred.home_team_name}"`);
            console.log(`   Prediction Away: "${pred.away_team_name}"`);
            console.log(`   Match Home: "${match.home_team_name}"`);
            console.log(`   Match Away: "${match.away_team_name}"`);
            
            // 3. Similarity kontrolü
            console.log('\n📊 Similarity Analysis:');
            
            const homeSim = teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName(pred.home_team_name),
                teamNameMatcherService.normalizeTeamName(match.home_team_name)
            );
            
            const awaySim = teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName(pred.away_team_name),
                teamNameMatcherService.normalizeTeamName(match.away_team_name)
            );
            
            console.log(`   Home similarity: ${(homeSim * 100).toFixed(2)}%`);
            console.log(`   Away similarity: ${(awaySim * 100).toFixed(2)}%`);
            
            if (homeSim >= 0.6 && awaySim >= 0.6) {
                console.log('   ✅ BOTH PASSED threshold (>= 60%)');
            } else {
                console.log('   ⚠️  One or both below threshold');
            }
            
            // 4. Yeni algoritma ile test et
            console.log('\n🧪 Testing with NEW algorithm...');
            const matchLookup = await teamNameMatcherService.findMatchByTeams(
                pred.home_team_name,
                pred.away_team_name
            );
            
            if (matchLookup) {
                console.log(`   ✅ Match found by algorithm: ${matchLookup.matchExternalId}`);
                console.log(`   Confidence: ${(matchLookup.overallConfidence * 100).toFixed(2)}%`);
                
                if (matchLookup.matchExternalId === matchId) {
                    console.log('   ✅ CORRECT MATCH FOUND!');
                } else {
                    console.log(`   ⚠️  Different match found: ${matchLookup.matchExternalId} (expected: ${matchId})`);
                }
            } else {
                console.log('   ❌ Algorithm could not find match');
                
                // 5. Neden bulamadı?
                console.log('\n🔍 Why algorithm failed:');
                
                const homeMatch = await teamNameMatcherService.findTeamByAlias(pred.home_team_name);
                const awayMatch = await teamNameMatcherService.findTeamByAlias(pred.away_team_name);
                
                if (homeMatch) {
                    console.log(`   Home matched: ${homeMatch.teamName} (${homeMatch.teamId})`);
                    console.log(`   Expected: ${match.home_team_name} (${match.home_team_id})`);
                    
                    if (homeMatch.teamId === match.home_team_id) {
                        console.log('   ✅ Home team ID matches!');
                    } else {
                        console.log('   ❌ Home team ID mismatch!');
                    }
                } else {
                    console.log('   ❌ Home team not matched');
                }
                
                if (awayMatch) {
                    console.log(`   Away matched: ${awayMatch.teamName} (${awayMatch.teamId})`);
                    console.log(`   Expected: ${match.away_team_name} (${match.away_team_id})`);
                    
                    if (awayMatch.teamId === match.away_team_id) {
                        console.log('   ✅ Away team ID matches!');
                    } else {
                        console.log('   ❌ Away team ID mismatch!');
                    }
                } else {
                    console.log('   ❌ Away team not matched');
                }
                
                // 6. Maç durumu kontrolü
                console.log(`\n   Match status: ${match.status_id}`);
                if (![2, 3, 4, 5, 7].includes(match.status_id)) {
                    console.log('   ⚠️  Match is not LIVE (status_id not in 2,3,4,5,7)');
                    console.log('   → Algorithm only searches for LIVE matches');
                }
            }
        } else {
            console.log('   ⚠️  No pending prediction found');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

checkCorrectMatch()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

