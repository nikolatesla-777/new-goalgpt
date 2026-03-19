"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import CompareTable from "@/components/CompareTable";
import StrategySelector from "@/components/StrategySelector";
import { supabase, StrategyStats, isHit, isMiss } from "@/lib/supabase";
import { SkeletonGrid } from "@/components/Skeleton";

function mapRow(row: any): StrategyStats {
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
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allStrategies, setAllStrategies] = useState<StrategyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = (searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const { data, error: err } = await supabase
          .from("strategy_stats_view")
          .select("*")
          .order("total", { ascending: false });

        if (err) throw err;
        if (data) setAllStrategies(data.map(mapRow));
      } catch (e: any) {
        setError(e.message || "Stratejiler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  const toggleStrategy = useCallback(
    (id: number) => {
      let next: number[];
      if (selectedIds.includes(id)) {
        next = selectedIds.filter((x) => x !== id);
      } else {
        next = [...selectedIds, id];
      }
      const param = next.join(",");
      router.push(`/compare${param ? `?ids=${param}` : ""}`, { scroll: false });
    },
    [selectedIds, router]
  );

  const selectedStrategies = allStrategies.filter((s) =>
    selectedIds.includes(s.strategy_id)
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={6} />
      ) : (
        <StrategySelector
          strategies={allStrategies}
          selectedIds={selectedIds}
          onToggle={toggleStrategy}
        />
      )}

      {selectedStrategies.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Karşılaştırma — {selectedStrategies.length} strateji
          </h2>
          <CompareTable strategies={selectedStrategies} />
        </div>
      )}

      {selectedStrategies.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-600">
          <p className="text-lg">Henüz strateji seçilmedi</p>
          <p className="text-sm mt-1">Yukarıdaki listeden stratejilere tıklayın</p>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-[#080b12]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Strateji Karşılaştırma</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            URL paylaşılabilir — seçilen stratejiler linkte saklanır
          </p>
        </div>
        <Suspense
          fallback={
            <div className="space-y-6">
              <SkeletonGrid count={6} />
            </div>
          }
        >
          <CompareContent />
        </Suspense>
      </div>
    </main>
  );
}
