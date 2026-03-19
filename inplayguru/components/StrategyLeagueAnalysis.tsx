"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Pick, isHit, isMiss } from "@/lib/supabase";

interface LeagueRow {
  league: string;
  total: number;
  hits: number;
  misses: number;
  pending: number;
  hitRate: number | null;
}

type SortKey = "league" | "total" | "hitRate";

interface Props {
  strategyId: number;
  picks: Pick[];
}

const STORAGE_KEY = "ipg_blocked_leagues";

function loadBlocked(): Record<number, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBlocked(data: Record<number, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function StrategyLeagueAnalysis({ strategyId, picks }: Props) {
  const [minSample, setMinSample] = useState(5);
  const [threshold, setThreshold] = useState(50);
  const [sortBy, setSortBy] = useState<SortKey>("total");
  const [sortAsc, setSortAsc] = useState(false);
  const [blockedLeagues, setBlockedLeagues] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = loadBlocked();
    setBlockedLeagues(all[strategyId] ?? []);
  }, [strategyId]);

  const toggleBlock = (league: string) => {
    const all = loadBlocked();
    const current = all[strategyId] ?? [];
    const next = current.includes(league)
      ? current.filter((l) => l !== league)
      : [...current, league];
    all[strategyId] = next;
    saveBlocked(all);
    setBlockedLeagues(next);
  };

  const rows = useMemo<LeagueRow[]>(() => {
    const map = new Map<string, Pick[]>();
    for (const p of picks) {
      const key = p.league?.trim() || "Bilinmeyen";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    const result: LeagueRow[] = [];
    map.forEach((lgPicks, league) => {
      const h = lgPicks.filter((p) => isHit(p.strike_result)).length;
      const m = lgPicks.filter((p) => isMiss(p.strike_result)).length;
      const decided = h + m;
      result.push({
        league,
        total: lgPicks.length,
        hits: h,
        misses: m,
        pending: lgPicks.length - decided,
        hitRate: decided > 0 ? Math.round((h / decided) * 100) : null,
      });
    });

    return result;
  }, [picks]);

  const filtered = rows.filter((r) => r.total >= minSample);

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortBy === "league") diff = a.league.localeCompare(b.league);
    else if (sortBy === "total") diff = a.total - b.total;
    else if (sortBy === "hitRate")
      diff = (a.hitRate ?? -1) - (b.hitRate ?? -1);
    return sortAsc ? diff : -diff;
  });

  const good = filtered.filter(
    (r) => r.hitRate !== null && r.hitRate >= threshold
  ).length;
  const bad = filtered.filter(
    (r) => r.hitRate !== null && r.hitRate < threshold
  ).length;

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc((v) => !v);
    else {
      setSortBy(key);
      setSortAsc(key === "league");
    }
  };

  const SortArrow = ({ col }: { col: SortKey }) =>
    sortBy === col ? (
      <span className="ml-1 text-green-400">{sortAsc ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-gray-700">↕</span>
    );

  if (picks.length === 0) return null;

  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Lig Analizi</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {rows.length} lig • {filtered.length} yeterli örneklem (≥{minSample} pick)
              {mounted && blockedLeagues.length > 0 && (
                <span className="ml-2 text-red-400">
                  • {blockedLeagues.length} engellendi
                </span>
              )}
            </p>
          </div>

          {/* Summary badges */}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-medium">
              ✓ {good} başarılı
            </span>
            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full font-medium">
              ✗ {bad} başarısız
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mt-3">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="whitespace-nowrap">Min pick:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={minSample}
              onChange={(e) => setMinSample(Number(e.target.value))}
              className="w-14 bg-[#161c27] border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-green-500/40"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="whitespace-nowrap">Başarı eşiği:</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={20}
                max={80}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-24 accent-green-500"
              />
              <span className="text-green-400 font-bold w-8">%{threshold}</span>
            </div>
          </label>
        </div>
      </div>

      {/* Blocked leagues banner */}
      {mounted && blockedLeagues.length > 0 && (
        <div className="px-5 py-3 bg-red-500/5 border-b border-red-500/10">
          <p className="text-xs text-red-400 font-medium mb-1.5">
            Engellenen Ligler ({blockedLeagues.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {blockedLeagues.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs"
              >
                {l}
                <button
                  onClick={() => toggleBlock(l)}
                  className="hover:text-white transition-colors"
                  title="Engeli kaldır"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm">
          Min {minSample} pick'e sahip lig yok
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort("league")}
                >
                  Lig <SortArrow col="league" />
                </th>
                <th
                  className="text-center px-4 py-3 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort("total")}
                >
                  Pick <SortArrow col="total" />
                </th>
                <th className="text-center px-4 py-3">Hit</th>
                <th className="text-center px-4 py-3">Miss</th>
                <th className="text-center px-4 py-3">Bekleyen</th>
                <th
                  className="text-center px-4 py-3 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort("hitRate")}
                >
                  Hit Rate <SortArrow col="hitRate" />
                </th>
                <th className="text-center px-4 py-3">Durum</th>
                <th className="text-center px-4 py-3">Engelle</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isBlocked = mounted && blockedLeagues.includes(row.league);
                const isGood =
                  row.hitRate !== null && row.hitRate >= threshold;
                const isBad =
                  row.hitRate !== null && row.hitRate < threshold;
                const hitRateColor = isBlocked
                  ? "text-gray-600"
                  : isGood
                  ? "text-green-400"
                  : isBad
                  ? "text-red-400"
                  : "text-gray-500";

                // Hit rate bar width
                const barW = row.hitRate ?? 0;
                const barColor = isBlocked
                  ? "bg-gray-700"
                  : barW >= threshold
                  ? "bg-green-500"
                  : barW >= threshold * 0.7
                  ? "bg-yellow-500"
                  : "bg-red-500";

                return (
                  <tr
                    key={row.league}
                    className={`border-b border-white/5 transition-colors ${
                      isBlocked
                        ? "opacity-40 bg-red-500/5"
                        : i % 2 === 0
                        ? "hover:bg-white/[0.02]"
                        : "bg-white/[0.01] hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Lig adı */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {isBlocked ? (
                        <span className="text-xs font-medium text-gray-600 line-through">
                          {row.league}
                        </span>
                      ) : (
                        <Link
                          href={`/leagues/${encodeURIComponent(row.league)}`}
                          className="text-xs font-medium text-white hover:text-blue-400 transition-colors"
                        >
                          {row.league}
                        </Link>
                      )}
                    </td>

                    {/* Pick */}
                    <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">
                      {row.total}
                    </td>

                    {/* Hit */}
                    <td className="px-4 py-3 text-center text-green-400 font-mono text-xs">
                      {row.hits}
                    </td>

                    {/* Miss */}
                    <td className="px-4 py-3 text-center text-red-400 font-mono text-xs">
                      {row.misses}
                    </td>

                    {/* Bekleyen */}
                    <td className="px-4 py-3 text-center text-yellow-500/70 font-mono text-xs">
                      {row.pending > 0 ? row.pending : "—"}
                    </td>

                    {/* Hit Rate */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-bold text-sm ${hitRateColor}`}>
                          {row.hitRate !== null ? `%${row.hitRate}` : "—"}
                        </span>
                        {row.hitRate !== null && (
                          <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Durum */}
                    <td className="px-4 py-3 text-center">
                      {row.hitRate === null ? (
                        <span className="text-xs text-gray-600">—</span>
                      ) : isBlocked ? (
                        <span className="text-xs text-gray-600">Engellendi</span>
                      ) : isGood ? (
                        <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                          Başarılı
                        </span>
                      ) : (
                        <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                          Başarısız
                        </span>
                      )}
                    </td>

                    {/* Engelle butonu */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleBlock(row.league)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                          isBlocked
                            ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                        }`}
                      >
                        {isBlocked ? "Aç" : "Engelle"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
