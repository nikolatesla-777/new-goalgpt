"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import LeagueStats from "@/components/LeagueStats";
import LeagueBreakdown from "@/components/charts/LeagueBreakdown";
import SearchBar from "@/components/SearchBar";
import { supabase, TABLE, Pick } from "@/lib/supabase";
import { SkeletonTable } from "@/components/Skeleton";

export default function LeaguesPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { data, error: err } = await supabase
          .from(TABLE)
          .select("*")
          .order("picked_at", { ascending: false });

        if (err) throw err;
        if (data) setPicks(data as Pick[]);
      } catch (e: any) {
        setError(e.message || "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const filtered = search
    ? picks.filter((p) =>
        p.league?.toLowerCase().includes(search.toLowerCase())
      )
    : picks;

  return (
    <main className="min-h-screen bg-[#080b12]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Lig İstatistikleri</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Toplam {picks.length} pick, {new Set(picks.map((p) => p.league).filter(Boolean)).size} lig
            </p>
          </div>
          <div className="w-56">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Lig ara..."
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Charts */}
        {!loading && picks.length > 0 && (
          <LeagueBreakdown picks={filtered} topN={15} />
        )}

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={10} />
        ) : (
          <LeagueStats picks={filtered} />
        )}
      </div>
    </main>
  );
}
