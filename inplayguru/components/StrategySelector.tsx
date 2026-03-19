"use client";

import { StrategyStats } from "@/lib/supabase";

interface Props {
  strategies: StrategyStats[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

export default function StrategySelector({ strategies, selectedIds, onToggle }: Props) {
  return (
    <div className="bg-[#0d1117] border border-white/5 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
        Karşılaştırmak için stratejiler seçin (max 4)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {strategies.map((s) => {
          const isSelected = selectedIds.includes(s.strategy_id);
          const isDisabled = !isSelected && selectedIds.length >= 4;

          return (
            <button
              key={s.strategy_id}
              onClick={() => !isDisabled && onToggle(s.strategy_id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-all border ${
                isSelected
                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                  : isDisabled
                  ? "bg-[#161c27] border-white/5 text-gray-600 cursor-not-allowed"
                  : "bg-[#161c27] border-white/5 text-gray-400 hover:text-white hover:border-white/15"
              }`}
            >
              <span className="truncate text-xs font-medium">{s.strategy_name}</span>
              <span className="text-[10px] ml-2 shrink-0">
                {s.hitRate !== null ? `%${s.hitRate}` : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
