/**
 * InPlay Guru Sync Service
 *
 * GoalGPT'de bir tahmin oluşturulduğunda veya sonuçlandığında
 * otomatik olarak inplayguru_picks tablosuna yazar/günceller.
 *
 * Kullanım:
 *   import { inplayguruSync } from './inplayguru/inplayguruSync.service';
 *   await inplayguruSync.upsert(prediction);   // yeni tahmin
 *   await inplayguruSync.settle(id, result, finalScore, htScore); // sonuç
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

const IPG_URL   = 'https://couiurnqukhjyzwccnuk.supabase.co';
const IPG_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvdWl1cm5xdWtoanl6d2NjbnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzAyNjgsImV4cCI6MjA3OTg0NjI2OH0.oO0ns3jZ2lEwYmOIYeMH0syiMEy0b8g7FhDtHAwxx-M';
const IPG_TABLE = 'inplayguru_picks';

const ipg = createClient(IPG_URL, IPG_KEY);

// ── Dönüşüm ──────────────────────────────────────────────────────────────────

function translatePredict(prediction: string): string {
  return prediction
    .replace(/^MS\b/, 'FT')
    .replace(/^IY\b/, 'HT')
    .replace(/ÜST$/, 'OVER')
    .replace(/ALT$/, 'UNDER')
    .trim();
}

function translateResult(result: string): string {
  if (result === 'won')  return 'hit';
  if (result === 'lost') return 'miss';
  return 'pending';
}

function botToStrategyId(botName: string): number {
  const m = botName.match(/(\d+)/);
  if (m) return 900000 + parseInt(m[1], 10);
  let hash = 0;
  for (const ch of botName) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return 900500 + (hash % 400);
}

// ── Servis ───────────────────────────────────────────────────────────────────

export interface NewPrediction {
  id: string;                      // ai_predictions.id (UUID)
  canonical_bot_name: string;
  home_team_name: string;
  away_team_name: string;
  league_name?: string | null;
  score_at_prediction: string;
  minute_at_prediction: number;
  prediction: string;              // "MS 2.5 ÜST"
  created_at: Date | string;
}

class InPlayGuruSyncService {
  /** Yeni tahmin oluşturulduğunda çağır */
  async upsert(pred: NewPrediction): Promise<void> {
    try {
      const row = {
        goalgpt_id:    pred.id,
        strategy_id:   botToStrategyId(pred.canonical_bot_name),
        strategy_name: pred.canonical_bot_name,
        home_team:     pred.home_team_name,
        away_team:     pred.away_team_name,
        league:        pred.league_name || '',
        picked_at:     typeof pred.created_at === 'string' ? pred.created_at : pred.created_at.toISOString(),
        timer:         String(pred.minute_at_prediction || ''),
        score_pick:    pred.score_at_prediction || '',
        predict:       translatePredict(pred.prediction),
        strike_result: 'pending',
        synced_at:     new Date().toISOString(),
      };

      const { error } = await ipg
        .from(IPG_TABLE)
        .upsert(row, { onConflict: 'goalgpt_id' });

      if (error) {
        logger.warn(`[InPlayGuruSync] upsert failed for ${pred.id}: ${error.message}`);
      } else {
        logger.debug(`[InPlayGuruSync] upserted ${pred.canonical_bot_name} pick ${pred.id}`);
      }
    } catch (e: any) {
      logger.warn(`[InPlayGuruSync] unexpected error: ${e.message}`);
    }
  }

  /** Tahmin sonuçlandığında çağır (settlement sonrası) */
  async settle(
    goalgptId: string,
    result: 'won' | 'lost',
    finalScore?: string | null,
    htScore?: string | null,
  ): Promise<void> {
    try {
      const { error } = await ipg
        .from(IPG_TABLE)
        .update({
          strike_result: translateResult(result),
          score_ft:      finalScore || undefined,
          score_ht:      htScore   || undefined,
          synced_at:     new Date().toISOString(),
        })
        .eq('goalgpt_id', goalgptId);

      if (error) {
        logger.warn(`[InPlayGuruSync] settle failed for ${goalgptId}: ${error.message}`);
      } else {
        logger.debug(`[InPlayGuruSync] settled ${goalgptId} → ${result}`);
      }
    } catch (e: any) {
      logger.warn(`[InPlayGuruSync] settle unexpected error: ${e.message}`);
    }
  }
}

export const inplayguruSync = new InPlayGuruSyncService();
