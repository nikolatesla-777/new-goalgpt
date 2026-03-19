/**
 * GoalGPT → InPlay Guru Sync Script
 *
 * Kullanım:
 *   npx tsx src/scripts/sync-to-inplayguru.ts          # Tüm geçmişi sync et
 *   npx tsx src/scripts/sync-to-inplayguru.ts --last7  # Son 7 günü sync et
 *   npx tsx src/scripts/sync-to-inplayguru.ts --dry    # Sadece say, yazma
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { pool } from '../database/connection';
import { createClient } from '@supabase/supabase-js';

// ── InPlay Guru Supabase ─────────────────────────────────────────────────────
const IPG_URL = 'https://couiurnqukhjyzwccnuk.supabase.co';
const IPG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvdWl1cm5xdWtoanl6d2NjbnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzAyNjgsImV4cCI6MjA3OTg0NjI2OH0.oO0ns3jZ2lEwYmOIYeMH0syiMEy0b8g7FhDtHAwxx-M';
const IPG_TABLE = 'inplayguru_picks';
const ipg = createClient(IPG_URL, IPG_KEY);

// ── Dönüşüm Yardımcıları ─────────────────────────────────────────────────────

/** "MS 4.5 ÜST" → "FT 4.5 OVER"  |  "IY 0.5 ALT" → "HT 0.5 UNDER" */
function translatePrediction(prediction: string | null): string {
  if (!prediction) return '';
  return prediction
    .replace(/^MS\b/, 'FT')
    .replace(/^IY\b/, 'HT')
    .replace(/ÜST$/, 'OVER')
    .replace(/ALT$/, 'UNDER')
    .trim();
}

/** 'won' → 'hit', 'lost' → 'miss', 'pending'→ 'pending' */
function translateResult(result: string | null): string {
  if (result === 'won') return 'hit';
  if (result === 'lost') return 'miss';
  return 'pending';
}

/**
 * Bot adından sabit bir strategy_id üretir.
 * "BOT 10" → 900010, "BOT 77" → 900077, "Alert System" → 900901
 * GoalGPT kaynaklı ID'ler 900000+ aralığında (mevcut inplayguru ID'leriyle çakışmaz)
 */
function botToStrategyId(botName: string): number {
  const numMatch = botName.match(/(\d+)/);
  if (numMatch) return 900000 + parseInt(numMatch[1], 10);
  // Sabit hash — sayısal olmayan bot adları için
  let hash = 0;
  for (const ch of botName) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return 900500 + (hash % 400);
}

// ── Ana Fonksiyon ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDry = args.includes('--dry');
  const isLast7 = args.includes('--last7');

  console.log('\n📡 GoalGPT → InPlay Guru Sync');
  console.log('─'.repeat(60));
  if (isDry) console.log('⚠️  DRY RUN — veritabanına yazılmayacak');
  if (isLast7) console.log('📅 Sadece son 7 gün');
  console.log('');

  // ── GoalGPT DB'den verileri çek ──────────────────────────────────────────
  const dateFilter = isLast7
    ? "AND ap.created_at >= NOW() - INTERVAL '7 days'"
    : '';

  const { rows } = await pool.query<{
    id: string;
    canonical_bot_name: string;
    home_team_name: string;
    away_team_name: string;
    league_name: string | null;
    score_at_prediction: string;
    minute_at_prediction: number;
    prediction: string;
    result: string;
    final_score: string | null;
    score_ht: string | null;
    created_at: Date;
    resulted_at: Date | null;
  }>(`
    SELECT
      ap.id::text,
      ap.canonical_bot_name,
      ap.home_team_name,
      ap.away_team_name,
      COALESCE(ap.league_name, tc.name_en) AS league_name,
      ap.score_at_prediction,
      ap.minute_at_prediction,
      ap.prediction,
      ap.result,
      ap.final_score,
      NULLIF(
        CONCAT(m.home_score_half, '-', m.away_score_half),
        'null-null'
      ) AS score_ht,
      ap.created_at,
      ap.resulted_at
    FROM ai_predictions ap
    LEFT JOIN ts_matches m ON m.id::text = ap.match_id
    LEFT JOIN ts_competitions tc ON tc.id::text = ap.competition_id
    WHERE ap.result IN ('won', 'lost', 'pending')
      AND ap.prediction IS NOT NULL
      ${dateFilter}
    ORDER BY ap.created_at DESC
  `);

  console.log(`✅ GoalGPT'den ${rows.length} tahmin alındı`);

  if (rows.length === 0) {
    console.log('Sync edilecek veri yok.');
    await pool.end();
    return;
  }

  // ── Dönüştür ─────────────────────────────────────────────────────────────
  const picks = rows.map(row => ({
    // GoalGPT UUID'sini external referans olarak sakla
    goalgpt_id: row.id,
    strategy_id:   botToStrategyId(row.canonical_bot_name),
    strategy_name: row.canonical_bot_name,
    home_team:  row.home_team_name,
    away_team:  row.away_team_name,
    league:     row.league_name || '',
    picked_at:  row.created_at?.toISOString(),
    timer:      String(row.minute_at_prediction || ''),
    score_pick: row.score_at_prediction || '',
    score_ht:   row.score_ht || '',
    score_ft:   row.final_score || '',
    predict:    translatePrediction(row.prediction),
    strike_result: translateResult(row.result),
    synced_at:  new Date().toISOString(),
  }));

  // İstatistikler
  const byBot: Record<string, number> = {};
  for (const p of picks) {
    byBot[p.strategy_name] = (byBot[p.strategy_name] || 0) + 1;
  }
  console.log('\n📊 Bot bazında:');
  Object.entries(byBot)
    .sort((a, b) => b[1] - a[1])
    .forEach(([bot, count]) => console.log(`   ${bot.padEnd(20)} → ${count} pick`));

  const byResult = { hit: 0, miss: 0, pending: 0 };
  for (const p of picks) {
    byResult[p.strike_result as keyof typeof byResult] = (byResult[p.strike_result as keyof typeof byResult] || 0) + 1;
  }
  console.log(`\n   Hit: ${byResult.hit}  Miss: ${byResult.miss}  Pending: ${byResult.pending}`);

  if (isDry) {
    console.log('\n✅ Dry run tamamlandı. --dry olmadan çalıştırınca yazılacak.');
    await pool.end();
    return;
  }

  // ── InPlay Guru Supabase'e yaz (batch 500) ───────────────────────────────
  console.log('\n📤 InPlay Guru Supabase\'e yazılıyor...');
  const BATCH = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < picks.length; i += BATCH) {
    const batch = picks.slice(i, i + BATCH);
    const { error } = await ipg
      .from(IPG_TABLE)
      .upsert(batch, {
        onConflict: 'goalgpt_id',   // Duplicate insert'leri önle
        ignoreDuplicates: false,     // Güncelleme yapsın (result değişebilir)
      });

    if (error) {
      console.error(`   Batch ${i / BATCH + 1} HATA: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`   ${inserted}/${picks.length} yazıldı...\r`);
    }
  }

  console.log(`\n\n✅ Sync tamamlandı: ${inserted} başarılı, ${errors} hata`);
  await pool.end();
}

main().catch(e => {
  console.error('\n❌ Hata:', e.message);
  process.exit(1);
});
