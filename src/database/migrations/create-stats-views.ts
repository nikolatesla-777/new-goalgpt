/**
 * Migration: Create Materialized Views for Prediction Stats
 *
 * Views:
 * - ai_bot_stats: Bot-level statistics
 * - ai_country_stats: Per-bot country breakdown
 * - ai_competition_stats: Per-bot competition breakdown
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

async function createViews() {
    const client = await pool.connect();

    try {
        console.log('=== MATERIALIZED VIEWS OLUŞTURULUYOR ===\n');

        // 1. Bot Stats View
        console.log('[1/3] ai_bot_stats view oluşturuluyor...');
        await client.query(`DROP MATERIALIZED VIEW IF EXISTS ai_bot_stats CASCADE`);
        await client.query(`
            CREATE MATERIALIZED VIEW ai_bot_stats AS
            SELECT
                canonical_bot_name as bot_name,
                COUNT(*) as total_predictions,
                SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN result = 'lost' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN result = 'pending' THEN 1 ELSE 0 END) as pending,
                CASE
                    WHEN SUM(CASE WHEN result IN ('won', 'lost') THEN 1 ELSE 0 END) > 0
                    THEN ROUND(
                        SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END)::decimal /
                        SUM(CASE WHEN result IN ('won', 'lost') THEN 1 ELSE 0 END) * 100, 1
                    )
                    ELSE 0
                END as win_rate,
                MAX(resulted_at) as last_updated
            FROM ai_predictions
            GROUP BY canonical_bot_name
        `);
        await client.query('CREATE UNIQUE INDEX idx_bot_stats_name ON ai_bot_stats(bot_name)');
        console.log('✓ ai_bot_stats oluşturuldu');

        // 2. Country Stats View
        console.log('[2/3] ai_country_stats view oluşturuluyor...');
        await client.query(`DROP MATERIALIZED VIEW IF EXISTS ai_country_stats CASCADE`);
        await client.query(`
            CREATE MATERIALIZED VIEW ai_country_stats AS
            SELECT
                canonical_bot_name as bot_name,
                p.country_id,
                cnt.name as country_name,
                cnt.logo as country_logo,
                COUNT(*) as total,
                SUM(CASE WHEN p.result = 'won' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN p.result = 'lost' THEN 1 ELSE 0 END) as losses,
                CASE
                    WHEN SUM(CASE WHEN p.result IN ('won', 'lost') THEN 1 ELSE 0 END) > 0
                    THEN ROUND(
                        SUM(CASE WHEN p.result = 'won' THEN 1 ELSE 0 END)::decimal /
                        SUM(CASE WHEN p.result IN ('won', 'lost') THEN 1 ELSE 0 END) * 100, 1
                    )
                    ELSE 0
                END as win_rate
            FROM ai_predictions p
            LEFT JOIN ts_countries cnt ON p.country_id = cnt.external_id
            WHERE p.country_id IS NOT NULL
            GROUP BY canonical_bot_name, p.country_id, cnt.name, cnt.logo
        `);
        await client.query('CREATE UNIQUE INDEX idx_country_stats_bot_country ON ai_country_stats(bot_name, country_id)');
        console.log('✓ ai_country_stats oluşturuldu');

        // 3. Competition Stats View
        console.log('[3/3] ai_competition_stats view oluşturuluyor...');
        await client.query(`DROP MATERIALIZED VIEW IF EXISTS ai_competition_stats CASCADE`);
        await client.query(`
            CREATE MATERIALIZED VIEW ai_competition_stats AS
            SELECT
                canonical_bot_name as bot_name,
                p.competition_id,
                c.name as competition_name,
                c.logo_url as competition_logo,
                COUNT(*) as total,
                SUM(CASE WHEN p.result = 'won' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN p.result = 'lost' THEN 1 ELSE 0 END) as losses,
                CASE
                    WHEN SUM(CASE WHEN p.result IN ('won', 'lost') THEN 1 ELSE 0 END) > 0
                    THEN ROUND(
                        SUM(CASE WHEN p.result = 'won' THEN 1 ELSE 0 END)::decimal /
                        SUM(CASE WHEN p.result IN ('won', 'lost') THEN 1 ELSE 0 END) * 100, 1
                    )
                    ELSE 0
                END as win_rate
            FROM ai_predictions p
            LEFT JOIN ts_competitions c ON p.competition_id = c.id::text
            WHERE p.competition_id IS NOT NULL
            GROUP BY canonical_bot_name, p.competition_id, c.name, c.logo_url
        `);
        await client.query('CREATE UNIQUE INDEX idx_comp_stats_bot_comp ON ai_competition_stats(bot_name, competition_id)');
        console.log('✓ ai_competition_stats oluşturuldu');

        // 4. Refresh fonksiyonu oluştur
        console.log('\n[+] Refresh fonksiyonu oluşturuluyor...');
        await client.query(`
            CREATE OR REPLACE FUNCTION refresh_prediction_stats()
            RETURNS void AS $$
            BEGIN
                REFRESH MATERIALIZED VIEW CONCURRENTLY ai_bot_stats;
                REFRESH MATERIALIZED VIEW CONCURRENTLY ai_country_stats;
                REFRESH MATERIALIZED VIEW CONCURRENTLY ai_competition_stats;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('✓ refresh_prediction_stats() fonksiyonu oluşturuldu');

        // 5. View içeriklerini göster
        console.log('\n=== VIEW İÇERİKLERİ ===\n');

        const botStats = await client.query('SELECT * FROM ai_bot_stats ORDER BY total_predictions DESC');
        console.log('BOT STATS:');
        console.log('Bot'.padEnd(20) + 'Total'.padEnd(8) + 'Win'.padEnd(6) + 'Loss'.padEnd(6) + 'Rate');
        console.log('-'.repeat(50));
        for (const row of botStats.rows) {
            console.log(
                (row.bot_name || '?').padEnd(20) +
                String(row.total_predictions).padEnd(8) +
                String(row.wins).padEnd(6) +
                String(row.losses).padEnd(6) +
                '%' + row.win_rate
            );
        }

        console.log('\nCOUNTRY STATS (Top 5):');
        const countryStats = await client.query('SELECT * FROM ai_country_stats ORDER BY total DESC LIMIT 5');
        for (const row of countryStats.rows) {
            console.log('  ' + (row.bot_name || '?').padEnd(15) + (row.country_name || '?').padEnd(20) + '%' + row.win_rate);
        }

        console.log('\nCOMPETITION STATS (Top 5):');
        const compStats = await client.query('SELECT * FROM ai_competition_stats ORDER BY total DESC LIMIT 5');
        for (const row of compStats.rows) {
            console.log('  ' + (row.bot_name || '?').padEnd(15) + (row.competition_name || '?').substring(0, 25).padEnd(25) + '%' + row.win_rate);
        }

        console.log('\n✅ Tüm Materialized Viewlar oluşturuldu!');

    } catch (error) {
        console.error('❌ View oluşturma hatası:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createViews().catch(console.error);
