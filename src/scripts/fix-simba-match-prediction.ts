/**
 * Fix Simba Sports Club - Mwembe Makumbi City FC Match Prediction
 * 
 * Maç veritabanında var ama tahmin eşleşmemiş
 * Sorun: "Muembe" vs "Mwembe" isim farkı
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { teamNameMatcherService } from '../services/ai/teamNameMatcher.service';
import { aiPredictionService } from '../services/ai/aiPrediction.service';

async function fixSimbaMatch() {
    const client = await pool.connect();
    
    try {
        console.log('\n🔍 Step 1: Finding the match in database...\n');
        
        // 1. Maçı bul
        const matchQuery = `
            SELECT 
                m.external_id,
                m.id as match_uuid,
                m.status_id,
                m.match_time,
                ht.name as home_team_name,
                ht.external_id as home_team_id,
                at.name as away_team_name,
                at.external_id as away_team_id,
                m.home_score_display,
                m.away_score_display,
                c.name as competition_name
            FROM ts_matches m
            JOIN ts_teams ht ON m.home_team_id = ht.external_id
            JOIN ts_teams at ON m.away_team_id = at.external_id
            LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
            WHERE ht.name ILIKE '%Simba Sports Club%'
              AND at.name ILIKE '%Mwembe%'
            ORDER BY m.match_time DESC
            LIMIT 5
        `;
        
        const matchResult = await client.query(matchQuery);
        
        if (matchResult.rows.length === 0) {
            console.log('❌ Match not found in database');
            return;
        }
        
        const match = matchResult.rows[0];
        console.log('✅ Match found:');
        console.log(`   Match ID: ${match.external_id}`);
        console.log(`   Home: ${match.home_team_name} (${match.home_team_id})`);
        console.log(`   Away: ${match.away_team_name} (${match.away_team_id})`);
        console.log(`   Score: ${match.home_score_display}-${match.away_score_display}`);
        console.log(`   Competition: ${match.competition_name}`);
        console.log(`   Status: ${match.status_id}`);
        
        // 2. Eşleşmemiş tahmini bul
        console.log('\n🔍 Step 2: Finding unmatched prediction...\n');
        
        const predQuery = `
            SELECT * FROM ai_predictions
            WHERE home_team_name ILIKE '%Simba Sports Club%'
              AND away_team_name ILIKE '%Muembe%'
              AND processed = false
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const predResult = await client.query(predQuery);
        
        if (predResult.rows.length === 0) {
            console.log('❌ Unmatched prediction not found');
            return;
        }
        
        const prediction = predResult.rows[0];
        console.log('✅ Prediction found:');
        console.log(`   Prediction ID: ${prediction.id}`);
        console.log(`   Home: ${prediction.home_team_name}`);
        console.log(`   Away: ${prediction.away_team_name}`);
        console.log(`   League: ${prediction.league_name}`);
        console.log(`   Created: ${prediction.created_at}`);
        
        // 3. Takım isimlerini kontrol et
        console.log('\n🔍 Step 3: Team name analysis...\n');
        console.log(`   Prediction says: "${prediction.away_team_name}"`);
        console.log(`   Match has: "${match.away_team_name}"`);
        console.log(`   Difference: "Muembe" vs "Mwembe"`);
        
        // 4. Alias ekle
        console.log('\n🔍 Step 4: Adding alias to fix matching...\n');
        
        // Önce alias var mı kontrol et
        const aliasCheck = await client.query(`
            SELECT * FROM ts_team_aliases
            WHERE LOWER(alias) = LOWER($1)
        `, [prediction.away_team_name]);
        
        if (aliasCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO ts_team_aliases (team_external_id, alias)
                VALUES ($1, $2)
                ON CONFLICT (alias) DO NOTHING
            `, [match.away_team_id, prediction.away_team_name]);
            
            console.log(`✅ Added alias: "${prediction.away_team_name}" → ${match.away_team_name}`);
        } else {
            console.log(`ℹ️  Alias already exists`);
        }
        
        // 5. Eşleştirmeyi tekrar dene
        console.log('\n🔍 Step 5: Retrying match lookup...\n');
        
        const matchLookup = await teamNameMatcherService.findMatchByTeams(
            prediction.home_team_name,
            prediction.away_team_name,
            prediction.minute_at_prediction,
            prediction.score_at_prediction
        );
        
        if (matchLookup) {
            console.log('✅ Match lookup successful!');
            console.log(`   Match ID: ${matchLookup.matchExternalId}`);
            console.log(`   Confidence: ${(matchLookup.overallConfidence * 100).toFixed(1)}%`);
            
            // 6. Eşleştirmeyi kaydet
            console.log('\n🔍 Step 6: Saving match link...\n');
            
            await client.query('BEGIN');
            
            try {
                // ai_prediction_matches tablosuna ekle
                const insertMatch = await client.query(`
                    INSERT INTO ai_prediction_matches (
                        prediction_id,
                        match_external_id,
                        match_uuid,
                        home_team_id,
                        away_team_id,
                        home_team_confidence,
                        away_team_confidence,
                        overall_confidence,
                        match_status,
                        matched_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'matched', NOW())
                    ON CONFLICT DO NOTHING
                    RETURNING id
                `, [
                    prediction.id,
                    matchLookup.matchExternalId,
                    matchLookup.matchUuid,
                    matchLookup.homeTeam.teamId,
                    matchLookup.awayTeam.teamId,
                    matchLookup.homeTeam.confidence,
                    matchLookup.awayTeam.confidence,
                    matchLookup.overallConfidence
                ]);
                
                if (insertMatch.rows.length > 0) {
                    // processed = true yap
                    await client.query(`
                        UPDATE ai_predictions
                        SET processed = true, updated_at = NOW()
                        WHERE id = $1
                    `, [prediction.id]);
                    
                    await client.query('COMMIT');
                    
                    console.log('✅ Match link saved successfully!');
                    console.log(`   Prediction ${prediction.id} is now matched to ${matchLookup.matchExternalId}`);
                } else {
                    await client.query('ROLLBACK');
                    console.log('ℹ️  Match link already exists');
                }
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            
        } else {
            console.log('❌ Match lookup still failed after alias addition');
            console.log('   May need manual intervention');
        }
        
        console.log('\n✅ Process completed!\n');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// CLI runner
if (require.main === module) {
    fixSimbaMatch()
        .then(() => process.exit(0))
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}

export { fixSimbaMatch };

