/**
 * Team Detail Context
 *
 * Provides shared state for all team detail tabs.
 * Fetches team data, standings, fixtures, and players in parallel (eager loading).
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getTeamById, getTeamFixtures, getTeamStandings, getPlayersByTeam } from '../../api/matches';

// Types
export interface TeamData {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country_id: string | null;
  competition: {
    external_id: string;
    name: string;
    logo_url: string | null;
  } | null;
  current_season_id: string | null;
  recent_form: Array<{
    match_id: string;
    result: 'W' | 'D' | 'L';
    score: string;
    opponent: string;
    isHome: boolean;
    date: string;
  }>;
}

export interface Standing {
  position: number;
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export interface FixtureMatch {
  id: string;
  match_time: number;
  status_id: number;
  home_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  away_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  is_home: boolean;
}

export interface Player {
  external_id: string;
  name: string;
  short_name: string | null;
  logo: string | null;
  position: string | null;
  shirt_number: number | null;
  age: number | null;
  nationality: string | null;
  market_value: number | null;
  market_value_currency: string | null;
  season_stats: any;
}

interface TeamDetailContextValue {
  teamId: string;
  team: TeamData | null;
  standing: Standing | null;
  allStandings: Standing[];
  fixtures: {
    past_matches: FixtureMatch[];
    upcoming_matches: FixtureMatch[];
  } | null;
  players: Player[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const TeamDetailContext = createContext<TeamDetailContextValue | null>(null);

export function useTeamDetail() {
  const context = useContext(TeamDetailContext);
  if (!context) {
    throw new Error('useTeamDetail must be used within TeamDetailProvider');
  }
  return context;
}

interface TeamDetailProviderProps {
  teamId: string;
  children: ReactNode;
}

export function TeamDetailProvider({ teamId, children }: TeamDetailProviderProps) {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [allStandings, setAllStandings] = useState<Standing[]>([]);
  const [fixtures, setFixtures] = useState<{
    past_matches: FixtureMatch[];
    upcoming_matches: FixtureMatch[];
  } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!teamId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel (eager loading)
      const [teamData, standingsData, fixturesData, playersData] = await Promise.all([
        getTeamById(teamId),
        getTeamStandings(teamId).catch(() => null),
        getTeamFixtures(teamId).catch(() => null),
        getPlayersByTeam(teamId).catch(() => ({ players: [] })),
      ]);

      setTeam(teamData);
      setStanding(standingsData?.standing || null);
      setAllStandings(standingsData?.standings || []);
      setFixtures(fixturesData ? {
        past_matches: fixturesData.past_matches || [],
        upcoming_matches: fixturesData.upcoming_matches || [],
      } : null);
      setPlayers(playersData?.players || []);
    } catch (err: any) {
      setError(err.message || 'Takim bilgileri yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const value: TeamDetailContextValue = {
    teamId,
    team,
    standing,
    allStandings,
    fixtures,
    players,
    loading,
    error,
    refreshData: fetchData,
  };

  return (
    <TeamDetailContext.Provider value={value}>
      {children}
    </TeamDetailContext.Provider>
  );
}

export { TeamDetailContext };
