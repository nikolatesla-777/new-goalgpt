"use client";

import { useState } from "react";
import type { ConfidenceResult } from "@/lib/confidence";

interface ConfidenceBadgeProps {
  result: ConfidenceResult | null;
  loading?: boolean;
}

const COLOR_CLASSES = {
  green:  "bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25",
  lime:   "bg-lime-500/15 text-lime-400 border-lime-500/20 hover:bg-lime-500/25",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20",
  red:    "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
} as const;

export default function ConfidenceBadge({
  result,
  loading = false,
}: ConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border bg-white/5 text-gray-600 border-white/10 animate-pulse">
        ...
      </span>
    );
  }

  if (!result) {
    return <span className="text-gray-600 text-xs select-none">—</span>;
  }

  const colorClass = COLOR_CLASSES[result.color];
  const usedFactors = result.factors.filter((f) => f.used);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black border cursor-help transition-colors whitespace-nowrap ${colorClass}`}
      >
        %{result.score}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 bg-[#0d1117] border border-white/10 rounded-xl p-3 shadow-2xl text-xs pointer-events-none">
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/10" />

          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-white">{result.label}</span>
            <span
              className={`font-black ${
                result.color === "green"
                  ? "text-green-400"
                  : result.color === "lime"
                  ? "text-lime-400"
                  : result.color === "yellow"
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              %{result.score}
            </span>
          </div>

          {usedFactors.length > 0 ? (
            <div className="space-y-1.5">
              {usedFactors.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-gray-400 truncate">{f.label}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-white font-mono font-bold">
                      %{Math.round(f.rate * 100)}
                    </span>
                    <span className="text-gray-600 text-[10px]">({f.n})</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Genel oran kullanıldı</p>
          )}

          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-600">
            <span>{result.sampleSize} karar verisi</span>
            <span>
              {result.goalsNeeded > 0
                ? `${result.goalsNeeded} gol lazım`
                : "Eşik geçildi"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
