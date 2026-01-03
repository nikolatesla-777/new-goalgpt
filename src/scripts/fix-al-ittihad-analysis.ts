/**
 * Fix Al Ittihad Match Analysis
 * 
 * Doğru takımları bulup similarity kontrolü
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function analyzeAlIttihad() {
    const client = await pool.connect();
    
    try {
        console.log('\n🔍 Detailed Analysis: Al Ittihad Jeddah - Al Taawon Buraidah');
        console.log('='.repeat(60));
        
        // 1. Veritabanında "Al Ittihad" takımlarını bul
        console.log('\n📝 Step 1: Finding "Al Ittihad" teams in database...');
        const ittihadQuery = `
            SELECT external_id, name, short_name
            FROM ts_teams
            WHERE name ILIKE '%Ittihad%'
            ORDER BY 
              CASE WHEN name ILIKE '%Al Ittihad Jeddah%' AND name NOT ILIKE '%Reserves%' THEN 0
                   WHEN name ILIKE '%Al Ittihad Jeddah%' THEN 1
                   ELSE 2 END,
              name
            LIMIT 10
        `;
        
        const ittihadResult = await client.query(ittihadQuery);
        console.log(`   Found ${ittihadResult.rows.length} team(s):`);
        ittihadResult.rows.forEach((team: any, index: number) => {
            const similarity = teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName("Al Ittihad Jeddah"),
                teamNameMatcherService.normalizeTeamName(team.name)
            );
            console.log(`   ${index + 1}. ${team.name} (${team.external_id})`);
            console.log(`      Similarity: ${(similarity * 100).toFixed(2)}%`);
        });
        
        // 2. Veritabanında "Al Taawon" takımlarını bul
        console.log('\n📝 Step 2: Finding "Al Taawon" teams in database...');
        const taawonQuery = `
            SELECT external_id, name, short_name
            FROM ts_teams
            WHERE name ILIKE '%Taawon%' OR name ILIKE '%Taawoun%' OR name ILIKE '%Tawon%'
            ORDER BY name
            LIMIT 10
        `;
        
        const taawonResult = await client.query(taawonQuery);
        console.log(`   Found ${taawonResult.rows.length} team(s):`);
        taawonResult.rows.forEach((team: any, index: number) => {
            const similarity = teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName("Al Taawon Buraidah"),
                teamNameMatcherService.normalizeTeamName(team.name)
            );
            console.log(`   ${index + 1}. ${team.name} (${team.external_id})`);
            console.log(`      Similarity: ${(similarity * 100).toFixed(2)}%`);
        });
        
        // 3. Canlı maçları kontrol et
        console.log('\n📝 Step 3: Checking for live matches...');
        const liveMatchesQuery = `
            SELECT 
                m.external_id,
                m.status_id,
                m.match_time,
                ht.name as home_team_name,
                at.name as away_team_name,
                ht.external_id as home_team_id,
                at.external_id as away_team_id
            FROM ts_matches m
            JOIN ts_teams ht ON ht.external_id = m.home_team_id
            JOIN ts_teams at ON at.external_id = m.away_team_id
            WHERE (
                (ht.name ILIKE '%Ittihad%' AND ht.name NOT ILIKE '%Reserves%')
                OR (at.name ILIKE '%Ittihad%' AND at.name NOT ILIKE '%Reserves%')
            )
            AND (
                ht.name ILIKE '%Taawon%' OR at.name ILIKE '%Taawon%'
                OR ht.name ILIKE '%Taawoun%' OR at.name ILIKE '%Taawoun%'
            )
            AND m.status_id IN (2, 3, 4, 5, 7)
            ORDER BY m.match_time DESC
            LIMIT 5
        `;
        
        const liveMatches = await client.query(liveMatchesQuery);
        
        if (liveMatches.rows.length > 0) {
            console.log(`   ✅ Found ${liveMatches.rows.length} live match(es):`);
            liveMatches.rows.forEach((m: any, index: number) => {
                console.log(`   ${index + 1}. ${m.home_team_name} vs ${m.away_team_name}`);
                console.log(`      Match ID: ${m.external_id}`);
                console.log(`      Status: ${m.status_id}`);
                
                // Similarity kontrolü
                const homeSim = teamNameMatcherService.calculateSimilarity(
                    teamNameMatcherService.normalizeTeamName("Al Ittihad Jeddah"),
                    teamNameMatcherService.normalizeTeamName(m.home_team_name)
                );
                const awaySim = teamNameMatcherService.calculateSimilarity(
                    teamNameMatcherService.normalizeTeamName("Al Taawon Buraidah"),
                    teamNameMatcherService.normalizeTeamName(m.away_team_name)
                );
                
                console.log(`      Home similarity: ${(homeSim * 100).toFixed(2)}%`);
                console.log(`      Away similarity: ${(awaySim * 100).toFixed(2)}%`);
                
                if (homeSim >= 0.6 && awaySim >= 0.6) {
                    console.log(`      ✅ BOTH PASSED threshold (>= 60%)`);
                } else {
                    console.log(`      ⚠️  One or both below threshold`);
                }
            });
        } else {
            console.log('   ❌ No live matches found');
            
            // Biten maçları kontrol et
            const finishedMatchesQuery = `
                SELECT 
                    m.external_id,
                    m.status_id,
                    m.match_time,
                    ht.name as home_team_name,
                    at.name as away_team_name
                FROM ts_matches m
                JOIN ts_teams ht ON ht.external_id = m.home_team_id
                JOIN ts_teams at ON at.external_id = m.away_team_id
                WHERE (
                    (ht.name ILIKE '%Ittihad%' AND ht.name NOT ILIKE '%Reserves%')
                    OR (at.name ILIKE '%Ittihad%' AND at.name NOT ILIKE '%Reserves%')
                )
                AND (
                    ht.name ILIKE '%Taawon%' OR at.name ILIKE '%Taawon%'
                    OR ht.name ILIKE '%Taawoun%' OR at.name ILIKE '%Taawoun%'
                )
                ORDER BY m.match_time DESC
                LIMIT 3
            `;
            
            const finishedMatches = await client.query(finishedMatchesQuery);
            if (finishedMatches.rows.length > 0) {
                console.log(`\n   ⚠️  Found ${finishedMatches.rows.length} finished match(es) (not live):`);
                finishedMatches.rows.forEach((m: any) => {
                    console.log(`   - ${m.home_team_name} vs ${m.away_team_name} (${m.external_id})`);
                });
            }
        }
        
        // 4. Sonuç ve öneriler
        console.log('\n📝 Step 4: Recommendations...');
        
        const bestIttihad = ittihadResult.rows.find((t: any) => 
            !t.name.includes('Reserves') && 
            teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName("Al Ittihad Jeddah"),
                teamNameMatcherService.normalizeTeamName(t.name)
            ) >= 0.6
        );
        
        const bestTaawon = taawonResult.rows.find((t: any) => 
            teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName("Al Taawon Buraidah"),
                teamNameMatcherService.normalizeTeamName(t.name)
            ) >= 0.6
        );
        
        if (bestIttihad) {
            const sim = teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName("Al Ittihad Jeddah"),
                teamNameMatcherService.normalizeTeamName(bestIttihad.name)
            );
            console.log(`\n   ✅ Best Ittihad match: ${bestIttihad.name}`);
            console.log(`      Similarity: ${(sim * 100).toFixed(2)}%`);
            console.log(`      → Add alias: "Al Ittihad Jeddah" → "${bestIttihad.name}"`);
        } else {
            console.log('\n   ❌ No good Ittihad match found (>= 60%)');
        }
        
        if (bestTaawon) {
            const sim = teamNameMatcherService.calculateSimilarity(
                teamNameMatcherService.normalizeTeamName("Al Taawon Buraidah"),
                teamNameMatcherService.normalizeTeamName(bestTaawon.name)
            );
            console.log(`\n   ✅ Best Taawon match: ${bestTaawon.name}`);
            console.log(`      Similarity: ${(sim * 100).toFixed(2)}%`);
            console.log(`      → Add alias: "Al Taawon Buraidah" → "${bestTaawon.name}"`);
        } else {
            console.log('\n   ❌ No good Taawon match found (>= 60%)');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

analyzeAlIttihad()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

