/**
 * Migration: Add prediction_type and prediction_value columns
 *
 * Bu kolonlar INSERT anında hesaplanıp kaydedilir.
 * Avantajlar:
 * - Tarihsel kayıt korunur
 * - Admin tarafından düzeltilebilir
 * - Debug/audit kolaylaşır
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

// Helper functions (aynı aiPrediction.service.ts'deki gibi)
function calculatePeriod(minute: number): string {
    return minute <= 45 ? 'IY' : 'MS';
}

function calculatePredictionValue(score: string): string {
    const [home, away] = score.split('-').map(s => parseInt(s.trim()) || 0);
    const totalGoals = home + away;
    return `${totalGoals + 0.5} ÜST`;
}

function generatePredictionText(minute: number, score: string): string {
    const period = calculatePeriod(minute);
    const value = calculatePredictionValue(score);
    return `${period} ${value}`;
}

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('=== PREDICTION KOLONLARI EKLENİYOR ===\n');

        // 1. Mevcut veri sayısını kontrol et
        const beforeCount = await client.query('SELECT COUNT(*) as total FROM ai_predictions');
        console.log('Mevcut tahmin sayısı:', beforeCount.rows[0].total);

        await client.query('BEGIN');

        // 2. Kolonları ekle
        console.log('\n[1/3] Kolonlar ekleniyor...');
        await client.query(`
            ALTER TABLE ai_predictions
            ADD COLUMN IF NOT EXISTS prediction_type VARCHAR(10),
            ADD COLUMN IF NOT EXISTS prediction_value VARCHAR(100)
        `);
        console.log('✓ prediction_type ve prediction_value kolonları eklendi');

        // 3. Mevcut verileri güncelle
        console.log('\n[2/3] Mevcut veriler güncelleniyor...');
        const predictions = await client.query(`
            SELECT id, minute_at_prediction, score_at_prediction
            FROM ai_predictions
            WHERE prediction_type IS NULL OR prediction_value IS NULL
        `);

        let updatedCount = 0;
        for (const row of predictions.rows) {
            const minute = row.minute_at_prediction || 0;
            const score = row.score_at_prediction || '0-0';

            const predictionType = calculatePeriod(minute);
            const predictionValue = generatePredictionText(minute, score);

            await client.query(`
                UPDATE ai_predictions
                SET prediction_type = $1, prediction_value = $2
                WHERE id = $3
            `, [predictionType, predictionValue, row.id]);

            updatedCount++;
        }
        console.log(`✓ ${updatedCount} tahmin güncellendi`);

        // 4. Index ekle
        console.log('\n[3/3] Index ekleniyor...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_predictions_type ON ai_predictions(prediction_type)
        `);
        console.log('✓ Index oluşturuldu');

        await client.query('COMMIT');

        // 5. Sonuç özeti
        console.log('\n=== MIGRATION TAMAMLANDI ===\n');

        // Örnek verileri göster
        const sample = await client.query(`
            SELECT
                canonical_bot_name,
                minute_at_prediction,
                score_at_prediction,
                prediction_type,
                prediction_value
            FROM ai_predictions
            ORDER BY created_at DESC
            LIMIT 5
        `);

        console.log('ÖRNEK VERİLER:');
        console.log('-'.repeat(80));
        console.log('Bot'.padEnd(15) + 'Dakika'.padEnd(8) + 'Skor'.padEnd(8) + 'Type'.padEnd(6) + 'Value');
        console.log('-'.repeat(80));
        for (const row of sample.rows) {
            console.log(
                (row.canonical_bot_name || '?').substring(0, 14).padEnd(15) +
                String(row.minute_at_prediction || 0).padEnd(8) +
                (row.score_at_prediction || '0-0').padEnd(8) +
                (row.prediction_type || '?').padEnd(6) +
                (row.prediction_value || '?')
            );
        }

        console.log('\n✅ Migration başarılı!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Migration başarısız:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(console.error);
