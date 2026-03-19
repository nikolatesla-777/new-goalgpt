import { createClient } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import DailyPicksBar from "@/components/charts/DailyPicksBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { StrategyStats, isHit, isMiss, Pick } from "@/lib/supabase";

export const revalidate = 60;

function mapRow(row: any): StrategyStats {
  const hits = Number(row.hits ?? 0);
  const misses = Number(row.misses ?? 0);
  const decided = hits + misses;
  return {
    strategy_id: row.strategy_id,
    strategy_name: row.strategy_name,
    total: Number(row.total ?? 0),
    hits,
    misses,
    hitRate: decided > 0 ? Math.round((hits / decided) * 100) : null,
    lastPick: row.last_pick ?? "",
    lastPredict: row.last_predict ?? "",
    recentForm: (row.recent_results ?? []).map((r: string) =>
      isHit(r) ? "hit" : isMiss(r) ? "miss" : "pending"
    ),
  };
}

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ data: viewData }, { count: todayCount }, { data: recentPicks }] =
    await Promise.all([
      supabase
        .from("strategy_stats_view")
        .select("*")
        .order("total", { ascending: false }),
      supabase
        .from("inplayguru_picks")
        .select("id", { count: "exact", head: true })
        .gte("picked_at", today.toISOString()),
      supabase
        .from("inplayguru_picks")
        .select("picked_at, strike_result, league")
        .gte(
          "picked_at",
          new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("picked_at", { ascending: false }),
    ]);

  const initialStats = (viewData ?? []).map(mapRow);
  const initialTodayCount = todayCount ?? 0;
  const picks14d = (recentPicks ?? []) as Pick[];

  return (
    <main className="min-h-screen bg-[#080b12]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <ErrorBoundary>
          <Dashboard
            initialStats={initialStats}
            initialTodayCount={initialTodayCount}
          />
        </ErrorBoundary>
        {picks14d.length > 0 && (
          <ErrorBoundary>
            <DailyPicksBar picks={picks14d} days={14} />
          </ErrorBoundary>
        )}
      </div>
    </main>
  );
}
