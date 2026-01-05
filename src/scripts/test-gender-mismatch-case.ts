/**
 * Gender Mismatch Case Study
 * 
 * Senaryo:
 * - Canlıda sadece "Al Ittihad Jeddah (W)" (kadın takımı) maçı var
 * - Yapay zeka "Al Ittihad Jeddah" (erkek takımı) için tahmin attı
 * - TheSports'ta takım "Al Ittihad Club (W)" olarak görünüyor
 * - Algoritma ne yapacak?
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function testGenderMismatch() {
    const client = await pool.connect();
    
    try {
        console.log('\n🔍 Gender Mismatch Case Study');
        console.log('='.repeat(60));
        
        // Senaryo
        console.log('\n📝 Senaryo:');
        console.log('   1. Canlıda sadece "Al Ittihad Jeddah (W)" (kadın takımı) maçı var');
        console.log('   2. Yapay zeka "Al Ittihad Jeddah" (erkek takımı) için tahmin attı');
        console.log('   3. TheSports\'ta takım "Al Ittihad Club (W)" olarak görünüyor');
        console.log('   4. Algoritma ne yapacak?');
        console.log();
        
        // 1. Tahmin ismi (erkek takımı)
        const predictionTeamName = "Al Ittihad Jeddah";
        const normalizedPrediction = teamNameMatcherService.normalizeTeamName(predictionTeamName);
        
        console.log('📊 Step 1: Prediction Team Name');
        console.log(`   Original: "${predictionTeamName}"`);
        console.log(`   Normalized: "${normalizedPrediction}"`);
        console.log(`   Type: Erkek takımı (gender belirtilmemiş)`);
        console.log();
        
        // 2. Veritabanında canlı maç var mı?
        console.log('📊 Step 2: Checking Live Matches');
        
        // Önce "Al Ittihad Jeddah" için takım bul
        const teamMatch = await teamNameMatcherService.findTeamByAlias(predictionTeamName);
        
        if (teamMatch) {
            console.log(`   ✅ Team matched: ${teamMatch.teamName} (${teamMatch.teamId})`);
            console.log(`   Confidence: ${(teamMatch.confidence * 100).toFixed(2)}%`);
            console.log(`   Method: ${teamMatch.matchMethod}`);
            
            // Canlı maçları kontrol et
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
                WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
                  AND m.status_id IN (2, 3, 4, 5, 7)
                ORDER BY m.match_time DESC
                LIMIT 5
            `;
            
            const liveMatches = await client.query(liveMatchesQuery, [teamMatch.teamId]);
            
            if (liveMatches.rows.length > 0) {
                console.log(`\n   ✅ Found ${liveMatches.rows.length} live match(es):`);
                liveMatches.rows.forEach((m: any, index: number) => {
                    const isHome = m.home_team_id === teamMatch.teamId;
                    const teamName = isHome ? m.home_team_name : m.away_team_name;
                    const isWomen = /\(w\)|women/i.test(teamName);
                    
                    console.log(`   ${index + 1}. ${m.home_team_name} vs ${m.away_team_name}`);
                    console.log(`      Match ID: ${m.external_id}`);
                    console.log(`      Status: ${m.status_id}`);
                    console.log(`      Team Type: ${isWomen ? '⚠️  KADIN TAKIMI' : '✅ Erkek takımı'}`);
                    
                    if (isWomen) {
                        console.log(`      ⚠️  SORUN: Tahmin erkek takımı için ama maç kadın takımının!`);
                    }
                });
            } else {
                console.log('   ❌ No live matches found for this team');
            }
        } else {
            console.log('   ❌ Team not matched');
        }
        
        // 3. Algoritma ne yapacak?
        console.log('\n📊 Step 3: What Will Algorithm Do?');
        
        // Tüm "Al Ittihad" takımlarını bul
        const allTeamsQuery = `
            SELECT external_id, name
            FROM ts_teams
            WHERE name ILIKE '%Ittihad%Jeddah%'
               OR name ILIKE '%Ittihad%Club%'
            ORDER BY 
              CASE 
                WHEN name NOT ILIKE '%(W)%' AND name NOT ILIKE '%Women%' AND name NOT ILIKE '%Reserve%' THEN 0
                ELSE 1
              END,
              name
        `;
        
        const allTeams = await client.query(allTeamsQuery);
        
        console.log(`\n   Found ${allTeams.rows.length} candidate team(s):`);
        
        const scored: Array<{team: any; similarity: number; normalized: string; isWomen: boolean}> = [];
        
        for (const team of allTeams.rows) {
            const teamNormalized = teamNameMatcherService.normalizeTeamName(team.name);
            const similarity = teamNameMatcherService.calculateSimilarity(normalizedPrediction, teamNormalized);
            const isWomen = /\(w\)|women/i.test(team.name);
            
            scored.push({ team, similarity, normalized: teamNormalized, isWomen });
        }
        
        scored.sort((a, b) => b.similarity - a.similarity);
        
        console.log('\n   Scored Teams (sorted by similarity):');
        scored.forEach((item, index) => {
            const status = item.similarity >= 0.6 ? '✅' : '❌';
            const gender = item.isWomen ? '⚠️  KADIN' : '✅ ERKEK';
            console.log(`\n   ${index + 1}. ${status} ${item.team.name}`);
            console.log(`      Normalized: "${item.normalized}"`);
            console.log(`      Similarity: ${(item.similarity * 100).toFixed(2)}%`);
            console.log(`      Type: ${gender}`);
            
            if (item.similarity >= 0.6 && item.isWomen) {
                console.log(`      ⚠️  SORUN: Algoritma bu takımı seçecek ama bu KADIN takımı!`);
            }
        });
        
        const best = scored[0];
        console.log(`\n📊 Best Match: ${best.team.name}`);
        console.log(`   Similarity: ${(best.similarity * 100).toFixed(2)}%`);
        console.log(`   Type: ${best.isWomen ? '⚠️  KADIN TAKIMI' : '✅ Erkek takımı'}`);
        
        if (best.similarity >= 0.6 && best.isWomen) {
            console.log('\n   ❌ SORUN TESPİT EDİLDİ!');
            console.log('   Algoritma kadın takımını seçecek ama tahmin erkek takımı için!');
            console.log('   → YANLIŞ EŞLEŞME RİSKİ VAR!');
        } else if (best.similarity >= 0.6 && !best.isWomen) {
            console.log('\n   ✅ DOĞRU: Erkek takımı seçilecek');
        } else {
            console.log('\n   ⚠️  Similarity threshold geçilmedi');
        }
        
        // 4. Çözüm önerisi
        console.log('\n📊 Step 4: Solution');
        console.log('   Öneri: Gender/Type kontrolü ekle');
        console.log('   - Eğer tahmin isminde gender belirtilmemişse');
        console.log('   - Reserve/youth/women takımlarına ekstra penalty ver');
        console.log('   - Ana takımlara öncelik ver');
        console.log('   - Örnek: Women takımlarına %30 penalty (şu an %15)');
        
        console.log('\n' + '='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

testGenderMismatch()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


