import Link from "next/link";
import { StrategyStats, timeAgo } from "@/lib/supabase";

interface Props {
  stats: StrategyStats;
}

function FormDot({ result }: { result: string }) {
  if (result === "hit")
    return <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" title="Hit" />;
  if (result === "miss")
    return <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" title="Miss" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-gray-600 inline-block" title="Pending" />;
}

export default function StrategyCard({ stats }: Props) {
  const { strategy_id, strategy_name, total, hits, misses, hitRate, lastPick, lastPredict, recentForm } = stats;

  const hitRateColor =
    hitRate === null
      ? "text-gray-500"
      : hitRate >= 60
      ? "text-green-400"
      : hitRate >= 40
      ? "text-yellow-400"
      : "text-red-400";

  const hitRateBg =
    hitRate === null
      ? "bg-gray-800"
      : hitRate >= 60
      ? "bg-green-500/10 border-green-500/20"
      : hitRate >= 40
      ? "bg-yellow-500/10 border-yellow-500/20"
      : "bg-red-500/10 border-red-500/20";

  return (
    <Link href={`/strategies/${strategy_id}`}>
      <div className="bg-[#0d1117] border border-white/5 rounded-xl p-5 hover:border-white/15 hover:bg-[#111827] transition-all cursor-pointer group h-full">
        {/* Name */}
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-white text-sm leading-tight group-hover:text-green-400 transition-colors line-clamp-2">
            {strategy_name || `Strategy #${strategy_id}`}
          </h3>
          <span className="text-gray-600 text-xs ml-2 shrink-0">→</span>
        </div>

        {/* Hit rate big */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold mb-4 ${hitRateBg}`}>
          <span className={hitRateColor}>
            {hitRate !== null ? `%${hitRate}` : "—"}
          </span>
          <span className="text-gray-600 text-xs font-normal">hit rate</span>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-4 text-xs">
          <div>
            <p className="text-gray-600">Toplam</p>
            <p className="text-white font-semibold">{total}</p>
          </div>
          <div>
            <p className="text-gray-600">Hit</p>
            <p className="text-green-400 font-semibold">{hits}</p>
          </div>
          <div>
            <p className="text-gray-600">Miss</p>
            <p className="text-red-400 font-semibold">{misses}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-gray-600">Son pick</p>
            <p className="text-gray-400">{timeAgo(lastPick)}</p>
          </div>
        </div>

        {/* Last predict */}
        {lastPredict && (
          <div className="mb-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Son predict</p>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                lastPredict.startsWith("HT")
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                  : "bg-blue-500/15 text-blue-400 border-blue-500/20"
              }`}
            >
              {lastPredict}
            </span>
          </div>
        )}

        {/* Recent form */}
        {recentForm.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Son form</p>
            <div className="flex gap-1.5">
              {recentForm.slice(0, 10).map((r, i) => (
                <FormDot key={i} result={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
