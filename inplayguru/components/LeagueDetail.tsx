"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { supabase, TABLE, Pick, isHit, isMiss, formatDate, fetchAllPicks } from "@/lib/supabase";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { SkeletonTable } from "./Skeleton";
import { computeConfidence } from "@/lib/confidence";
import ConfidenceBadge from "./ConfidenceBadge";

type ResultFilter = "all" | "hit" | "miss" | "pending";

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

interface Props {
  league: string; // decoded league name
}

export default function LeagueDetail({ league }: Props) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;
  const [historyMap, setHistoryMap] = useState<Map<number, Pick[]>>(new Map());
  const [historyLoading, setHistoryLoading] = useState(false);
  const fetchedStrategiesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchLeague = async () => {
      try {
        // fetchAllPicks ile tüm sayfaları çek
        const all: Pick[] = [];
        const PAGE = 1000;
        let from = 0;
        while (true) {
          const { data, error: err } = await supabase
            .from(TABLE)
            .select("*")
            .eq("league", league)
            .order("picked_at", { ascending: false })
            .range(from, from + PAGE - 1);
          if (err) throw err;
          if (!data || data.length === 0) break;
          all.push(...(data as Pick[]));
          if (data.length < PAGE) break;
          from += PAGE;
        }
        setPicks(all);
      } catch (e: any) {
        setError(e.message || "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchLeague();
  }, [league]);

  // Her strateji için tam geçmişi çek (güven skoru hesabı)
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

  // Realtime: yeni pick bu ligden gelirse ekle
  useSupabaseRealtime({
    channelName: `league-${league}-insert`,
    event: "INSERT",
    onData: (payload) => {
      const p = payload.new as Pick;
      if (p.league === league) setPicks((prev) => [p, ...prev]);
    },
  });

  useSupabaseRealtime({
    channelName: `league-${league}-update`,
    event: "UPDATE",
    onData: (payload) => {
      const p = payload.new as Pick;
      if (p.league === league)
        setPicks((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    },
  });

  // Strateji bazında breakdown (tüm picks'ten)
  const strategyBreakdown = useMemo(() => {
    const map = new Map<string, { id: number; picks: Pick[] }>();
    for (const p of picks) {
      const key = p.strategy_name || `#${p.strategy_id}`;
      if (!map.has(key)) map.set(key, { id: p.strategy_id, picks: [] });
      map.get(key)!.picks.push(p);
    }
    return Array.from(map.entries())
      .map(([name, { id, picks: sp }]) => {
        const h = sp.filter((p) => isHit(p.strike_result)).length;
        const m = sp.filter((p) => isMiss(p.strike_result)).length;
        const d = h + m;
        return { name, id, total: sp.length, hits: h, misses: m, pending: sp.length - d, hitRate: d > 0 ? Math.round((h / d) * 100) : null };
      })
      .sort((a, b) => b.total - a.total);
  }, [picks]);

  // Seçili stratejiye göre gösterilen picks
  const activePicks = strategyFilter === "all" ? picks : picks.filter((p) => p.strategy_name === strategyFilter);

  // Header stats (seçili stratejiye göre)
  const hits    = activePicks.filter((p) => isHit(p.strike_result)).length;
  const misses  = activePicks.filter((p) => isMiss(p.strike_result)).length;
  const decided = hits + misses;
  const hitRate = decided > 0 ? Math.round((hits / decided) * 100) : null;
  const hitRateColor =
    hitRate === null ? "text-gray-500" : hitRate >= 60 ? "text-green-400" : hitRate >= 40 ? "text-yellow-400" : "text-red-400";

  // Unique strategies
  const strategies = useMemo(
    () => ["all", ...Array.from(new Set(picks.map((p) => p.strategy_name).filter(Boolean))).sort()],
    [picks]
  );

  // Filter (result + strategy)
  const filtered = activePicks.filter((p) => {
    if (filter === "hit"     && !isHit(p.strike_result))                              return false;
    if (filter === "miss"    && !isMiss(p.strike_result))                             return false;
    if (filter === "pending" && (isHit(p.strike_result) || isMiss(p.strike_result))) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div>
      {/* Back */}
      <Link
        href="/leagues"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
      >
        ← Lig İstatistikleri
      </Link>

      {/* Header */}
      <div className="bg-[#0d1117] border border-white/5 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-white">{league}</h1>
          {strategyFilter !== "all" && (
            <button
              onClick={() => { setStrategyFilter("all"); setPage(1); }}
              className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
              ✕ Filtre kaldır
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Toplam Pick</p>
            <p className="text-white font-bold text-xl">{activePicks.length}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Hit Rate</p>
            <p className={`font-bold text-xl ${hitRateColor}`}>
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
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">
              {strategyFilter === "all" ? "Strateji" : "Strateji"}
            </p>
            <p className="text-gray-300 font-bold text-xl">
              {strategyFilter === "all" ? strategies.length - 1 : strategyFilter}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Strategy Breakdown */}
      {strategyBreakdown.length > 1 && (
        <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Strateji Bazında Analiz</h2>
            <p className="text-xs text-gray-500 mt-0.5">Satıra tıklayarak filtrele</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Strateji</th>
                  <th className="text-center px-4 py-3">Pick</th>
                  <th className="text-center px-4 py-3">Hit</th>
                  <th className="text-center px-4 py-3">Miss</th>
                  <th className="text-center px-4 py-3">Bekleyen</th>
                  <th className="text-center px-4 py-3">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {strategyBreakdown.map((row, i) => {
                  const isActive = strategyFilter === row.name;
                  const hrColor =
                    row.hitRate === null
                      ? "text-gray-500"
                      : row.hitRate >= 60
                      ? "text-green-400"
                      : row.hitRate >= 40
                      ? "text-yellow-400"
                      : "text-red-400";
                  return (
                    <tr
                      key={row.name}
                      onClick={() => {
                        setStrategyFilter(isActive ? "all" : row.name);
                        setPage(1);
                      }}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${
                        isActive
                          ? "bg-green-500/10 border-l-2 border-l-green-500"
                          : i % 2 === 0
                          ? "hover:bg-white/[0.02]"
                          : "bg-white/[0.01] hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="px-4 py-3 max-w-[220px] truncate">
                        <span className={`text-xs font-medium ${isActive ? "text-green-400" : "text-white"}`}>
                          {isActive && <span className="mr-1">▶</span>}
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{row.total}</td>
                      <td className="px-4 py-3 text-center text-green-400 font-mono text-xs">{row.hits}</td>
                      <td className="px-4 py-3 text-center text-red-400 font-mono text-xs">{row.misses}</td>
                      <td className="px-4 py-3 text-center text-yellow-500/70 font-mono text-xs">
                        {row.pending > 0 ? row.pending : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-sm ${hrColor}`}>
                          {row.hitRate !== null ? `%${row.hitRate}` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Result tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "hit", "miss", "pending"] as ResultFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-green-500 text-white"
                  : "bg-[#0d1117] text-gray-400 hover:text-white border border-white/5"
              }`}
            >
              {f === "all"     ? `Tümü (${picks.length})`
               : f === "hit"  ? `Hit (${hits})`
               : f === "miss" ? `Miss (${misses})`
               : `Bekleyen (${picks.length - decided})`}
            </button>
          ))}
        </div>

        {/* Strategy filter */}
        {strategies.length > 2 && (
          <select
            value={strategyFilter}
            onChange={(e) => { setStrategyFilter(e.target.value); setPage(1); }}
            className="bg-[#161c27] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-green-500/50"
          >
            <option value="all">Tüm Stratejiler</option>
            {strategies.filter((s) => s !== "all").map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={10} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p>Bu filtrede pick yok</p>
        </div>
      ) : (
        <>
          <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Tarih</th>
                    <th className="text-left px-4 py-3">Strateji</th>
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
                  {paginated.map((pick, i) => (
                    <tr
                      key={pick.id}
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                        i % 2 === 0 ? "" : "bg-white/[0.01]"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatDate(pick.picked_at)}
                      </td>
                      <td className="px-4 py-3 max-w-[150px] truncate text-xs">
                        <Link
                          href={`/strategies/${pick.strategy_id}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {pick.strategy_name || `#${pick.strategy_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium text-xs">{pick.home_team}</span>
                        <span className="text-gray-600 mx-1">v</span>
                        <span className="text-white font-medium text-xs">{pick.away_team}</span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-600">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-white/5 text-sm text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
                >
                  ←
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-white/5 text-sm text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
