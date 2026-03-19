"use client";

import Link from "next/link";
import { Pick, isHit, isMiss } from "@/lib/supabase";

interface LeagueData {
  league: string;
  total: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  strategies: string[];
}

interface Props {
  picks: Pick[];
}

export function computeLeagueStats(picks: Pick[]): LeagueData[] {
  const map = new Map<string, Pick[]>();

  for (const p of picks) {
    const key = p.league || "Bilinmeyen Lig";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  const result: LeagueData[] = [];

  map.forEach((lgPicks, league) => {
    const hits = lgPicks.filter((p) => isHit(p.strike_result)).length;
    const misses = lgPicks.filter((p) => isMiss(p.strike_result)).length;
    const decided = hits + misses;
    const strategies = Array.from(
      new Set(lgPicks.map((p) => p.strategy_name).filter(Boolean))
    );

    result.push({
      league,
      total: lgPicks.length,
      hits,
      misses,
      hitRate: decided > 0 ? Math.round((hits / decided) * 100) : null,
      strategies,
    });
  });

  return result.sort((a, b) => b.total - a.total);
}

export default function LeagueStats({ picks }: Props) {
  const leagues = computeLeagueStats(picks);

  if (leagues.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p>Henüz lig verisi yok</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Lig</th>
              <th className="text-center px-4 py-3">Toplam</th>
              <th className="text-center px-4 py-3">Hit</th>
              <th className="text-center px-4 py-3">Miss</th>
              <th className="text-center px-4 py-3">Hit Rate</th>
              <th className="text-left px-4 py-3">Stratejiler</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((lg, i) => {
              const hitRateColor =
                lg.hitRate === null
                  ? "text-gray-500"
                  : lg.hitRate >= 60
                  ? "text-green-400"
                  : lg.hitRate >= 40
                  ? "text-yellow-400"
                  : "text-red-400";

              return (
                <tr
                  key={lg.league}
                  className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                    i % 2 === 0 ? "" : "bg-white/[0.01]"
                  }`}
                >
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                    <Link
                      href={`/leagues/${encodeURIComponent(lg.league)}`}
                      className="text-white font-medium hover:text-blue-400 transition-colors"
                    >
                      {lg.league}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">
                    {lg.total}
                  </td>
                  <td className="px-4 py-3 text-center text-green-400 font-mono text-xs">
                    {lg.hits}
                  </td>
                  <td className="px-4 py-3 text-center text-red-400 font-mono text-xs">
                    {lg.misses}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-sm ${hitRateColor}`}>
                      {lg.hitRate !== null ? `%${lg.hitRate}` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lg.strategies.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] bg-[#161c27] text-gray-400 px-2 py-0.5 rounded border border-white/5 truncate max-w-[120px]"
                        >
                          {s}
                        </span>
                      ))}
                      {lg.strategies.length > 3 && (
                        <span className="text-[10px] text-gray-600">
                          +{lg.strategies.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
