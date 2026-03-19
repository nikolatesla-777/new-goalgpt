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
  days?: number;
}

interface DataPoint {
  date: string;
  picks: number;
  hits: number;
  misses: number;
}

function buildDailyData(picks: Pick[], days = 14): DataPoint[] {
  const result: DataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const dayPicks = picks.filter((p) => {
      if (!p.picked_at) return false;
      const t = new Date(p.picked_at);
      return t >= d && t < next;
    });

    result.push({
      date: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
      picks: dayPicks.length,
      hits: dayPicks.filter((p) => isHit(p.strike_result)).length,
      misses: dayPicks.filter((p) => isMiss(p.strike_result)).length,
    });
  }

  return result;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload;
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-lg p-3 text-xs">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-white">{d.picks} pick</p>
        {d.hits > 0 && <p className="text-green-400">✓ {d.hits} hit</p>}
        {d.misses > 0 && <p className="text-red-400">✗ {d.misses} miss</p>}
      </div>
    );
  }
  return null;
};

export default function DailyPicksBar({ picks, days = 14 }: Props) {
  const data = buildDailyData(picks, days);

  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-400 mb-4">
        Günlük Pick Sayısı (son {days} gün)
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={1}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="picks" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.picks > 0 ? "#3b82f6" : "rgba(59,130,246,0.2)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
