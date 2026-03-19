import { StrategyStats } from "@/lib/supabase";
import StrategyCard from "./StrategyCard";

interface Props {
  stats: StrategyStats[];
}

export default function StrategyGrid({ stats }: Props) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-24 text-gray-600">
        <div className="text-5xl mb-4">⚽</div>
        <p className="text-lg font-medium">Henüz pick yok</p>
        <p className="text-sm mt-1 text-gray-700">
          Scraper çalıştığında stratejiler burada görünecek
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Stratejiler — {stats.length} toplam
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <StrategyCard key={s.strategy_id} stats={s} />
        ))}
      </div>
    </div>
  );
}
