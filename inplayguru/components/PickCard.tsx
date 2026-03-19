import { Pick } from "@/lib/supabase";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

function ResultBadge({ result }: { result: string }) {
  if (!result) return null;

  const r = result.toLowerCase();
  const isHit = r === "hit" || r === "win" || r === "won";
  const isMiss = r === "miss" || r === "loss" || r === "lose" || r === "lost";

  if (isHit) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/20">
        ✓ HIT
      </span>
    );
  }
  if (isMiss) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20">
        ✗ MISS
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      ⏳ {result}
    </span>
  );
}

function ScoreRow({
  label,
  score,
  highlight,
}: {
  label: string;
  score: string;
  highlight?: boolean;
}) {
  if (!score) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-600 uppercase tracking-wider w-8">{label}</span>
      <span
        className={`text-sm font-mono font-semibold ${
          highlight ? "text-white" : "text-gray-400"
        }`}
      >
        {score}
      </span>
    </div>
  );
}

export default function PickCard({ pick, isNew }: { pick: Pick; isNew?: boolean }) {
  const hasOdds = pick.odds_home || pick.odds_draw || pick.odds_away;

  return (
    <div
      className={`rounded-xl border bg-[#0d1117] p-4 transition-all ${
        isNew
          ? "border-green-500/30 animate-slide-down"
          : "border-white/5 hover:border-white/10"
      }`}
    >
      {/* Top row: league + timer + time */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {pick.league && (
            <span className="text-xs text-gray-500 truncate">{pick.league}</span>
          )}
          {pick.timer && (
            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full shrink-0">
              {pick.timer}&apos;
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600 shrink-0 ml-2">
          {timeAgo(pick.picked_at || pick.synced_at)}
        </span>
      </div>

      {/* Teams */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">{pick.home_team || "—"}</span>
          <span className="text-gray-600 text-sm">vs</span>
          <span className="text-base font-bold text-white">{pick.away_team || "—"}</span>
        </div>
      </div>

      {/* Scores + Result */}
      <div className="flex items-end justify-between">
        <div className="space-y-0.5">
          <ScoreRow label="Pick" score={pick.score_pick} highlight />
          <ScoreRow label="HT" score={pick.score_ht} />
          <ScoreRow label="FT" score={pick.score_ft} />
        </div>

        <div className="flex flex-col items-end gap-2">
          <ResultBadge result={pick.strike_result} />
          {hasOdds && (
            <div className="flex gap-1.5 text-[11px] text-gray-600">
              {pick.odds_home && (
                <span className="bg-white/5 px-1.5 py-0.5 rounded">
                  1: <span className="text-gray-400">{pick.odds_home}</span>
                </span>
              )}
              {pick.odds_draw && (
                <span className="bg-white/5 px-1.5 py-0.5 rounded">
                  X: <span className="text-gray-400">{pick.odds_draw}</span>
                </span>
              )}
              {pick.odds_away && (
                <span className="bg-white/5 px-1.5 py-0.5 rounded">
                  2: <span className="text-gray-400">{pick.odds_away}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Strategy */}
      {pick.strategy_name && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <span className="text-[11px] text-gray-600">Strateji: </span>
          <span className="text-[11px] text-gray-400 font-medium">{pick.strategy_name}</span>
        </div>
      )}
    </div>
  );
}
