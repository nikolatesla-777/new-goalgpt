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
}

interface DataPoint {
  type: string;
  hitRate: number;
  total: number;
  hits: number;
}

// Group picks by predict type (HT/FT) and show hit rates
function buildPredictData(picks: Pick[]): DataPoint[] {
  const map = new Map<string, Pick[]>();

  for (const p of picks) {
    const predict = p.predict?.trim() || "Bilinmeyen";
    if (!map.has(predict)) map.set(predict, []);
    map.get(predict)!.push(p);
  }

  const result: DataPoint[] = [];
  map.forEach((typePicks, type) => {
    const h = typePicks.filter((p) => isHit(p.strike_result)).length;
    const m = typePicks.filter((p) => isMiss(p.strike_result)).length;
    const decided = h + m;
    if (decided < 2) return;
    result.push({
      type: type.length > 15 ? type.slice(0, 13) + "…" : type,
      hitRate: Math.round((h / decided) * 100),
      total: typePicks.length,
      hits: h,
    });
  });

  return result.sort((a, b) => b.total - a.total).slice(0, 12);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload;
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-lg p-3 text-xs">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className={payload[0]?.value >= 60 ? "text-green-400" : payload[0]?.value >= 40 ? "text-yellow-400" : "text-red-400"}>
          Hit Rate: %{payload[0]?.value}
        </p>
        <p className="text-gray-500">{d.total} pick / {d.hits} hit</p>
      </div>
    );
  }
  return null;
};

export default function OddsDistribution({ picks }: Props) {
  const data = buildPredictData(picks);

  if (data.length === 0) {
    return (
      <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">
          Predict Türüne Göre Hit Rate
        </h3>
        <div className="text-center py-10 text-gray-600 text-sm">
          Yeterli veri yok
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-400 mb-4">
        Predict Türüne Göre Hit Rate
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="type"
            tick={{ fill: "#6b7280", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `%${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="hitRate" radius={[3, 3, 0, 0]}>
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
