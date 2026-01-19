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
  getMatchById,
  getMatchLiveStats,
  getMatchIncidents,
  getMatchLineup,
  getMatchH2H,
  getMatchTrend,
  getSeasonStandings,
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

export interface TrendPoint {
  minute: number;
  home_possession?: number;
  away_possession?: number;
  home_attacks?: number;
  away_attacks?: number;
  home_dangerous_attacks?: number;
  away_dangerous_attacks?: number;
  home_shots?: number;
  away_shots?: number;
  home_shots_on_target?: number;
  away_shots_on_target?: number;
  home_corners?: number;
  away_corners?: number;
}

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
  const [lineupLoading, setLineupLoading] = useState(false);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Auto-refresh interval for live matches
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch all data in parallel (eager loading)
  const fetchData = useCallback(async () => {
    if (!matchId) return;

    setLoading(true);
    setError(null);

    try {
      // Phase 1: Fetch critical match data first
      const matchData = await getMatchById(matchId);
      setMatch(matchData);

      // Phase 2: Fetch all secondary data in parallel
      const [statsData, incidentsData, lineupData, h2hData, trendData] = await Promise.all([
        getMatchLiveStats(matchId).catch(() => ({ stats: [] })),
        getMatchIncidents(matchId).catch(() => ({ incidents: [] })),
        getMatchLineup(matchId).catch(() => null),
        getMatchH2H(matchId).catch(() => null),
        getMatchTrend(matchId).catch(() => ({ results: [] })),
      ]);

      // Set stats
      setStats(statsData?.stats || statsData?.fullTime?.stats || []);

      // Set incidents (normalize format)
      const rawIncidents = incidentsData?.incidents || [];
      setIncidents(rawIncidents.map((inc: any) => ({
        ...inc,
        incident_type: inc.incident_type || getIncidentTypeName(inc.type),
        team: inc.team || (inc.position === 1 ? 'home' : 'away'),
      })));

      // Set lineup
      if (lineupData?.data?.results) {
        const results = lineupData.data.results;
        setLineup({
          home: results.home_lineup || results.home || [],
          away: results.away_lineup || results.away || [],
          home_formation: results.home_formation || null,
          away_formation: results.away_formation || null,
          home_subs: results.home_subs || [],
          away_subs: results.away_subs || [],
        });
      } else {
        setLineup(null);
      }

      // Set H2H
      setH2h(h2hData?.data || null);

      // Set trend
      const trendResults = trendData?.results || trendData?.data?.results || [];
      setTrend(Array.isArray(trendResults) ? trendResults : []);

      // Fetch standings if we have season_id
      if (matchData?.season_id) {
        try {
          const standingsData = await getSeasonStandings(matchData.season_id);
          setStandings(standingsData?.standings || []);
        } catch {
          setStandings([]);
        }
      }
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

  // Auto-refresh for live matches (every 30 seconds)
  useEffect(() => {
    const isLive = match && [2, 3, 4, 5, 7].includes(match.status_id);

    if (isLive) {
      refreshIntervalRef.current = setInterval(() => {
        refreshStats();
        refreshIncidents();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [match?.status_id, refreshStats, refreshIncidents]);

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
function getIncidentTypeName(type: number): string {
  const typeMap: Record<number, string> = {
    1: 'goal',
    2: 'penalty_goal',
    3: 'own_goal',
    4: 'penalty_miss',
    5: 'yellow_card',
    6: 'red_card',
    7: 'substitution',
    8: 'second_yellow',
    9: 'var',
    10: 'penalty_awarded',
  };
  return typeMap[type] || `type_${type}`;
}

export { MatchDetailContext };
