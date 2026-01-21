/**
 * Match Detail Context
 *
 * Provides shared state for all match detail tabs.
 * Fetches match data, stats, incidents, lineups, h2h, standings in parallel (eager loading).
 * Database-first architecture: ~50ms response times instead of ~2000ms API calls.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  getMatchLiveStats,
  getMatchIncidents,
  getMatchFull,
} from '../../api/matches';

// ============================================
// TYPES
// ============================================

export interface MatchTeam {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface MatchData {
  id: string;
  competition_id: string;
  season_id: string;
  match_time: number;
  status_id: number;
  minute: number | null;
  minute_text: string | null;
  home_team_id: string;
  away_team_id: string;
  home_team: MatchTeam | null;
  away_team: MatchTeam | null;
  home_score: number | null;
  away_score: number | null;
  home_score_overtime: number;
  away_score_overtime: number;
  home_score_penalties: number;
  away_score_penalties: number;
  home_red_cards: number;
  away_red_cards: number;
  home_yellow_cards: number;
  away_yellow_cards: number;
  home_corners: number;
  away_corners: number;
  competition: {
    id: string;
    name: string;
    logo_url: string | null;
    country_id: string | null;
  } | null;
}

export interface MatchStat {
  type: number;
  home: number;
  away: number;
  name: string;
  nameTr: string;
}

export interface MatchIncident {
  id?: number;
  match_id?: string;
  incident_type: string;
  type?: number;
  minute: number;
  added_time?: number | null;
  team: 'home' | 'away';
  player_id?: string | null;
  player_name?: string | null;
  assist_player_id?: string | null;
  assist_player_name?: string | null;
  in_player_id?: string | null;
  in_player_name?: string | null;
  out_player_id?: string | null;
  out_player_name?: string | null;
  reason?: string | null;
}

export interface LineupPlayer {
  id?: string;
  player_id: string;
  player_name: string | null;
  shirt_number: number | null;
  position: string | null;
  is_starter: boolean;
  x_position?: number | null;
  y_position?: number | null;
  rating?: number | null;
  is_captain?: boolean;
}

export interface MatchLineup {
  home: LineupPlayer[];
  away: LineupPlayer[];
  home_formation: string | null;
  away_formation: string | null;
  home_subs?: LineupPlayer[];
  away_subs?: LineupPlayer[];
}

export interface H2HMatch {
  id: string;
  match_time: number;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
  home_score: number;
  away_score: number;
}

export interface H2HData {
  summary: {
    total: number;
    homeWins: number;
    draws: number;
    awayWins: number;
  };
  h2hMatches: H2HMatch[];
  homeRecentForm: H2HMatch[];
  awayRecentForm: H2HMatch[];
}

// TrendPoint supports both legacy format (detailed stats) and new API format (intensity values)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrendPoint = any;
// Legacy format had: minute, home_possession, away_possession, home_attacks, etc.
// New API format has: first_half: number[], second_half: number[], overtime?: number[]

export interface Standing {
  position: number;
  team_id: string;
  team_name: string;
  team_logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

// ============================================
// CONTEXT
// ============================================

interface MatchDetailContextValue {
  matchId: string;
  match: MatchData | null;
  stats: MatchStat[];
  incidents: MatchIncident[];
  lineup: MatchLineup | null;
  h2h: H2HData | null;
  trend: TrendPoint[];
  standings: Standing[];
  loading: boolean;
  error: string | null;
  // Partial loading states
  statsLoading: boolean;
  incidentsLoading: boolean;
  lineupLoading: boolean;
  h2hLoading: boolean;
  trendLoading: boolean;
  standingsLoading: boolean;
  // Actions
  refreshData: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshIncidents: () => Promise<void>;
}

const MatchDetailContext = createContext<MatchDetailContextValue | null>(null);

export function useMatchDetail() {
  const context = useContext(MatchDetailContext);
  if (!context) {
    throw new Error('useMatchDetail must be used within MatchDetailProvider');
  }
  return context;
}

// ============================================
// PROVIDER
// ============================================

interface MatchDetailProviderProps {
  matchId: string;
  children: ReactNode;
}

export function MatchDetailProvider({ matchId, children }: MatchDetailProviderProps) {
  // Core data
  const [match, setMatch] = useState<MatchData | null>(null);
  const [stats, setStats] = useState<MatchStat[]>([]);
  const [incidents, setIncidents] = useState<MatchIncident[]>([]);
  const [lineup, setLineup] = useState<MatchLineup | null>(null);
  const [h2h, setH2h] = useState<H2HData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lineupLoading, _setLineupLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [h2hLoading, _setH2hLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [trendLoading, _setTrendLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [standingsLoading, _setStandingsLoading] = useState(false);

  // Auto-refresh interval for live matches
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PERF FIX Phase 2: Single unified API call instead of 6 separate calls
  // This reduces total load time from ~3-5s to ~500ms-1s
  const fetchData = useCallback(async () => {
    if (!matchId) return;

    setLoading(true);
    setError(null);

    try {
      // Single API call that returns all data
      const data = await getMatchFull(matchId);

      // Set match data
      if (data.match) {
        setMatch(data.match as unknown as MatchData);
      }

      // Set stats
      setStats(data.stats || []);

      // Set incidents (normalize format)
      const rawIncidents = data.incidents || [];
      setIncidents(rawIncidents.map((inc: any) => ({
        ...inc,
        incident_type: inc.incident_type || getIncidentTypeName(inc.type),
        team: inc.team || (inc.position === 1 ? 'home' : 'away'),
      })));

      // Set lineup
      if (data.lineup) {
        setLineup({
          home: data.lineup.home || [],
          away: data.lineup.away || [],
          home_formation: data.lineup.home_formation || null,
          away_formation: data.lineup.away_formation || null,
          home_subs: data.lineup.home_subs || [],
          away_subs: data.lineup.away_subs || [],
        });
      } else {
        setLineup(null);
      }

      // Set H2H
      setH2h(data.h2h || null);

      // Set trend - can be array or object with first_half/second_half
      // Pass as-is, TrendTab handles both formats
      if (data.trend) {
        const trendData = data.trend as any;
        // If it's an object with first_half/second_half, wrap in array for consistency
        if (!Array.isArray(trendData) && (trendData.first_half || trendData.second_half)) {
          setTrend([trendData]);
        } else {
          setTrend(Array.isArray(trendData) ? trendData : [trendData]);
        }
      } else {
        setTrend([]);
      }

      // Set standings
      setStandings(data.standings || []);

    } catch (err: any) {
      setError(err.message || 'Maç bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // Refresh stats only (for live updates)
  const refreshStats = useCallback(async () => {
    if (!matchId) return;

    setStatsLoading(true);
    try {
      const statsData = await getMatchLiveStats(matchId);
      setStats(statsData?.stats || statsData?.fullTime?.stats || []);
    } catch {
      // Silent fail for background refresh
    } finally {
      setStatsLoading(false);
    }
  }, [matchId]);

  // Refresh incidents only (for live updates)
  const refreshIncidents = useCallback(async () => {
    if (!matchId) return;

    setIncidentsLoading(true);
    try {
      const incidentsData = await getMatchIncidents(matchId);
      const rawIncidents = incidentsData?.incidents || [];
      setIncidents(rawIncidents.map((inc: any) => ({
        ...inc,
        incident_type: inc.incident_type || getIncidentTypeName(inc.type),
        team: inc.team || (inc.position === 1 ? 'home' : 'away'),
      })));
    } catch {
      // Silent fail for background refresh
    } finally {
      setIncidentsLoading(false);
    }
  }, [matchId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh for live matches (every 60 seconds)
  // PERF FIX: Increased from 30s to 60s, fixed dependency array to prevent infinite loops
  useEffect(() => {
    // Clear previous interval first
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    const isLive = match && [2, 3, 4, 5, 7].includes(match.status_id);

    if (isLive) {
      // 60 seconds - WebSocket provides real-time updates
      refreshIntervalRef.current = setInterval(() => {
        refreshStats();
        refreshIncidents();
      }, 60000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [match?.status_id]); // Only re-run when status changes, not on every callback reference change

  const value: MatchDetailContextValue = {
    matchId,
    match,
    stats,
    incidents,
    lineup,
    h2h,
    trend,
    standings,
    loading,
    error,
    statsLoading,
    incidentsLoading,
    lineupLoading,
    h2hLoading,
    trendLoading,
    standingsLoading,
    refreshData: fetchData,
    refreshStats,
    refreshIncidents,
  };

  return (
    <MatchDetailContext.Provider value={value}>
      {children}
    </MatchDetailContext.Provider>
  );
}

// Helper to convert incident type number to name
// SYNC: Must match backend EVENT_TYPES in IncidentOrchestrator.ts
function getIncidentTypeName(type: number): string {
  const typeMap: Record<number, string> = {
    1: 'goal',
    2: 'corner',
    3: 'yellow_card',
    4: 'red_card',
    5: 'offside',
    6: 'free_kick',
    7: 'goal_kick',
    8: 'penalty_goal',
    9: 'substitution',
    10: 'match_start',
    11: 'second_half_start',
    12: 'match_end',
    13: 'halftime_score',
    15: 'second_yellow',
    16: 'penalty_miss',
    17: 'own_goal',
    19: 'injury_time',
    28: 'var',
    29: 'penalty_shootout',
    30: 'penalty_shootout_miss',
    34: 'shot_on_post',
  };
  return typeMap[type] || `unknown_${type}`;
}

export { MatchDetailContext };
