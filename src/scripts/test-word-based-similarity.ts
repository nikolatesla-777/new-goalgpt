/**
 * Test Word-Based Similarity
 * 
 * "Al Ittihad Jeddah" vs "Al Ittihad Club" test
 */

import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function testWordBasedSimilarity() {
    console.log('\n🧪 Testing Word-Based Similarity');
    console.log('='.repeat(60));
    
    const team1 = "Al Ittihad Jeddah";
    const team2 = "Al Ittihad Club";
    
    console.log(`\nTeam 1: "${team1}"`);
    console.log(`Team 2: "${team2}"`);
    console.log();
    
    // Normalize
    const normalized1 = teamNameMatcherService.normalizeTeamName(team1);
    const normalized2 = teamNameMatcherService.normalizeTeamName(team2);
    
    console.log(`Normalized 1: "${normalized1}"`);
    console.log(`Normalized 2: "${normalized2}"`);
    console.log();
    
    // Calculate similarity
    const similarity = teamNameMatcherService.calculateSimilarity(normalized1, normalized2);
    
    console.log(`Similarity: ${(similarity * 100).toFixed(2)}%`);
    console.log(`Threshold: 60%`);
    console.log();
    
    if (similarity >= 0.6) {
        console.log('✅ PASSED: Similarity >= 60%');
        console.log('   → Yeni algoritma ile EŞLEŞECEK!');
    } else {
        console.log('❌ FAILED: Similarity < 60%');
        console.log(`   → Hala eşleşmeyecek (${(similarity * 100).toFixed(2)}% < 60%)`);
    }
    
    // Word breakdown
    console.log('\n📝 Word Breakdown:');
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);
    
    console.log(`Words 1: [${words1.join(', ')}]`);
    console.log(`Words 2: [${words2.join(', ')}]`);
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
    
    console.log('\n' + '='.repeat(60) + '\n');
}

testWordBasedSimilarity()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


