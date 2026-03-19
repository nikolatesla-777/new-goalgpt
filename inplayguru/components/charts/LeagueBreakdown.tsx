"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Pick, isHit, isMiss } from "@/lib/supabase";

interface Props {
  picks: Pick[];
  topN?: number;
}

interface DataPoint {
  league: string;
  hitRate: number;
  total: number;
}

function buildLeagueData(picks: Pick[], topN = 10): DataPoint[] {
  const map = new Map<string, Pick[]>();
  for (const p of picks) {
    const key = p.league || "Bilinmeyen";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  const result: DataPoint[] = [];
  map.forEach((lgPicks, league) => {
    const h = lgPicks.filter((p) => isHit(p.strike_result)).length;
    const m = lgPicks.filter((p) => isMiss(p.strike_result)).length;
    const decided = h + m;
    if (decided < 3) return; // skip low-sample leagues
    result.push({
      league: league.length > 20 ? league.slice(0, 18) + "…" : league,
      hitRate: Math.round((h / decided) * 100),
      total: lgPicks.length,
    });
  });

  return result.sort((a, b) => b.total - a.total).slice(0, topN);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload;
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-lg p-3 text-xs">
        <p className="text-gray-400 mb-1 max-w-[160px] leading-tight">{label}</p>
        <p className={payload[0]?.value >= 60 ? "text-green-400" : payload[0]?.value >= 40 ? "text-yellow-400" : "text-red-400"}>
          Hit Rate: %{payload[0]?.value}
        </p>
        <p className="text-gray-500">{d.total} pick</p>
      </div>
    );
  }
  return null;
};

export default function LeagueBreakdown({ picks, topN = 10 }: Props) {
  const data = buildLeagueData(picks, topN);

  if (data.length === 0) {
    return (
      <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">
          Lig Bazlı Hit Rate
        </h3>
        <div className="text-center py-10 text-gray-600 text-sm">
          Yeterli lig verisi yok
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-400 mb-4">
        Lig Bazlı Hit Rate (en az 3 pick)
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 40, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `%${v}`}
          />
          <YAxis
            type="category"
            dataKey="league"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="hitRate" radius={[0, 3, 3, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.hitRate >= 60
                    ? "#22c55e"
                    : entry.hitRate >= 40
                    ? "#eab308"
                    : "#f87171"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
