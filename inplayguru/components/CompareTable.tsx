import { StrategyStats } from "@/lib/supabase";
import Link from "next/link";

interface Props {
  strategies: StrategyStats[];
}

function FormDot({ result }: { result: string }) {
  if (result === "hit")
    return <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />;
  if (result === "miss")
    return <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-gray-600 inline-block" />;
}

function Stat({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-lg ${className}`}>{value}</p>
    </div>
  );
}

export default function CompareTable({ strategies }: Props) {
  if (strategies.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p>Yukarıdan strateji seçin</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {strategies.map((s) => {
        const hitRateColor =
          s.hitRate === null
            ? "text-gray-500"
            : s.hitRate >= 60
            ? "text-green-400"
            : s.hitRate >= 40
            ? "text-yellow-400"
            : "text-red-400";

        const hitRateBg =
          s.hitRate === null
            ? "border-white/5"
            : s.hitRate >= 60
            ? "border-green-500/20"
            : s.hitRate >= 40
            ? "border-yellow-500/20"
            : "border-red-500/20";

        return (
          <div
            key={s.strategy_id}
            className={`bg-[#0d1117] border ${hitRateBg} rounded-xl p-5`}
          >
            {/* Name */}
            <Link
              href={`/strategies/${s.strategy_id}`}
              className="text-sm font-semibold text-white hover:text-green-400 transition-colors line-clamp-2 block mb-4"
            >
              {s.strategy_name}
            </Link>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Stat
                label="Hit Rate"
                value={s.hitRate !== null ? `%${s.hitRate}` : "—"}
                className={hitRateColor}
              />
              <Stat label="Toplam" value={s.total} className="text-white" />
              <Stat label="Hit" value={s.hits} className="text-green-400" />
              <Stat label="Miss" value={s.misses} className="text-red-400" />
            </div>

            {/* Son Form */}
            {s.recentForm.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">
                  Son Form
                </p>
                <div className="flex gap-1 flex-wrap">
                  {s.recentForm.slice(0, 10).map((r, i) => (
                    <FormDot key={i} result={r} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
