"use client";

import { useState, useEffect } from "react";
import { supabase, TABLE, StrategyStats, isHit, isMiss } from "@/lib/supabase";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import StatsBar from "./StatsBar";
import StrategyGrid from "./StrategyGrid";
import { SkeletonGrid, SkeletonStatsBar } from "./Skeleton";

interface Props {
  initialStats: StrategyStats[];
  initialTodayCount: number;
}

export default function Dashboard({ initialStats, initialTodayCount }: Props) {
  const [stats, setStats] = useState<StrategyStats[]>(initialStats);
  const [todayPicks, setTodayPicks] = useState(initialTodayCount);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshStats = async () => {
    try {
      const { data, error: err } = await supabase
        .from("strategy_stats_view")
        .select("*")
        .order("total", { ascending: false });

      if (err) throw err;

      if (data) {
        setStats(
          data.map((row: any) => {
            const hits = Number(row.hits ?? 0);
            const misses = Number(row.misses ?? 0);
            const decided = hits + misses;
            return {
              strategy_id: row.strategy_id,
              strategy_name: row.strategy_name,
              total: Number(row.total ?? 0),
              hits,
              misses,
              hitRate: decided > 0 ? Math.round((hits / decided) * 100) : null,
              lastPick: row.last_pick ?? "",
              lastPredict: row.last_predict ?? "",
              recentForm: (row.recent_results ?? []).map((r: string) =>
                isHit(r) ? "hit" : isMiss(r) ? "miss" : "pending"
              ),
            };
          })
        );
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .gte("picked_at", today.toISOString());
      setTodayPicks(count ?? 0);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Veriler yüklenemedi");
    }
  };

  useSupabaseRealtime({
    channelName: "dashboard-realtime",
    event: "INSERT",
    onData: refreshStats,
  });

  useSupabaseRealtime({
    channelName: "dashboard-realtime-update",
    event: "UPDATE",
    onData: refreshStats,
  });

  const totalPicks = stats.reduce((s, x) => s + x.total, 0);
  const totalHits = stats.reduce((s, x) => s + x.hits, 0);
  const totalMisses = stats.reduce((s, x) => s + x.misses, 0);
  const overallHitRate =
    totalHits + totalMisses > 0
      ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
      : null;

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium mb-1">Bağlantı hatası</p>
        <p className="text-red-400/60 text-sm">{error}</p>
        <button
          onClick={refreshStats}
          className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsBar
        totalStrategies={stats.length}
        totalPicks={totalPicks}
        hitRate={overallHitRate}
        todayPicks={todayPicks}
      />
      <StrategyGrid stats={stats} />
    </div>
  );
}
