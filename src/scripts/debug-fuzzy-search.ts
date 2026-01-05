/**
 * Debug Fuzzy Search
 * 
 * Neden "Muembe Makumbi City FC" için fuzzy search "Mwembe Makumbi City FC" bulamadı?
 */

import { pool } from '../database/connection';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';

async function debugFuzzySearch() {
    const client = await pool.connect();
    
    try {
        const searchName = "Muembe Makumbi City FC";
        const normalizedSearch = teamNameMatcherService.normalizeTeamName(searchName);
        
        console.log('\n🔍 Fuzzy Search Debug');
        console.log('='.repeat(60));
        console.log(`Search Name: "${searchName}"`);
        console.log(`Normalized: "${normalizedSearch}"`);
        console.log('='.repeat(60) + '\n');
        
        // Step 1: Exact match
        console.log('📝 Step 1: Exact Match Query');
        const exactQuery = `
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE LOWER(name) = $1 OR LOWER(short_name) = $1
            LIMIT 1
        `;
        const exactResult = await client.query(exactQuery, [searchName.toLowerCase()]);
        console.log(`   Result: ${exactResult.rows.length} match(es)`);
        if (exactResult.rows.length > 0) {
            console.log(`   Found: ${exactResult.rows[0].name}`);
        }
        console.log();
        
        // Step 2: Normalized match
        console.log('📝 Step 2: Normalized Match Query');
        const normalizedQuery = `
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s]', '', 'g')) ILIKE $1
            LIMIT 1
        `;
        const normalizedResult = await client.query(normalizedQuery, [`%${normalizedSearch}%`]);
        console.log(`   Query: ILIKE '%${normalizedSearch}%'`);
        console.log(`   Result: ${normalizedResult.rows.length} match(es)`);
        if (normalizedResult.rows.length > 0) {
            console.log(`   Found: ${normalizedResult.rows[0].name}`);
        }
        console.log();
        
        // Step 3: Fuzzy search - THE PROBLEM!
        console.log('📝 Step 3: Fuzzy Search Query (THE PROBLEM)');
        const fuzzyQuery = `
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE name ILIKE $1 OR short_name ILIKE $1
            ORDER BY 
              CASE WHEN LOWER(name) LIKE $2 THEN 0 ELSE 1 END,
              LENGTH(name)
            LIMIT 20
        `;
        
        // This is the issue!
        const first4Chars = searchName.substring(0, 4); // "Muem"
        const fuzzyPattern1 = `%${first4Chars}%`; // "%Muem%"
        const fuzzyPattern2 = `%${normalizedSearch}%`; // "%muembe makumbi city%"
        
        console.log(`   Pattern 1: name ILIKE '%${first4Chars}%'`);
        console.log(`   Pattern 2: name LIKE '%${normalizedSearch}%'`);
        console.log(`   ⚠️  PROBLEM: Looking for "%Muem%" but database has "Mwembe"`);
        console.log(`   ⚠️  "Mwembe" does NOT match "%Muem%" pattern!`);
        console.log();
        
        const fuzzyResult = await client.query(fuzzyQuery, [fuzzyPattern1, fuzzyPattern2]);
        console.log(`   Result: ${fuzzyResult.rows.length} candidate(s)`);
        
        if (fuzzyResult.rows.length > 0) {
            console.log('   Candidates found:');
            fuzzyResult.rows.forEach((row: any, index: number) => {
                console.log(`   ${index + 1}. ${row.name} (${row.external_id})`);
            });
        } else {
            console.log('   ❌ NO CANDIDATES FOUND!');
            console.log('   This is why similarity was never calculated!');
        }
        console.log();
        
        // Step 4: Check if "Mwembe" exists
        console.log('📝 Step 4: Direct Check for "Mwembe"');
        const mwembeQuery = `
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE name ILIKE '%Mwembe%' OR name ILIKE '%Muembe%'
        `;
        const mwembeResult = await client.query(mwembeQuery);
        console.log(`   Result: ${mwembeResult.rows.length} match(es)`);
        if (mwembeResult.rows.length > 0) {
            mwembeResult.rows.forEach((row: any) => {
                console.log(`   - ${row.name} (${row.external_id})`);
            });
        }
        console.log();
        
        // Step 5: Why it failed
        console.log('❌ ROOT CAUSE ANALYSIS:');
        console.log('   1. Fuzzy search uses first 4 characters: "Muem"');
        console.log('   2. Database has: "Mwembe" (starts with "Mwem")');
        console.log('   3. Pattern "%Muem%" does NOT match "Mwembe"');
        console.log('   4. No candidates found → No similarity calculation');
        console.log('   5. Function returns null');
        console.log();
        
        // Step 6: What if we search with "Mwem"?
        console.log('💡 What if we search with "Mwem"?');
        const mwemQuery = `
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE name ILIKE '%Mwem%'
            LIMIT 5
        `;
        const mwemResult = await client.query(mwemQuery);
        console.log(`   Pattern: '%Mwem%'`);
        console.log(`   Result: ${mwemResult.rows.length} match(es)`);
        if (mwemResult.rows.length > 0) {
            mwemResult.rows.forEach((row: any) => {
                console.log(`   - ${row.name}`);
            });
        }
        console.log();
        
        // Step 7: Solution
        console.log('✅ SOLUTION:');
        console.log('   1. Alias table (already applied)');
        console.log('   2. OR: Improve fuzzy search to try multiple prefixes');
        console.log('   3. OR: Use n-gram matching (2-3 character combinations)');
        console.log('   4. OR: Lower the first-characters requirement');
        console.log();
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

debugFuzzySearch()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });


