/**
 * Update Manual Prediction League Name
 * 
 * Bu script manuel tahminin lig bilgisini eşleştirilmiş maçın competition_name'inden alıp günceller
 */

import { pool } from './src/database/connection';
import { logger } from './src/utils/logger';

async function updateManualPredictionLeague() {
    const client = await pool.connect();
    try {
        // 1. Manuel tahmini bul (Macarthur FC - Auckland FC)
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
              AND p.home_team_name ILIKE '%Macarthur%'
              AND p.away_team_name ILIKE '%Auckland%'
            ORDER BY p.created_at DESC
            LIMIT 1
        `;

        const predictionResult = await client.query(predictionQuery);
        
        if (predictionResult.rows.length === 0) {
            logger.warn('Manuel tahmin bulunamadı!');
            return;
        }

        const prediction = predictionResult.rows[0];
        logger.info(`Manuel tahmin bulundu: ${prediction.id}`);
        logger.info(`  - Home: ${prediction.home_team_name}`);
        logger.info(`  - Away: ${prediction.away_team_name}`);
        logger.info(`  - Mevcut LIG: ${prediction.league_name || '(boş)'}`);
        logger.info(`  - Match ID: ${prediction.match_external_id || '(eşleşmemiş)'}`);
        logger.info(`  - Prediction Result: ${prediction.prediction_result || 'pending'}`);

        // 2. Eğer maç eşleşmişse, competition_name'i al
        if (prediction.match_external_id) {
            const matchQuery = `
                SELECT 
                    m.external_id,
                    ht.name as home_team_name,
                    at.name as away_team_name,
                    c.name as competition_name,
                    m.status_id,
                    m.home_score_display,
                    m.away_score_display,
                    m.minute,
                    m.match_time
                FROM ts_matches m
                LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
                LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
                LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
                WHERE m.external_id = $1
            `;

            const matchResult = await client.query(matchQuery, [prediction.match_external_id]);
            
            if (matchResult.rows.length > 0) {
                const match = matchResult.rows[0];
                logger.info(`\nMaç bulundu: ${match.external_id}`);
                logger.info(`  - Competition: ${match.competition_name}`);
                logger.info(`  - Status: ${match.status_id}`);
                logger.info(`  - Skor: ${match.home_score_display}-${match.away_score_display}`);
                logger.info(`  - Dakika: ${match.minute || 'N/A'}`);

                // 3. Eğer league_name boşsa veya farklıysa, güncelle
                if (!prediction.league_name || prediction.league_name === '-' || prediction.league_name !== match.competition_name) {
                    await client.query(`
                        UPDATE ai_predictions
                        SET league_name = $1,
                            updated_at = NOW()
                        WHERE id = $2
                    `, [match.competition_name, prediction.id]);

                    logger.info(`\n✅ LIG BİLGİSİ GÜNCELLENDİ:`);
                    logger.info(`  - Eski: ${prediction.league_name || '(boş)'}`);
                    logger.info(`  - Yeni: ${match.competition_name}`);

                    // 4. Settlement kontrolü
                    logger.info(`\n📊 SONUÇLANDIRMA DURUMU:`);
                    logger.info(`  - Prediction Result: ${prediction.prediction_result || 'pending'}`);
                    logger.info(`  - Match Status: ${match.status_id}`);
                    logger.info(`  - Current Score: ${match.home_score_display}-${match.away_score_display}`);
                    
                    if (prediction.prediction_result === 'pending') {
                        logger.info(`  ✅ Tahmin pending durumda - Gol geldiğinde otomatik sonuçlandırılacak`);
                        logger.info(`  ✅ Devre arası (Status 3) geçildiğinde otomatik sonuçlandırılacak`);
                        logger.info(`  ✅ Maç bittiğinde (Status 8) otomatik sonuçlandırılacak`);
                    } else {
                        logger.info(`  ⚠️ Tahmin zaten sonuçlandırılmış: ${prediction.prediction_result}`);
                    }
                } else {
                    logger.info(`\n✅ LIG BİLGİSİ ZATEN DOĞRU: ${prediction.league_name}`);
                }
            } else {
                logger.warn(`\n⚠️ Maç bulunamadı: ${prediction.match_external_id}`);
            }
        } else {
            logger.warn(`\n⚠️ Tahmin henüz maçla eşleşmemiş!`);
        }

    } catch (error: any) {
        logger.error('Hata:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

updateManualPredictionLeague();

