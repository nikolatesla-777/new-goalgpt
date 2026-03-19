import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const TABLE = process.env.NEXT_PUBLIC_SUPABASE_TABLE || "inplayguru_picks";

export interface Pick {
  id: number;
  strategy_id: number;
  strategy_name: string;
  home_team: string;
  away_team: string;
  league: string;
  picked_at: string;
  match_date: string;
  timer: string;
  score_pick: string;
  score_ht: string;
  score_ft: string;
  shots_pick: string;
  shots_ht: string;
  shots_ft: string;
  corners_pick: string;
  corners_ht: string;
  corners_ft: string;
  strike_result: string;
  predict: string;
  synced_at: string;
  odds_home?: string;
  odds_draw?: string;
  odds_away?: string;
}

export interface StrategyStats {
  strategy_id: number;
  strategy_name: string;
  total: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  lastPick: string;
  lastPredict: string;
  recentForm: string[]; // "hit" | "miss" | "pending"
}

export function isHit(result: string): boolean {
  const r = result?.toLowerCase();
  return r === "hit" || r === "win" || r === "won";
}

export function isMiss(result: string): boolean {
  const r = result?.toLowerCase();
  return r === "miss" || r === "loss" || r === "lose" || r === "lost";
}

export function computeStrategyStats(picks: Pick[]): StrategyStats[] {
  const map = new Map<number, Pick[]>();

  for (const p of picks) {
    if (!map.has(p.strategy_id)) map.set(p.strategy_id, []);
    map.get(p.strategy_id)!.push(p);
  }

  const stats: StrategyStats[] = [];

  map.forEach((stratPicks, stratId) => {
    // Sort by picked_at desc
    const sorted = [...stratPicks].sort(
      (a, b) => new Date(b.picked_at || b.synced_at).getTime() - new Date(a.picked_at || a.synced_at).getTime()
    );

    const hits = sorted.filter((p) => isHit(p.strike_result)).length;
    const misses = sorted.filter((p) => isMiss(p.strike_result)).length;
    const decided = hits + misses;

    const recentForm = sorted.slice(0, 10).map((p) => {
      if (isHit(p.strike_result)) return "hit";
      if (isMiss(p.strike_result)) return "miss";
      return "pending";
    });

    stats.push({
      strategy_id: stratId,
      strategy_name: sorted[0]?.strategy_name || `Strategy #${stratId}`,
      total: sorted.length,
      hits,
      misses,
      hitRate: decided > 0 ? Math.round((hits / decided) * 100) : null,
      lastPick: sorted[0]?.picked_at || sorted[0]?.synced_at || "",
      lastPredict: sorted[0]?.predict || "",
      recentForm,
    });
  });

  return stats.sort((a, b) => b.total - a.total);
}

/**
 * Supabase default 1000-row limitini aşmak için tüm satırları sayfalı çeker.
 * Strateji detay sayfası gibi 1000+ kayıt olabilecek yerlerde kullanılmalı.
 */
export async function fetchAllPicks(
  filters: { column: string; value: string | number }[]
): Promise<Pick[]> {
  const PAGE = 1000;
  let all: Pick[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(TABLE)
      .select("*")
      .order("picked_at", { ascending: false })
      .range(from, from + PAGE - 1);

    for (const f of filters) {
      query = query.eq(f.column, f.value);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data as Pick[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
