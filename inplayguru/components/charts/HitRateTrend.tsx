"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Pick, isHit, isMiss } from "@/lib/supabase";

interface Props {
  picks: Pick[];
}

interface DataPoint {
  date: string;
  hitRate: number;
  picks: number;
}

function buildTrendData(picks: Pick[]): DataPoint[] {
  if (picks.length === 0) return [];

  // Group by date (daily)
  const byDate = new Map<string, Pick[]>();
  const sorted = [...picks].sort(
    (a, b) => new Date(a.picked_at).getTime() - new Date(b.picked_at).getTime()
  );

  for (const p of sorted) {
    if (!p.picked_at) continue;
    const d = new Date(p.picked_at);
    const key = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(p);
  }

  // Cumulative hit rate over time
  let cumHits = 0;
  let cumDecided = 0;
  const points: DataPoint[] = [];

  byDate.forEach((dayPicks, date) => {
    const h = dayPicks.filter((p) => isHit(p.strike_result)).length;
    const m = dayPicks.filter((p) => isMiss(p.strike_result)).length;
    cumHits += h;
    cumDecided += h + m;
    if (cumDecided > 0) {
      points.push({
        date,
        hitRate: Math.round((cumHits / cumDecided) * 100),
        picks: dayPicks.length,
      });
    }
  });

  return points;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-lg p-3 text-xs">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-green-400 font-bold">Hit Rate: %{payload[0]?.value}</p>
      </div>
    );
  }
  return null;
};

export default function HitRateTrend({ picks }: Props) {
  const data = buildTrendData(picks);

  if (data.length < 2) {
    return (
      <div className="text-center py-10 text-gray-600 text-sm">
        Trend için yeterli veri yok
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-400 mb-4">
        Hit Rate Trend (kümülatif)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `%${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="hitRate"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#22c55e" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
