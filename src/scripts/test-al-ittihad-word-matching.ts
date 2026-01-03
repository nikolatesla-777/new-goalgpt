/**
 * Test Al Ittihad Word-Based Matching
 * 
 * "Al Ittihad Jeddah" vs "Al Ittihad Club" gerçek test
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function testAlIttihadWordMatching() {
    const client = await pool.connect();
    
    try {
        console.log('\n🧪 Testing Word-Based Matching: Al Ittihad Jeddah vs Al Ittihad Club');
        console.log('='.repeat(60));
        
        const searchName = "Al Ittihad Jeddah";
        const dbName = "Al Ittihad Club";
        
        // 1. Normalize
        const normalizedSearch = teamNameMatcherService.normalizeTeamName(searchName);
        const normalizedDb = teamNameMatcherService.normalizeTeamName(dbName);
        
        console.log(`\nSearch: "${searchName}"`);
        console.log(`Normalized: "${normalizedSearch}"`);
        console.log(`\nDatabase: "${dbName}"`);
        console.log(`Normalized: "${normalizedDb}"`);
        
        // 2. Similarity hesapla
        console.log('\n📊 Similarity Calculation:');
        const similarity = teamNameMatcherService.calculateSimilarity(normalizedSearch, normalizedDb);
        console.log(`   Similarity: ${(similarity * 100).toFixed(2)}%`);
        console.log(`   Threshold: 60%`);
        
        if (similarity >= 0.6) {
            console.log('   ✅ PASSED: Similarity >= 60%');
        } else {
            console.log('   ❌ FAILED: Similarity < 60%');
        }
        
        // 3. Word breakdown
        console.log('\n📝 Word Breakdown:');
        const words1 = normalizedSearch.split(/\s+/);
        const words2 = normalizedDb.split(/\s+/);
        
        console.log(`   Words 1: [${words1.join(', ')}]`);
        console.log(`   Words 2: [${words2.join(', ')}]`);
        console.log();
        
        for (let i = 0; i < words1.length; i++) {
            const word1 = words1[i];
            let bestMatch = 0;
            let bestWord = '';
            
            for (const word2 of words2) {
                const wordSim = teamNameMatcherService.calculateWordSimilarity(word1, word2);
                if (wordSim > bestMatch) {
                    bestMatch = wordSim;
                    bestWord = word2;
                }
            }
            
            const matchStatus = bestMatch >= 0.8 ? '✅' : bestMatch >= 0.5 ? '⚠️' : '❌';
            console.log(`   ${matchStatus} "${word1}" vs "${bestWord}": ${(bestMatch * 100).toFixed(2)}%`);
        }
        
        // 4. Veritabanında test et
        console.log('\n📝 Testing with Database:');
        const match = await teamNameMatcherService.findTeamByAlias(searchName);
        
        if (match) {
            console.log(`   ✅ Found: ${match.teamName}`);
            console.log(`   Confidence: ${(match.confidence * 100).toFixed(2)}%`);
            console.log(`   Method: ${match.matchMethod}`);
            
            // Veritabanındaki gerçek takımı kontrol et
            const dbTeamQuery = `
                SELECT external_id, name
                FROM ts_teams
                WHERE name = 'Al Ittihad Club'
            `;
            const dbTeam = await client.query(dbTeamQuery);
            
            if (dbTeam.rows.length > 0) {
                const dbTeamId = dbTeam.rows[0].external_id;
                console.log(`\n   Database team: ${dbTeam.rows[0].name} (${dbTeamId})`);
                console.log(`   Matched team: ${match.teamName} (${match.teamId})`);
                
                if (match.teamId === dbTeamId) {
                    console.log('   ✅ CORRECT TEAM MATCHED!');
                } else {
                    console.log('   ❌ WRONG TEAM MATCHED');
                }
            }
        } else {
            console.log('   ❌ No match found');
        }
        
        // 5. Maç bulma testi
        console.log('\n📝 Testing Match Lookup:');
        const matchLookup = await teamNameMatcherService.findMatchByTeams(
            "Al Ittihad Jeddah",
            "Al Taawon Buraidah"
        );
        
        if (matchLookup) {
            console.log(`   ✅ Match found: ${matchLookup.matchExternalId}`);
            console.log(`   Confidence: ${(matchLookup.overallConfidence * 100).toFixed(2)}%`);
            
            // Doğru maç mı?
            if (matchLookup.matchExternalId === 'k82rekhg12wnrep') {
                console.log('   ✅ CORRECT MATCH FOUND!');
            } else {
                console.log(`   ⚠️  Different match: ${matchLookup.matchExternalId} (expected: k82rekhg12wnrep)`);
            }
        } else {
            console.log('   ❌ No match found');
            
            // Neden bulamadı?
            const homeMatch = await teamNameMatcherService.findTeamByAlias("Al Ittihad Jeddah");
            const awayMatch = await teamNameMatcherService.findTeamByAlias("Al Taawon Buraidah");
            
            console.log('\n   Analysis:');
            if (homeMatch) {
                console.log(`   Home matched: ${homeMatch.teamName} (${(homeMatch.confidence * 100).toFixed(1)}%)`);
            } else {
                console.log('   Home: Not matched');
            }
            
            if (awayMatch) {
                console.log(`   Away matched: ${awayMatch.teamName} (${(awayMatch.confidence * 100).toFixed(1)}%)`);
            } else {
                console.log('   Away: Not matched');
            }
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

testAlIttihadWordMatching()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

