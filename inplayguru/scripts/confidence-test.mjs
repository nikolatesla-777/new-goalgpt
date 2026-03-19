/**
 * Confidence Score Test Script
 * Bugünün pick'leri için güven skorlarını hesaplar ve yazdırır.
 *
 * Çalıştır:
 *   node scripts/confidence-test.mjs
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://couiurnqukhjyzwccnuk.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvdWl1cm5xdWtoanl6d2NjbnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzAyNjgsImV4cCI6MjA3OTg0NjI2OH0.oO0ns3jZ2lEwYmOIYeMH0syiMEy0b8g7FhDtHAwxx-M";
const TABLE         = "inplayguru_picks";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────
function isHit(r)  { const s = (r || "").toLowerCase(); return s === "hit"  || s === "win"  || s === "won"; }
function isMiss(r) { const s = (r || "").toLowerCase(); return s === "miss" || s === "loss" || s === "lose" || s === "lost"; }

function parsePredict(predict) {
  const m = (predict || "").trim().toUpperCase().match(/^(HT|FT)\s+([\d.]+)\s+(OVER|UNDER)$/);
  if (!m) return null;
  return { period: m[1], threshold: parseFloat(m[2]), type: m[3] };
}

function parseScore(score) {
  const m = (score || "").match(/^(\d+)[-:\s](\d+)$/);
  if (!m) return null;
  return { home: +m[1], away: +m[2], total: +m[1] + +m[2] };
}

function goalsNeeded(parsed, ps) {
  if (!parsed || !ps) return 2;
  return parsed.type === "OVER"
    ? Math.max(0, Math.ceil(parsed.threshold) - ps.total)
    : Math.max(0, ps.total - Math.floor(parsed.threshold));
}

function hitRate(picks) {
  const d = picks.filter(p => isHit(p.strike_result) || isMiss(p.strike_result));
  if (!d.length) return 0;
  return d.filter(p => isHit(p.strike_result)).length / d.length;
}

function computeConfidence(pick, history) {
  const decided = history.filter(p => isHit(p.strike_result) || isMiss(p.strike_result));
  if (decided.length < 20) return null;

  const parsed      = parsePredict(pick.predict);
  const parsedScore = parseScore(pick.score_pick) ?? { home: 0, away: 0, total: 0 };
  const timer       = parseInt(pick.timer || "0", 10);
  const maxMin      = parsed?.period === "HT" ? 45 : 90;
  const minRem      = Math.max(0, maxMin - timer);
  const gn          = goalsNeeded(parsed, parsedScore);

  const pickPredict = (pick.predict || "").trim().toUpperCase();
  const pickLeague  = (pick.league  || "").toLowerCase().trim();

  // F1: same predict + same goalsNeeded
  const f1 = decided.filter(p => {
    if (!parsed) return false;
    const pp = parsePredict(p.predict);
    if (!pp || pp.period !== parsed.period || pp.threshold !== parsed.threshold || pp.type !== parsed.type) return false;
    const ps = parseScore(p.score_pick) ?? { total: 0 };
    return goalsNeeded(pp, ps) === gn;
  });

  // F2: same predict + timer ±10dk
  const f2 = decided.filter(p => {
    if (!parsed) return false;
    const pp = parsePredict(p.predict);
    if (!pp || pp.period !== parsed.period || pp.threshold !== parsed.threshold || pp.type !== parsed.type) return false;
    return Math.abs(parseInt(p.timer || "0", 10) - timer) <= 10;
  });

  // F3: same predict string
  const f3 = decided.filter(p => (p.predict || "").trim().toUpperCase() === pickPredict);

  // F4: same predict + same league
  const f4 = decided.filter(p =>
    (p.predict || "").trim().toUpperCase() === pickPredict &&
    (p.league  || "").toLowerCase().trim() === pickLeague &&
    pickLeague !== ""
  );

  // F5: same league
  const f5 = decided.filter(p =>
    (p.league || "").toLowerCase().trim() === pickLeague && pickLeague !== ""
  );

  const layers = [
    { label: "Skor Durumu", w: 0.30, min: 8,  picks: f1 },
    { label: "Dakika",      w: 0.20, min: 8,  picks: f2 },
    { label: "Tahmin Tipi", w: 0.15, min: 15, picks: f3 },
    { label: "Lig+Tahmin",  w: 0.25, min: 5,  picks: f4 },
    { label: "Lig Genel",   w: 0.10, min: 8,  picks: f5 },
  ].map(l => ({ ...l, used: l.picks.length >= l.min, rate: l.picks.length >= l.min ? hitRate(l.picks) : 0 }));

  const used = layers.filter(l => l.used);
  let rate = used.length === 0
    ? hitRate(decided)
    : used.reduce((s, l) => s + l.rate * l.w, 0) / used.reduce((s, l) => s + l.w, 0);

  if (gn === 0 && parsed?.type === "OVER") rate = Math.min(Math.max(rate, 0.88), 0.97);
  else if (gn >= 4 && minRem < 20)         rate = Math.max(rate, 0.05);

  const score = Math.round(Math.max(5, Math.min(97, rate * 100)));

  const label = score >= 75 ? "Çok Yüksek" : score >= 60 ? "Yüksek" : score >= 50 ? "Orta" : score >= 35 ? "Düşük" : "Çok Düşük";
  const color = score >= 75 ? "\x1b[32m" : score >= 60 ? "\x1b[92m" : score >= 50 ? "\x1b[33m" : "\x1b[31m";
  const reset = "\x1b[0m";

  return { score, label, color, reset, gn, minRem, sampleSize: decided.length, layers };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchAllPicks(strategyId) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("strategy_id", strategyId)
      .order("picked_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .gte("picked_at", today.toISOString())
    .order("picked_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n\x1b[1m📊 CONFIDENCE SCORE TEST — BUGÜNÜN PİCKLERİ\x1b[0m");
  console.log("─".repeat(100));

  // 1. Bugünün pickleri
  console.log("⏳ Bugünün pick'leri yükleniyor...");
  const todayPicks = await fetchToday();
  if (!todayPicks.length) {
    console.log("❌ Bugün hiç pick yok.");
    return;
  }
  console.log(`✅ ${todayPicks.length} pick bulundu.\n`);

  // 2. Unique strategy ID'ler
  const uniqueIds = [...new Set(todayPicks.map(p => p.strategy_id))];
  console.log(`📦 ${uniqueIds.length} strateji için geçmiş yükleniyor...`);

  const historyMap = new Map();
  for (const id of uniqueIds) {
    process.stdout.write(`   Strategy #${id}... `);
    const hist = await fetchAllPicks(id);
    historyMap.set(id, hist);
    const decided = hist.filter(p => isHit(p.strike_result) || isMiss(p.strike_result));
    const hr = decided.length > 0 ? Math.round((hist.filter(p => isHit(p.strike_result)).length / decided.length) * 100) : null;
    console.log(`${hist.length} pick, ${decided.length} karar${hr !== null ? `, %${hr} hit rate` : ""}`);
  }

  // 3. Güven skorlarını hesapla ve yazdır
  console.log("\n" + "─".repeat(100));
  console.log(
    "\x1b[1m" +
    pad("SAAT", 6) + pad("STRATEJİ", 22) + pad("PREDICT", 14) + pad("SKOR", 6) +
    pad("DK", 4) + pad("LİG", 22) + pad("GÜVEN", 14) + pad("SONUÇ", 8) +
    "\x1b[0m"
  );
  console.log("─".repeat(100));

  for (const pick of todayPicks) {
    const hist   = historyMap.get(pick.strategy_id) || [];
    const conf   = computeConfidence(pick, hist);
    const time   = pick.picked_at
      ? new Date(pick.picked_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      : "—";
    const strat  = truncate(pick.strategy_name || `#${pick.strategy_id}`, 20);
    const predict = pad(pick.predict || "—", 12);
    const score  = pad(pick.score_pick || "—", 5);
    const dk     = pad(pick.timer ? `${pick.timer}'` : "—", 3);
    const league = truncate(pick.league || "—", 20);
    const result = isHit(pick.strike_result) ? "\x1b[32m✓ HIT \x1b[0m"
                 : isMiss(pick.strike_result) ? "\x1b[31m✗ MISS\x1b[0m"
                 : "\x1b[33m⏳    \x1b[0m";

    let confidenceStr;
    if (!conf) {
      confidenceStr = pad("—  (veri yok)", 14);
    } else {
      confidenceStr = `${conf.color}%${conf.score} ${conf.label}\x1b[0m`;
    }

    console.log(
      pad(time, 6) + pad(strat, 22) + predict + score + dk +
      pad(league, 22) + confidenceStr.padEnd(14 + 20) + result
    );

    // Factor detayları
    if (conf && conf.layers.some(l => l.used)) {
      const usedLayers = conf.layers.filter(l => l.used);
      const details = usedLayers.map(l => `${l.label}: %${Math.round(l.rate*100)}(${l.picks.length})`).join("  |  ");
      console.log("       \x1b[2m↳ " + details + `  [${conf.sampleSize} karar, ${conf.gn} gol lazım, ${conf.minRem}dk kaldı]` + "\x1b[0m");
    }
  }

  // 4. Özet
  console.log("\n" + "─".repeat(100));
  const computed   = todayPicks.filter(p => computeConfidence(p, historyMap.get(p.strategy_id) || []) !== null);
  const noData     = todayPicks.length - computed.length;
  const avgScore   = computed.length > 0
    ? Math.round(computed.reduce((s, p) => s + (computeConfidence(p, historyMap.get(p.strategy_id) || [])?.score || 0), 0) / computed.length)
    : 0;

  console.log(`\n\x1b[1m📈 ÖZET\x1b[0m`);
  console.log(`   Toplam pick    : ${todayPicks.length}`);
  console.log(`   Güven hesaplanan: ${computed.length}`);
  console.log(`   Veri yetersiz  : ${noData} (< 20 karar)`);
  if (computed.length > 0) console.log(`   Ort. güven skoru: %${avgScore}`);
  console.log();
}

function pad(str, n)      { return String(str || "").padEnd(n); }
function truncate(str, n) { return str.length > n ? str.slice(0, n - 1) + "…" : str.padEnd(n); }

main().catch(e => { console.error("\x1b[31m❌ Hata:", e.message, "\x1b[0m"); process.exit(1); });
