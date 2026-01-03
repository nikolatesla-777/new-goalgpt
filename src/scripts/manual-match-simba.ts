/**
 * Manual Match Link for Simba Prediction
 * 
 * Maç bittiği için otomatik eşleştirme çalışmıyor
 * Manuel olarak eşleştirmeyi yapıyoruz
 */

import { pool } from '../database/connection';

async function manualMatch() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Prediction ID
        const predictionId = '9eceb4a8-1541-44e4-8cd1-5cbc8141e9e3';
        const matchExternalId = 'k82rekhg0w8nrep';
        
        // Match UUID'yi bul
        const matchQuery = await client.query(`
            SELECT id, home_team_id, away_team_id
            FROM ts_matches
            WHERE external_id = $1
        `, [matchExternalId]);
        
        if (matchQuery.rows.length === 0) {
            throw new Error('Match not found');
        }
        
        const match = matchQuery.rows[0];
        
        // Eşleştirmeyi kaydet
        const insertResult = await client.query(`
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
            ) VALUES ($1, $2, $3, $4, $5, 1.0, 1.0, 1.0, 'matched', NOW())
            ON CONFLICT DO NOTHING
            RETURNING id
        `, [
            predictionId,
            matchExternalId,
            match.id,
            match.home_team_id,
            match.away_team_id
        ]);
        
        if (insertResult.rows.length > 0) {
            // processed = true yap
            await client.query(`
                UPDATE ai_predictions
                SET processed = true, updated_at = NOW()
                WHERE id = $1
            `, [predictionId]);
            
            await client.query('COMMIT');
            
            console.log('✅ Manual match link created successfully!');
            console.log(`   Prediction ${predictionId} → Match ${matchExternalId}`);
        } else {
            await client.query('ROLLBACK');
            console.log('ℹ️  Match link already exists');
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

manualMatch()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

