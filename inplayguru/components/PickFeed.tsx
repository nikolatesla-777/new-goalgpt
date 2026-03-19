"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, Pick, isHit, isMiss } from "@/lib/supabase";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import PickCard from "./PickCard";
import SearchBar from "./SearchBar";
import DateRangePicker from "./DateRangePicker";

const TABLE = process.env.NEXT_PUBLIC_SUPABASE_TABLE || "inplayguru_picks";
const PER_PAGE = 20;

export default function PickFeed() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [filter, setFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const newPickIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchPicks = async () => {
      try {
        const { data, error: err } = await supabase
          .from(TABLE)
          .select("*")
          .order("picked_at", { ascending: false })
          .limit(500);

        if (err) throw err;
        if (data) setPicks(data as Pick[]);
      } catch (e: any) {
        setError(e.message || "Pick'ler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, []);

  useSupabaseRealtime({
    channelName: "picks-feed",
    event: "INSERT",
    onData: (payload) => {
      const newPick = payload.new as Pick;
      newPickIds.current.add(newPick.id);
      setPicks((prev) => [newPick, ...prev]);
      setTimeout(() => {
        newPickIds.current.delete(newPick.id);
      }, 10000);
    },
  });

  useSupabaseRealtime({
    channelName: "picks-feed-update",
    event: "UPDATE",
    onData: (payload) => {
      const updated = payload.new as Pick;
      setPicks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
  });

  const strategies = [
    "all",
    ...Array.from(new Set(picks.map((p) => p.strategy_name).filter(Boolean))),
  ];

  const leagues = [
    "all",
    ...Array.from(new Set(picks.map((p) => p.league).filter(Boolean))).sort(),
  ];

  const filtered = picks.filter((p) => {
    if (filter !== "all" && p.strategy_name !== filter) return false;
    if (leagueFilter !== "all" && p.league !== leagueFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTeam =
        p.home_team?.toLowerCase().includes(q) ||
        p.away_team?.toLowerCase().includes(q);
      if (!matchTeam) return false;
    }
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (new Date(p.picked_at) < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(p.picked_at) > end) return false;
    }
    return true;
  });

  const hits = filtered.filter((p) => isHit(p.strike_result)).length;
  const misses = filtered.filter((p) => isMiss(p.strike_result)).length;
  const hitRate =
    hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : null;

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleFilterChange = (val: string) => {
    setFilter(val);
    setPage(1);
  };

  return (
    <div>
      {/* Strategy Tabs */}
      {strategies.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {strategies.map((s) => (
            <button
              key={s}
              onClick={() => handleFilterChange(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === s
                  ? "bg-green-500 text-white"
                  : "bg-[#161c27] text-gray-400 hover:text-white border border-white/5"
              }`}
            >
              {s === "all" ? "Tümü" : s}
            </button>
          ))}
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-48">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        </div>

        {leagues.length > 2 && (
          <select
            value={leagueFilter}
            onChange={(e) => { setLeagueFilter(e.target.value); setPage(1); }}
            className="bg-[#161c27] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-green-500/50"
          >
            <option value="all">Tüm Ligler</option>
            {leagues.filter((l) => l !== "all").map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={(v) => { setStartDate(v); setPage(1); }}
          onEndChange={(v) => { setEndDate(v); setPage(1); }}
          onClear={() => { setStartDate(""); setEndDate(""); setPage(1); }}
        />
      </div>

      {/* Stats Bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-4 mb-4 px-1">
          <span className="text-xs text-gray-500">{filtered.length} pick</span>
          {hits > 0 && (
            <span className="text-xs text-green-400">✓ {hits} hit</span>
          )}
          {misses > 0 && (
            <span className="text-xs text-red-400">✗ {misses} miss</span>
          )}
          {hitRate !== null && (
            <span className="text-xs text-gray-400 ml-auto">
              Hit rate:{" "}
              <span
                className={
                  hitRate >= 60
                    ? "text-green-400 font-bold"
                    : hitRate >= 40
                    ? "text-yellow-400 font-bold"
                    : "text-red-400 font-bold"
                }
              >
                %{hitRate}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl bg-[#0d1117] border border-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <div className="text-5xl mb-4">⚽</div>
          <p className="text-lg font-medium">
            {search || startDate || endDate || leagueFilter !== "all"
              ? "Filtrelerle eşleşen pick yok"
              : "Henüz pick yok"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((pick) => (
              <PickCard
                key={pick.id}
                pick={pick}
                isNew={newPickIds.current.has(pick.id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-xs text-gray-600">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-white/5 text-sm text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
                >
                  ←
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-white/5 text-sm text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
