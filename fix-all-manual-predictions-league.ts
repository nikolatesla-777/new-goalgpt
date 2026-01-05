/**
 * Fix All Manual Predictions League Name
 * 
 * Tüm manuel tahminlerin lig bilgisini eşleştirilmiş maçların competition_name'inden alıp günceller
 */

import { pool } from './src/database/connection';
import { logger } from './src/utils/logger';

async function fixAllManualPredictionsLeague() {
    const client = await pool.connect();
    try {
        // 1. Tüm manuel tahminleri bul (league_name boş veya "-" olanlar)
        const predictionQuery = `
            SELECT 
                p.id,
                p.external_id,
                p.bot_name,
                p.league_name,
                p.home_team_name,
                p.away_team_name,
                pm.match_external_id,
                pm.prediction_result
            FROM ai_predictions p
            LEFT JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE p.bot_name = 'Alert System'
              AND (p.league_name IS NULL OR p.league_name = '' OR p.league_name = '-')
              AND pm.match_external_id IS NOT NULL
            ORDER BY p.created_at DESC
        `;

        const predictionResult = await client.query(predictionQuery);
        
        if (predictionResult.rows.length === 0) {
            logger.info('Lig bilgisi eksik manuel tahmin bulunamadı!');
            return;
        }

        logger.info(`Lig bilgisi eksik ${predictionResult.rows.length} manuel tahmin bulundu.`);

        let updated = 0;
        let failed = 0;

        for (const prediction of predictionResult.rows) {
            try {
                // 2. Maçın competition_name'ini al
                const matchQuery = `
                    SELECT 
                        m.external_id,
                        c.name as competition_name
                    FROM ts_matches m
                    LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
                    WHERE m.external_id = $1
                `;

                const matchResult = await client.query(matchQuery, [prediction.match_external_id]);
                
                if (matchResult.rows.length > 0 && matchResult.rows[0].competition_name) {
                    const competitionName = matchResult.rows[0].competition_name;
                    
                    // 3. Güncelle
                    await client.query(`
                        UPDATE ai_predictions
                        SET league_name = $1,
                            updated_at = NOW()
                        WHERE id = $2
                    `, [competitionName, prediction.id]);

                    logger.info(`✅ Güncellendi: ${prediction.home_team_name} vs ${prediction.away_team_name} → ${competitionName}`);
                    updated++;
                } else {
                    logger.warn(`⚠️ Maç bulunamadı veya competition_name yok: ${prediction.match_external_id}`);
                    failed++;
                }
            } catch (error: any) {
                logger.error(`❌ Hata (${prediction.id}): ${error.message}`);
                failed++;
            }
        }

        logger.info(`\n📊 ÖZET:`);
        logger.info(`  - Güncellenen: ${updated}`);
        logger.info(`  - Başarısız: ${failed}`);
        logger.info(`  - Toplam: ${predictionResult.rows.length}`);

    } catch (error: any) {
        logger.error('Hata:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixAllManualPredictionsLeague();

