"use strict";
/**
 * Migration: Minimal AI Predictions Schema
 *
 * ÖNCE: 30 kolon (çoğu gereksiz)
 * SONRA: 14 kolon (minimal, sade)
 *
 * Silinen kolonlar ve nedenleri:
 * - bot_group_id: canonical_bot_name yeterli
 * - bot_name: canonical_bot_name ile duplicate
 * - league_name: competition_id'den JOIN ile alınır
 * - prediction_type: dakikadan türetilir (minute <= 45 ? 'IY' : 'MS')
 * - prediction_value: skordan türetilir (totalGoals + 0.5)
 * - display_prediction: anlık üretilir
 * - raw_payload: debug için, production'da gereksiz
 * - processed: result != 'pending' ile aynı mantık
 * - match_uuid: match_id yeterli
 * - match_time: ts_matches'dan JOIN ile alınır
 * - match_status: ts_matches'dan JOIN ile alınır
 * - final_score: ts_matches'dan JOIN ile alınır
 * - home_team_id: ts_matches'dan JOIN ile alınır
 * - away_team_id: ts_matches'dan JOIN ile alınır
 * - home_team_logo: ts_teams'dan JOIN ile alınır
 * - away_team_logo: ts_teams'dan JOIN ile alınır
 * - confidence: nice-to-have ama kritik değil
 * - updated_at: kullanılmıyor
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const connection_1 = require("../connection");
async function migrate() {
    const client = await connection_1.pool.connect();
    try {
        console.log('=== MİNİMAL AI PREDICTIONS ŞEMASI ===\n');
        // 1. Mevcut veri sayısını kontrol et
        const beforeCount = await client.query('SELECT COUNT(*) as total FROM ai_predictions');
        console.log('Mevcut tahmin sayısı:', beforeCount.rows[0].total);
        await client.query('BEGIN');
        // 2. Yeni minimal tablo oluştur
        console.log('\n[1/5] Yeni minimal tablo oluşturuluyor...');
        await client.query(`
            CREATE TABLE ai_predictions_minimal (
                -- Kimlik
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                external_id VARCHAR(100),

                -- Bot
                canonical_bot_name VARCHAR(100) NOT NULL,

                -- Maç Bilgisi (Parse'dan gelen)
                home_team_name VARCHAR(255) NOT NULL,
                away_team_name VARCHAR(255) NOT NULL,
                score_at_prediction VARCHAR(20) NOT NULL DEFAULT '0-0',
                minute_at_prediction INTEGER NOT NULL DEFAULT 0,

                -- Eşleştirme (TheSports)
                match_id VARCHAR(100),
                competition_id VARCHAR(255),
                country_id VARCHAR(255),

                -- Durum
                result VARCHAR(20) NOT NULL DEFAULT 'pending',
                access_type VARCHAR(10) NOT NULL DEFAULT 'FREE',

                -- Zaman
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                resulted_at TIMESTAMP,

                -- Constraints
                CONSTRAINT chk_result CHECK (result IN ('pending', 'won', 'lost', 'cancelled')),
                CONSTRAINT chk_access CHECK (access_type IN ('VIP', 'FREE'))
            )
        `);
        console.log('✓ ai_predictions_minimal tablosu oluşturuldu');
        // 3. Mevcut veriyi migrate et
        console.log('\n[2/5] Veriler migrate ediliyor...');
        const migrateResult = await client.query(`
            INSERT INTO ai_predictions_minimal (
                id, external_id, canonical_bot_name,
                home_team_name, away_team_name,
                score_at_prediction, minute_at_prediction,
                match_id, competition_id, country_id,
                result, access_type, created_at, resulted_at
            )
            SELECT
                id,
                external_id,
                COALESCE(canonical_bot_name, bot_name, 'Unknown') as canonical_bot_name,
                COALESCE(home_team_name, 'Unknown Home') as home_team_name,
                COALESCE(away_team_name, 'Unknown Away') as away_team_name,
                COALESCE(score_at_prediction, '0-0') as score_at_prediction,
                COALESCE(minute_at_prediction, 0) as minute_at_prediction,
                match_id,
                competition_id,
                country_id,
                COALESCE(result, 'pending') as result,
                COALESCE(access_type, 'FREE') as access_type,
                COALESCE(created_at, NOW()) as created_at,
                resulted_at
            FROM ai_predictions
        `);
        console.log('✓ Migrate edilen satır sayısı:', migrateResult.rowCount);
        // 4. Doğrulama
        const afterCount = await client.query('SELECT COUNT(*) as total FROM ai_predictions_minimal');
        console.log('✓ Yeni tablodaki tahmin sayısı:', afterCount.rows[0].total);
        if (beforeCount.rows[0].total !== afterCount.rows[0].total) {
            throw new Error('Veri kaybı tespit edildi! Migration iptal ediliyor.');
        }
        // 5. Index'leri oluştur
        console.log('\n[3/5] Index\'ler oluşturuluyor...');
        await client.query(`
            CREATE INDEX idx_predictions_minimal_bot ON ai_predictions_minimal(canonical_bot_name);
            CREATE INDEX idx_predictions_minimal_match ON ai_predictions_minimal(match_id);
            CREATE INDEX idx_predictions_minimal_result ON ai_predictions_minimal(result);
            CREATE INDEX idx_predictions_minimal_created ON ai_predictions_minimal(created_at DESC);
            CREATE INDEX idx_predictions_minimal_country ON ai_predictions_minimal(country_id);
            CREATE INDEX idx_predictions_minimal_competition ON ai_predictions_minimal(competition_id);
        `);
        console.log('✓ 6 index oluşturuldu');
        // 6. Eski tabloyu yeniden adlandır, yeni tabloyu aktif et
        console.log('\n[4/5] Tablo swap işlemi...');
        await client.query(`
            ALTER TABLE ai_predictions RENAME TO ai_predictions_old;
            ALTER TABLE ai_predictions_minimal RENAME TO ai_predictions;
        `);
        console.log('✓ ai_predictions_old (eski) → ai_predictions (yeni)');
        // 7. ai_prediction_matches tablosunu kontrol et ve güncelle
        console.log('\n[5/5] İlişkili tablo kontrol ediliyor...');
        const fkCheck = await client.query(`
            SELECT COUNT(*) as total FROM ai_prediction_matches
        `);
        console.log('✓ ai_prediction_matches tablosunda', fkCheck.rows[0].total, 'kayıt var');
        await client.query('COMMIT');
        // 8. Sonuç özeti
        console.log('\n=== MİGRATION TAMAMLANDI ===\n');
        // Yeni şemayı göster
        const newSchema = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'ai_predictions'
            ORDER BY ordinal_position
        `);
        console.log('YENİ ŞEMA (14 kolon):');
        console.log('-'.repeat(50));
        for (const col of newSchema.rows) {
            console.log(`  ${col.column_name.padEnd(25)} ${col.data_type}`);
        }
        console.log('\n✅ Migration başarılı!');
        console.log('⚠️  Eski tablo ai_predictions_old olarak saklandı');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Migration başarısız:', error);
        throw error;
    }
    finally {
        client.release();
        await connection_1.pool.end();
    }
}
migrate().catch(console.error);
