/**
 * Test Al Ittihad Jeddah - Al Taawon Buraidah Match
 * 
 * Yeni algoritma ile eşleştirme testi
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';
import { logger } from '../utils/logger';

async function testAlIttihadMatch() {
    const client = await pool.connect();
    
    try {
        console.log('\n🔍 Testing: Al Ittihad Jeddah - Al Taawon Buraidah');
        console.log('='.repeat(60));
        
        const homeTeamName = "Al Ittihad Jeddah";
        const awayTeamName = "Al Taawon Buraidah";
        
        // 1. Tahmini bul
        console.log('\n📝 Step 1: Finding prediction in database...');
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
            console.log(`   ✅ Prediction found: ${pred.id}`);
            console.log(`   Home: ${pred.home_team_name}`);
            console.log(`   Away: ${pred.away_team_name}`);
            console.log(`   League: ${pred.league_name}`);
            console.log(`   Created: ${pred.created_at}`);
        } else {
            console.log('   ⚠️  Prediction not found in database');
        }
        
        // 2. Yeni algoritma ile takım eşleştirmesi
        console.log('\n📝 Step 2: Testing NEW algorithm team matching...');
        
        console.log(`\n   Home Team: "${homeTeamName}"`);
        const homeMatch = await teamNameMatcherService.findTeamByAlias(homeTeamName);
        
        if (homeMatch) {
            console.log(`   ✅ MATCHED: ${homeMatch.teamName} (${homeMatch.teamId})`);
            console.log(`   Confidence: ${(homeMatch.confidence * 100).toFixed(2)}%`);
            console.log(`   Method: ${homeMatch.matchMethod}`);
            
            if (homeMatch.confidence >= 0.6) {
                console.log('   ✅ Threshold PASSED (>= 60%)');
            } else {
                console.log('   ❌ Threshold FAILED (< 60%)');
            }
        } else {
            console.log('   ❌ NO MATCH FOUND');
        }
        
        console.log(`\n   Away Team: "${awayTeamName}"`);
        const awayMatch = await teamNameMatcherService.findTeamByAlias(awayTeamName);
        
        if (awayMatch) {
            console.log(`   ✅ MATCHED: ${awayMatch.teamName} (${awayMatch.teamId})`);
            console.log(`   Confidence: ${(awayMatch.confidence * 100).toFixed(2)}%`);
            console.log(`   Method: ${awayMatch.matchMethod}`);
            
            if (awayMatch.confidence >= 0.6) {
                console.log('   ✅ Threshold PASSED (>= 60%)');
            } else {
                console.log('   ❌ Threshold FAILED (< 60%)');
            }
        } else {
            console.log('   ❌ NO MATCH FOUND');
        }
        
        // 3. Yeni algoritma ile maç bulma
        console.log('\n📝 Step 3: Testing NEW algorithm match lookup...');
        
        const matchResult = await teamNameMatcherService.findMatchByTeams(
            homeTeamName,
            awayTeamName
        );
        
        if (matchResult) {
            console.log('   ✅ MATCH FOUND!');
            console.log(`   Match ID: ${matchResult.matchExternalId}`);
            console.log(`   Overall Confidence: ${(matchResult.overallConfidence * 100).toFixed(2)}%`);
            console.log(`   Home: ${matchResult.homeTeam.teamName} (${(matchResult.homeTeam.confidence * 100).toFixed(1)}%)`);
            console.log(`   Away: ${matchResult.awayTeam.teamName} (${(matchResult.awayTeam.confidence * 100).toFixed(1)}%)`);
            console.log(`   Status: ${matchResult.statusId}`);
            
            if (matchResult.overallConfidence >= 0.6) {
                console.log('   ✅ Overall threshold PASSED (>= 60%)');
                console.log('\n   🎯 CONCLUSION: Yeni algoritma ile EŞLEŞME SAĞLANACAKTI!');
            } else {
                console.log('   ⚠️  Overall threshold WARNING (< 60%)');
            }
        } else {
            console.log('   ❌ NO MATCH FOUND');
            
            // 4. Neden bulunamadı analizi
            console.log('\n📝 Step 4: Why match not found?');
            
            if (!homeMatch && !awayMatch) {
                console.log('   ❌ Both teams failed to match');
                console.log('   → Alias tablosuna eklenmeli veya fuzzy search iyileştirilmeli');
            } else if (homeMatch && !awayMatch) {
                console.log('   ⚠️  Home matched but away not matched');
                console.log('   → Away team için alias eklenmeli');
            } else if (!homeMatch && awayMatch) {
                console.log('   ⚠️  Away matched but home not matched');
                console.log('   → Home team için alias eklenmeli');
            } else {
                console.log('   ⚠️  Both teams matched but no live match found');
                console.log('   → Maç canlı değil veya veritabanında yok');
            }
            
            // 5. Veritabanında maç var mı kontrol et
            if (homeMatch || awayMatch) {
                const teamId = homeMatch?.teamId || awayMatch?.teamId;
                console.log(`\n📝 Step 5: Checking for matches with team ID: ${teamId}`);
                
                const matchCheckQuery = `
                    SELECT 
                        m.external_id,
                        m.status_id,
                        m.match_time,
                        ht.name as home_team_name,
                        at.name as away_team_name
                    FROM ts_matches m
                    JOIN ts_teams ht ON ht.external_id = m.home_team_id
                    JOIN ts_teams at ON at.external_id = m.away_team_id
                    WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
                    ORDER BY m.match_time DESC
                    LIMIT 5
                `;
                
                const matchCheck = await client.query(matchCheckQuery, [teamId]);
                
                if (matchCheck.rows.length > 0) {
                    console.log(`   Found ${matchCheck.rows.length} match(es):`);
                    matchCheck.rows.forEach((m: any, index: number) => {
                        const status = m.status_id === 8 ? 'Finished' : 
                                      [2,3,4,5,7].includes(m.status_id) ? 'Live' : 
                                      'Not Started';
                        console.log(`   ${index + 1}. ${m.home_team_name} vs ${m.away_team_name}`);
                        console.log(`      Status: ${status} (${m.status_id})`);
                        console.log(`      Match ID: ${m.external_id}`);
                    });
                } else {
                    console.log('   ❌ No matches found in database for this team');
                }
            }
            
            console.log('\n   🎯 CONCLUSION: Yeni algoritma ile EŞLEŞME SAĞLANAMAZDI');
            console.log('   → Alias eklenmeli veya takım isimleri düzeltilmeli');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

testAlIttihadMatch()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


