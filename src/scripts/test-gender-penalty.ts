/**
 * Test Gender Penalty
 * 
 * findTeamByAlias fonksiyonunun penalty uygulayıp uygulamadığını test et
 */

import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function testGenderPenalty() {
    console.log('\n🧪 Testing Gender Penalty');
    console.log('='.repeat(60));
    
    const searchName = "Al Ittihad Jeddah"; // Erkek takımı (gender belirtilmemiş)
    
    console.log(`\nSearch: "${searchName}"`);
    console.log(`Type: Erkek takımı (gender belirtilmemiş)`);
    console.log();
    
    const result = await teamNameMatcherService.findTeamByAlias(searchName);
    
    if (result) {
        console.log(`✅ Match found: ${result.teamName}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(2)}%`);
        console.log(`   Method: ${result.matchMethod}`);
        console.log(`   Team ID: ${result.teamId}`);
        
        const isWomen = /\(w\)|women/i.test(result.teamName);
        console.log(`   Type: ${isWomen ? '⚠️  KADIN TAKIMI' : '✅ Erkek takımı'}`);
        
        if (isWomen) {
            console.log('\n   ❌ SORUN: Kadın takımı seçildi ama tahmin erkek takımı için!');
            console.log('   → Penalty uygulanmamış veya yeterli değil!');
        } else {
            console.log('\n   ✅ DOĞRU: Erkek takımı seçildi');
            console.log('   → Penalty çalışıyor!');
        }
    } else {
        console.log('❌ No match found');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

testGenderPenalty()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


