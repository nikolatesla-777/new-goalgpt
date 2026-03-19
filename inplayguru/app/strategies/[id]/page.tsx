import { createClient } from "@supabase/supabase-js";
import Header from "@/components/Header";
import StrategyDetail from "@/components/StrategyDetail";
import HitRateTrend from "@/components/charts/HitRateTrend";
import OddsDistribution from "@/components/charts/OddsDistribution";
import { Pick } from "@/lib/supabase";

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const strategyId = Number(id);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from(process.env.NEXT_PUBLIC_SUPABASE_TABLE || "inplayguru_picks")
    .select("*")
    .eq("strategy_id", strategyId)
    .order("picked_at", { ascending: false });

  const picks = (data ?? []) as Pick[];

  return (
    <main className="min-h-screen bg-[#080b12]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {picks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HitRateTrend picks={picks} />
            <OddsDistribution picks={picks} />
          </div>
        )}
        <StrategyDetail strategyId={strategyId} />
      </div>
    </main>
  );
}
