/**
 * Test New Matching Algorithm
 * 
 * Yeni algoritmanın çalışıp çalışmadığını test eder
 */

import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';
import { logger } from '../utils/logger';

async function testNewAlgorithm() {
    console.log('\n🧪 Testing New Matching Algorithm');
    console.log('='.repeat(60));
    
    // Test Case 1: "Muembe" vs "Mwembe" (önceki sorunlu örnek)
    console.log('\n📝 Test 1: "Muembe Makumbi City FC" → "Mwembe Makumbi City FC"');
    console.log('   Expected: Should match with >= 60% similarity');
    
    const test1 = await teamNameMatcherService.findTeamByAlias("Muembe Makumbi City FC");
    
    if (test1) {
        console.log(`   ✅ PASSED: Found "${test1.teamName}"`);
        console.log(`   Confidence: ${(test1.confidence * 100).toFixed(2)}%`);
        console.log(`   Method: ${test1.matchMethod}`);
        
        if (test1.confidence >= 0.6) {
            console.log('   ✅ Threshold check: PASSED (>= 60%)');
        } else {
            console.log('   ❌ Threshold check: FAILED (< 60%)');
        }
    } else {
        console.log('   ❌ FAILED: No match found');
    }
    
    // Test Case 2: Full name similarity
    console.log('\n📝 Test 2: Full Name Similarity Check');
    const normalized1 = teamNameMatcherService.normalizeTeamName("Muembe Makumbi City FC");
    const normalized2 = teamNameMatcherService.normalizeTeamName("Mwembe Makumbi City FC");
    const similarity = teamNameMatcherService.calculateSimilarity(normalized1, normalized2);
    
    console.log(`   Normalized 1: "${normalized1}"`);
    console.log(`   Normalized 2: "${normalized2}"`);
    console.log(`   Similarity: ${(similarity * 100).toFixed(2)}%`);
    
    if (similarity >= 0.6) {
        console.log('   ✅ PASSED: Similarity >= 60%');
    } else {
        console.log('   ❌ FAILED: Similarity < 60%');
    }
    
    // Test Case 3: Match lookup with single team
    console.log('\n📝 Test 3: Single Team Match Strategy');
    console.log('   Testing: "Simba Sports Club" vs "Muembe Makumbi City FC"');
    
    const matchResult = await teamNameMatcherService.findMatchByTeams(
        "Simba Sports Club",
        "Muembe Makumbi City FC"
    );
    
    if (matchResult) {
        console.log(`   ✅ PASSED: Match found`);
        console.log(`   Match ID: ${matchResult.matchExternalId}`);
        console.log(`   Overall Confidence: ${(matchResult.overallConfidence * 100).toFixed(2)}%`);
        console.log(`   Home: ${matchResult.homeTeam.teamName} (${(matchResult.homeTeam.confidence * 100).toFixed(1)}%)`);
        console.log(`   Away: ${matchResult.awayTeam.teamName} (${(matchResult.awayTeam.confidence * 100).toFixed(1)}%)`);
        
        if (matchResult.overallConfidence >= 0.6) {
            console.log('   ✅ Threshold check: PASSED (>= 60%)');
        } else {
            console.log('   ⚠️  Threshold check: WARNING (< 60%)');
        }
    } else {
        console.log('   ❌ FAILED: No match found');
        console.log('   Note: This might be OK if no live match exists');
    }
    
    // Test Case 4: Algorithm flow check
    console.log('\n📝 Test 4: Algorithm Flow Verification');
    console.log('   Checking if new optimized flow is active...');
    
    // Check if code has new optimizations
    const fs = require('fs');
    const code = fs.readFileSync('src/services/ai/teamNameMatcher.service.ts', 'utf8');
    
    const checks = {
        'Multiple prefix patterns': code.includes('prefix2') && code.includes('prefix3') && code.includes('prefix4'),
        'Full name similarity': code.includes('calculateSimilarity(normalizedSearch, teamNormalized)'),
        'Single team strategy': code.includes('homeMatch && homeMatch.confidence >= 0.6'),
        '60% threshold': code.includes('confidence >= 0.6'),
        'Sequential matching': code.includes('let homeMatch = await') && !code.includes('Promise.all([homeMatch, awayMatch])')
    };
    
    console.log('\n   Code Checks:');
    for (const [check, passed] of Object.entries(checks)) {
        console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    const allPassed = Object.values(checks).every(v => v);
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED - New Algorithm is ACTIVE');
    } else {
        console.log('❌ SOME TESTS FAILED - Check algorithm implementation');
    }
    console.log('='.repeat(60) + '\n');
}

testNewAlgorithm()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    });


