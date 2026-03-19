"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase, TABLE, Pick, isHit, isMiss, formatDate, fetchAllPicks } from "@/lib/supabase";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { exportPicksToCSV } from "@/lib/export";
import SearchBar from "./SearchBar";
import { SkeletonTable } from "./Skeleton";
import { computeConfidence } from "@/lib/confidence";
import ConfidenceBadge from "./ConfidenceBadge";

function PredictBadge({ predict }: { predict: string }) {
  if (!predict) return <span className="text-gray-600 text-xs">—</span>;
  const isHT = predict.startsWith("HT");
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${
        isHT
          ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
          : "bg-blue-500/15 text-blue-400 border-blue-500/20"
      }`}
    >
      {predict}
    </span>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (!result) return <span className="text-gray-600 text-xs">—</span>;
  if (isHit(result))
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/20 whitespace-nowrap">
        ✓ HIT
      </span>
    );
  if (isMiss(result))
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20 whitespace-nowrap">
        ✗ MISS
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 whitespace-nowrap">
      ⏳
    </span>
  );
}

export default function TodayPicks() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [historyMap, setHistoryMap] = useState<Map<number, Pick[]>>(new Map());
  const [historyLoading, setHistoryLoading] = useState(false);
  const fetchedStrategiesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data, error: err } = await supabase
          .from(TABLE)
          .select("*")
          .gte("picked_at", today.toISOString())
          .order("picked_at", { ascending: false });

        if (err) throw err;
        if (data) setPicks(data as Pick[]);
      } catch (e: any) {
        setError(e.message || "Pick'ler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchToday();
  }, []);

  // Her strateji için geçmiş pick'leri çek (güven skoru hesabı için)
  useEffect(() => {
    if (picks.length === 0) return;

    const newIds = picks
      .map((p) => p.strategy_id)
      .filter((id) => !fetchedStrategiesRef.current.has(id));
    const uniqueNewIds = [...new Set(newIds)];
    if (uniqueNewIds.length === 0) return;

    uniqueNewIds.forEach((id) => fetchedStrategiesRef.current.add(id));
    setHistoryLoading(true);

    Promise.all(
      uniqueNewIds.map((id) =>
        fetchAllPicks([{ column: "strategy_id", value: id }])
          .then((data) => ({ id, data }))
          .catch(() => ({ id, data: [] as Pick[] }))
      )
    )
      .then((results) => {
        setHistoryMap((prev) => {
          const next = new Map(prev);
          results.forEach(({ id, data }) => next.set(id, data));
          return next;
        });
      })
      .finally(() => setHistoryLoading(false));
  }, [picks]);

  useSupabaseRealtime({
    channelName: "today-realtime",
    event: "INSERT",
    onData: (payload) => {
      const p = payload.new as Pick;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (p.picked_at && new Date(p.picked_at) >= today) {
        setPicks((prev) => [p, ...prev]);
      }
    },
  });

  useSupabaseRealtime({
    channelName: "today-realtime-update",
    event: "UPDATE",
    onData: (payload) => {
      const updated = payload.new as Pick;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (updated.picked_at && new Date(updated.picked_at) >= today) {
        setPicks((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      }
    },
  });

  const leagues = [
    "all",
    ...Array.from(new Set(picks.map((p) => p.league).filter(Boolean))).sort(),
  ];

  const filtered = picks.filter((p) => {
    if (leagueFilter !== "all" && p.league !== leagueFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.home_team?.toLowerCase().includes(q) ||
        p.away_team?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const hits = filtered.filter((p) => isHit(p.strike_result)).length;
  const misses = filtered.filter((p) => isMiss(p.strike_result)).length;
  const decided = hits + misses;
  const hitRate = decided > 0 ? Math.round((hits / decided) * 100) : null;

  const todayStr = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
      >
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="bg-[#0d1117] border border-white/5 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Bugünün Pickleri</h1>
            <p className="text-gray-500 text-sm">{todayStr}</p>
          </div>
          <button
            onClick={() =>
              exportPicksToCSV(
                filtered,
                `bugun-pickler-${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
            disabled={filtered.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#161c27] border border-white/10 text-xs text-gray-400 hover:text-white hover:border-green-500/30 transition-colors disabled:opacity-30"
          >
            ↓ CSV
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Toplam Pick</p>
            <p className="text-white font-bold text-xl">{picks.length}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Hit Rate</p>
            <p
              className={`font-bold text-xl ${
                hitRate === null
                  ? "text-gray-500"
                  : hitRate >= 60
                  ? "text-green-400"
                  : hitRate >= 40
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              {hitRate !== null ? `%${hitRate}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Hit</p>
            <p className="text-green-400 font-bold text-xl">{hits}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Miss</p>
            <p className="text-red-400 font-bold text-xl">{misses}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-48">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        {leagues.length > 2 && (
          <select
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="bg-[#161c27] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-green-500/50"
          >
            <option value="all">Tüm Ligler</option>
            {leagues.filter((l) => l !== "all").map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={10} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p>{search || leagueFilter !== "all" ? "Filtrelerle eşleşen pick yok" : "Bugün henüz pick yok"}</p>
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Saat</th>
                  <th className="text-left px-4 py-3">Strateji</th>
                  <th className="text-left px-4 py-3">Lig</th>
                  <th className="text-left px-4 py-3">Maç</th>
                  <th className="text-center px-4 py-3">Dk</th>
                  <th className="text-center px-4 py-3">Pick</th>
                  <th className="text-center px-4 py-3">HT</th>
                  <th className="text-center px-4 py-3">FT</th>
                  <th className="text-center px-4 py-3">Predict</th>
                  <th className="text-center px-4 py-3">Güven</th>
                  <th className="text-center px-4 py-3">Sonuç</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pick, i) => (
                  <tr
                    key={pick.id}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                      i % 2 === 0 ? "" : "bg-white/[0.01]"
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {pick.picked_at
                        ? new Date(pick.picked_at).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[140px] truncate text-xs">
                      <Link
                        href={`/strategies/${pick.strategy_id}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {pick.strategy_name || `#${pick.strategy_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-[120px] truncate text-xs">
                      {pick.league || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium text-xs">
                        {pick.home_team}
                      </span>
                      <span className="text-gray-600 mx-1">v</span>
                      <span className="text-white font-medium text-xs">
                        {pick.away_team}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-blue-400 font-mono text-xs">
                      {pick.timer ? `${pick.timer}'` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-white text-xs">
                      {pick.score_pick || "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-gray-400 text-xs">
                      {pick.score_ht || "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-gray-400 text-xs">
                      {pick.score_ft || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PredictBadge predict={pick.predict} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ConfidenceBadge
                        loading={historyLoading && !historyMap.has(pick.strategy_id)}
                        result={
                          historyMap.has(pick.strategy_id)
                            ? computeConfidence(pick, historyMap.get(pick.strategy_id)!)
                            : null
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ResultBadge result={pick.strike_result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
