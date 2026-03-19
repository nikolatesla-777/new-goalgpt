/**
 * Pick Güven Skoru (Confidence Score) Algoritması
 *
 * Bir tahmin için geçmiş verilerden çok boyutlu ağırlıklı hit rate hesaplar.
 * 5 katman: Skor Durumu, Dakika, Tahmin Tipi, Lig+Tahmin, Lig Genel
 */

import type { Pick } from "./supabase";
import { isHit, isMiss } from "./supabase";

export interface ConfidenceFactor {
  label: string;
  rate: number;
  n: number;
  weight: number;
  used: boolean;
}

export interface ConfidenceResult {
  score: number;           // 0-100
  label: string;           // "Çok Yüksek" | "Yüksek" | "Orta" | "Düşük" | "Çok Düşük"
  color: "green" | "lime" | "yellow" | "red";
  factors: ConfidenceFactor[];
  sampleSize: number;
  goalsNeeded: number;
  minutesRemaining: number;
}

interface ParsedPredict {
  period: "HT" | "FT";
  threshold: number;
  type: "OVER" | "UNDER";
}

interface ParsedScore {
  home: number;
  away: number;
  total: number;
}

export function parsePredict(predict: string): ParsedPredict | null {
  const trimmed = (predict || "").trim().toUpperCase();
  const match = trimmed.match(/^(HT|FT)\s+([\d.]+)\s+(OVER|UNDER)$/);
  if (!match) return null;
  return {
    period: match[1] as "HT" | "FT",
    threshold: parseFloat(match[2]),
    type: match[3] as "OVER" | "UNDER",
  };
}

export function parseScore(score: string): ParsedScore | null {
  const match = (score || "").match(/^(\d+)[-:\s](\d+)$/);
  if (!match) return null;
  const home = parseInt(match[1], 10);
  const away = parseInt(match[2], 10);
  return { home, away, total: home + away };
}

function computeGoalsNeeded(parsed: ParsedPredict, ps: ParsedScore): number {
  if (parsed.type === "OVER") {
    return Math.max(0, Math.ceil(parsed.threshold) - ps.total);
  }
  return Math.max(0, ps.total - Math.floor(parsed.threshold));
}

function hitRateFrom(picks: Pick[]): number {
  const decided = picks.filter(
    (p) => isHit(p.strike_result) || isMiss(p.strike_result)
  );
  if (decided.length === 0) return 0;
  return decided.filter((p) => isHit(p.strike_result)).length / decided.length;
}

export function computeConfidence(
  pick: Pick,
  history: Pick[]
): ConfidenceResult | null {
  const decided = history.filter(
    (p) => isHit(p.strike_result) || isMiss(p.strike_result)
  );
  if (decided.length < 20) return null;

  const parsed = parsePredict(pick.predict || "");
  const parsedScore = parseScore(pick.score_pick || "0-0") ?? {
    home: 0,
    away: 0,
    total: 0,
  };
  const timer = parseInt(pick.timer || "0", 10);
  const maxMinutes = parsed?.period === "HT" ? 45 : 90;
  const minutesRemaining = Math.max(0, maxMinutes - timer);

  let goalsNeeded = 2;
  if (parsed) {
    goalsNeeded = computeGoalsNeeded(parsed, parsedScore);
  }

  const pickPredict = (pick.predict || "").trim().toUpperCase();
  const pickLeague = (pick.league || "").toLowerCase().trim();

  // F1: same predict + same goalsNeeded (w=0.30, min=8)
  const f1 = decided.filter((p) => {
    if (!parsed) return false;
    const pp = parsePredict(p.predict || "");
    if (
      !pp ||
      pp.period !== parsed.period ||
      pp.threshold !== parsed.threshold ||
      pp.type !== parsed.type
    )
      return false;
    const ps = parseScore(p.score_pick || "0-0") ?? { home: 0, away: 0, total: 0 };
    return computeGoalsNeeded(pp, ps) === goalsNeeded;
  });

  // F2: same predict + timer ±10dk (w=0.20, min=8)
  const f2 = decided.filter((p) => {
    if (!parsed) return false;
    const pp = parsePredict(p.predict || "");
    if (
      !pp ||
      pp.period !== parsed.period ||
      pp.threshold !== parsed.threshold ||
      pp.type !== parsed.type
    )
      return false;
    return Math.abs(parseInt(p.timer || "0", 10) - timer) <= 10;
  });

  // F3: same predict string (w=0.15, min=15)
  const f3 = decided.filter(
    (p) => (p.predict || "").trim().toUpperCase() === pickPredict
  );

  // F4: same predict + same league (w=0.25, min=5)
  const f4 = decided.filter(
    (p) =>
      (p.predict || "").trim().toUpperCase() === pickPredict &&
      (p.league || "").toLowerCase().trim() === pickLeague &&
      pickLeague !== ""
  );

  // F5: same league (w=0.10, min=8)
  const f5 = decided.filter(
    (p) =>
      (p.league || "").toLowerCase().trim() === pickLeague && pickLeague !== ""
  );

  const layerDefs = [
    { label: "Skor Durumu", weight: 0.3,  minSample: 8,  picks: f1 },
    { label: "Dakika",      weight: 0.2,  minSample: 8,  picks: f2 },
    { label: "Tahmin Tipi", weight: 0.15, minSample: 15, picks: f3 },
    { label: "Lig + Tahmin",weight: 0.25, minSample: 5,  picks: f4 },
    { label: "Lig Genel",   weight: 0.1,  minSample: 8,  picks: f5 },
  ];

  const factors: ConfidenceFactor[] = layerDefs.map((l) => ({
    label: l.label,
    rate: l.picks.length >= l.minSample ? hitRateFrom(l.picks) : 0,
    n: l.picks.length,
    weight: l.weight,
    used: l.picks.length >= l.minSample,
  }));

  const usedFactors = factors.filter((f) => f.used);

  let finalRate: number;
  if (usedFactors.length === 0) {
    finalRate = hitRateFrom(decided);
  } else {
    const totalWeight = usedFactors.reduce((s, f) => s + f.weight, 0);
    finalRate =
      usedFactors.reduce((s, f) => s + f.rate * f.weight, 0) / totalWeight;
  }

  // Edge cases
  if (goalsNeeded === 0 && parsed?.type === "OVER") {
    finalRate = Math.min(Math.max(finalRate, 0.88), 0.97);
  } else if (goalsNeeded >= 4 && minutesRemaining < 20) {
    finalRate = Math.max(finalRate, 0.05);
  }

  const scorePercent = Math.round(Math.max(5, Math.min(97, finalRate * 100)));

  return {
    score: scorePercent,
    label: getLabel(scorePercent),
    color: getColor(scorePercent),
    factors,
    sampleSize: decided.length,
    goalsNeeded,
    minutesRemaining,
  };
}

function getLabel(score: number): string {
  if (score >= 75) return "Çok Yüksek";
  if (score >= 60) return "Yüksek";
  if (score >= 50) return "Orta";
  if (score >= 35) return "Düşük";
  return "Çok Düşük";
}

function getColor(score: number): "green" | "lime" | "yellow" | "red" {
  if (score >= 75) return "green";
  if (score >= 60) return "lime";
  if (score >= 50) return "yellow";
  return "red";
}
