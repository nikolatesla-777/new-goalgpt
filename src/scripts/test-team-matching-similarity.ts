/**
 * Test Team Matching Similarity
 * 
 * "Muembe Makumbi City FC" vs "Mwembe Makumbi City FC"
 * Neden %60 threshold'u geçemedi?
 */

import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function testSimilarity() {
    const team1 = "Muembe Makumbi City FC";
    const team2 = "Mwembe Makumbi City FC";
    
    console.log('\n🔍 Similarity Analysis');
    console.log('='.repeat(60));
    console.log(`Team 1: "${team1}"`);
    console.log(`Team 2: "${team2}"`);
    console.log('='.repeat(60) + '\n');
    
    // 1. Normalize
    const normalized1 = teamNameMatcherService.normalizeTeamName(team1);
    const normalized2 = teamNameMatcherService.normalizeTeamName(team2);
    
    console.log('📝 Step 1: Normalization');
    console.log(`   "${team1}" → "${normalized1}"`);
    console.log(`   "${team2}" → "${normalized2}"`);
    console.log();
    
    // 2. Levenshtein Distance
    const distance = teamNameMatcherService.levenshteinDistance(normalized1, normalized2);
    console.log('📏 Step 2: Levenshtein Distance');
    console.log(`   Distance: ${distance}`);
    console.log(`   Team 1 length: ${normalized1.length}`);
    console.log(`   Team 2 length: ${normalized2.length}`);
    console.log();
    
    // 3. Similarity Score
    const similarity = teamNameMatcherService.calculateSimilarity(normalized1, normalized2);
    console.log('🎯 Step 3: Similarity Score');
    console.log(`   Similarity: ${(similarity * 100).toFixed(2)}%`);
    console.log(`   Threshold: 60%`);
    console.log(`   Pass: ${similarity >= 0.6 ? '✅ YES' : '❌ NO'}`);
    console.log();
    
    // 4. Partial Match
    const partial = teamNameMatcherService.partialMatch(normalized1, normalized2);
    console.log('🔗 Step 4: Partial Match');
    console.log(`   Partial Score: ${(partial * 100).toFixed(2)}%`);
    console.log();
    
    // 5. Character-by-character comparison
    console.log('🔤 Step 5: Character Comparison');
    const chars1 = normalized1.split('');
    const chars2 = normalized2.split('');
    const maxLen = Math.max(chars1.length, chars2.length);
    
    let differences = 0;
    for (let i = 0; i < maxLen; i++) {
        const char1 = chars1[i] || '';
        const char2 = chars2[i] || '';
        if (char1 !== char2) {
            differences++;
            console.log(`   Position ${i}: "${char1}" vs "${char2}"`);
        }
    }
    console.log(`   Total differences: ${differences}`);
    console.log();
    
    // 6. Why it failed
    console.log('❌ Why Matching Failed:');
    console.log(`   1. Similarity (${(similarity * 100).toFixed(2)}%) < Threshold (60%)`);
    console.log(`   2. Main difference: "Muembe" vs "Mwembe" (1 character)`);
    console.log(`   3. Total string length: ${maxLen} characters`);
    console.log(`   4. Difference ratio: ${(differences / maxLen * 100).toFixed(2)}%`);
    console.log();
    
    // 7. What would pass?
    console.log('💡 What Would Pass?');
    const requiredSimilarity = 0.6;
    const currentSimilarity = similarity;
    const neededImprovement = requiredSimilarity - currentSimilarity;
    console.log(`   Current: ${(currentSimilarity * 100).toFixed(2)}%`);
    console.log(`   Needed: ${(requiredSimilarity * 100).toFixed(2)}%`);
    console.log(`   Gap: ${(neededImprovement * 100).toFixed(2)}%`);
    console.log();
    
    // 8. Solution
    console.log('✅ Solution Applied:');
    console.log('   Added alias: "Muembe Makumbi City FC" → "Mwembe Makumbi City FC"');
    console.log('   Now exact match via alias table (100% confidence)');
    console.log();
}

testSimilarity()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


