"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pick, isHit, isMiss, timeAgo, formatDate, fetchAllPicks } from "@/lib/supabase";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { exportPicksToCSV } from "@/lib/export";
import SearchBar from "./SearchBar";
import DateRangePicker from "./DateRangePicker";
import { SkeletonTable } from "./Skeleton";
import StrategyLeagueAnalysis from "./StrategyLeagueAnalysis";
import { computeConfidence } from "@/lib/confidence";
import ConfidenceBadge from "./ConfidenceBadge";

type ResultFilter = "all" | "hit" | "miss" | "pending";

interface Props {
  strategyId: number;
}

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

export default function StrategyDetail({ strategyId }: Props) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  useEffect(() => {
    const fetchPicks = async () => {
      try {
        const data = await fetchAllPicks([
          { column: "strategy_id", value: strategyId },
        ]);
        setPicks(data);
      } catch (e: any) {
        setError(e.message || "Strateji verileri yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, [strategyId]);

  useSupabaseRealtime({
    channelName: `strategy-${strategyId}`,
    event: "INSERT",
    onData: (payload) => {
      const p = payload.new as Pick;
      if (p.strategy_id === strategyId) {
        setPicks((prev) => [p, ...prev]);
      }
    },
  });

  useSupabaseRealtime({
    channelName: `strategy-${strategyId}-update`,
    event: "UPDATE",
    onData: (payload) => {
      const p = payload.new as Pick;
      if (p.strategy_id === strategyId) {
        setPicks((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      }
    },
  });

  const strategyName = picks[0]?.strategy_name || `Strategy #${strategyId}`;

  const hits = picks.filter((p) => isHit(p.strike_result)).length;
  const misses = picks.filter((p) => isMiss(p.strike_result)).length;
  const decided = hits + misses;
  const hitRate = decided > 0 ? Math.round((hits / decided) * 100) : null;

  const filtered = picks.filter((p) => {
    if (filter === "hit" && !isHit(p.strike_result)) return false;
    if (filter === "miss" && !isMiss(p.strike_result)) return false;
    if (filter === "pending" && (isHit(p.strike_result) || isMiss(p.strike_result))) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        p.home_team?.toLowerCase().includes(q) ||
        p.away_team?.toLowerCase().includes(q) ||
        p.league?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (new Date(p.picked_at) < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(p.picked_at) > end) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const hitRateColor =
    hitRate === null
      ? "text-gray-500"
      : hitRate >= 60
      ? "text-green-400"
      : hitRate >= 40
      ? "text-yellow-400"
      : "text-red-400";

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
          <h1 className="text-xl font-bold text-white">{strategyName}</h1>
          <button
            onClick={() =>
              exportPicksToCSV(
                filtered,
                `${strategyName.replace(/\s+/g, "-").toLowerCase()}.csv`
              )
            }
            disabled={filtered.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#161c27] border border-white/10 text-xs text-gray-400 hover:text-white hover:border-green-500/30 transition-colors disabled:opacity-30 shrink-0 ml-4"
          >
            ↓ CSV
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Toplam Pick</p>
            <p className="text-white font-bold text-xl">{picks.length}</p>
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
            <p className="text-gray-500 text-xs uppercase tracking-wider">Son Pick</p>
            <p className="text-gray-300 font-medium">
              {timeAgo(picks[0]?.picked_at || "")}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* League Analysis */}
      {!loading && picks.length > 0 && (
        <div className="mb-6">
          <StrategyLeagueAnalysis strategyId={strategyId} picks={picks} />
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {(["all", "hit", "miss", "pending"] as ResultFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-green-500 text-white"
                  : "bg-[#0d1117] text-gray-400 hover:text-white border border-white/5"
              }`}
            >
              {f === "all"
                ? `Tümü (${picks.length})`
                : f === "hit"
                ? `Hit (${hits})`
                : f === "miss"
                ? `Miss (${misses})`
                : `Bekleyen (${picks.length - decided})`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Takım veya lig ara..."
            />
          </div>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={(v) => {
              setStartDate(v);
              setPage(1);
            }}
            onEndChange={(v) => {
              setEndDate(v);
              setPage(1);
            }}
            onClear={() => {
              setStartDate("");
              setEndDate("");
              setPage(1);
            }}
          />
        </div>
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
                        <ConfidenceBadge result={computeConfidence(pick, picks)} />
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-600">
                {(page - 1) * PER_PAGE + 1}–
                {Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
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
