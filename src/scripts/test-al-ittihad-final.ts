/**
 * Final Test: Al Ittihad Jeddah vs Al Ittihad Club
 * 
 * Tüm adayları bulup similarity ile en iyisini seçiyor mu?
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function testFinal() {
    const client = await pool.connect();
    
    try {
        console.log('\n🧪 Final Test: Al Ittihad Jeddah');
        console.log('='.repeat(60));
        
        const searchName = "Al Ittihad Jeddah";
        const normalizedSearch = teamNameMatcherService.normalizeTeamName(searchName);
        
        console.log(`Search: "${searchName}"`);
        console.log(`Normalized: "${normalizedSearch}"`);
        console.log();
        
        // Normalized query ile adayları bul
        const words = normalizedSearch.split(/\s+/).filter(w => w.length > 1);
        const firstTwoWords = words.slice(0, 2);
        
        console.log(`Words: [${words.join(', ')}]`);
        console.log(`First 2 words: [${firstTwoWords.join(', ')}]`);
        console.log();
        
        const query = `
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $1
              AND LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $2
            ORDER BY 
              CASE WHEN LOWER(name) LIKE $3 THEN 0 ELSE 1 END,
              LENGTH(name)
            LIMIT 20
        `;
        
        const result = await client.query(query, [
            `%${firstTwoWords[0]}%`,
            `%${firstTwoWords[1]}%`,
            `%${normalizedSearch}%`
        ]);
        
        console.log(`Found ${result.rows.length} candidate(s):\n`);
        
        const scored: Array<{team: any; similarity: number; normalized: string}> = [];
        
        for (const team of result.rows) {
            const teamNormalized = teamNameMatcherService.normalizeTeamName(team.name);
            const similarity = teamNameMatcherService.calculateSimilarity(normalizedSearch, teamNormalized);
            
            scored.push({ team, similarity, normalized: teamNormalized });
        }
        
        // Sort by similarity
        scored.sort((a, b) => b.similarity - a.similarity);
        
        console.log('Scored Candidates (sorted by similarity):');
        scored.forEach((item, index) => {
            const status = item.similarity >= 0.6 ? '✅' : '❌';
            console.log(`\n${index + 1}. ${status} ${item.team.name}`);
            console.log(`   Normalized: "${item.normalized}"`);
            console.log(`   Similarity: ${(item.similarity * 100).toFixed(2)}%`);
            console.log(`   Team ID: ${item.team.external_id}`);
            
            if (item.team.name === 'Al Ittihad Club') {
                console.log('   🎯 THIS IS THE CORRECT TEAM!');
            }
        });
        
        const best = scored[0];
        console.log(`\n📊 Best Match: ${best.team.name}`);
        console.log(`   Similarity: ${(best.similarity * 100).toFixed(2)}%`);
        
        if (best.team.name === 'Al Ittihad Club') {
            console.log('   ✅ CORRECT TEAM SELECTED!');
        } else {
            console.log('   ❌ WRONG TEAM SELECTED');
            console.log(`   Expected: Al Ittihad Club`);
            console.log(`   Got: ${best.team.name}`);
            
            // Find Al Ittihad Club in results
            const correctTeam = scored.find(s => s.team.name === 'Al Ittihad Club');
            if (correctTeam) {
                console.log(`\n   ⚠️  Al Ittihad Club found at position ${scored.indexOf(correctTeam) + 1}`);
                console.log(`   Similarity: ${(correctTeam.similarity * 100).toFixed(2)}%`);
                console.log(`   Difference: ${((best.similarity - correctTeam.similarity) * 100).toFixed(2)}%`);
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

testFinal()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


