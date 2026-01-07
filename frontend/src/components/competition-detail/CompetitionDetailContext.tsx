/**
 * Competition Detail Context
 *
 * Provides shared state for all competition detail tabs.
 * Fetches league data, standings, and fixtures in parallel (eager loading).
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getLeagueById, getLeagueFixtures, getLeagueStandings } from '../../api/matches';

// Types
export interface CompetitionData {
  id: string;
  external_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country_id: string | null;
  country_name: string | null;
  category_id: string | null;
}

export interface Standing {
  position: number;
  team_id: string;
  team_name: string;
  team_logo: string | null;
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
  round: string | null;
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
}

interface CompetitionDetailContextValue {
  competitionId: string;
  league: CompetitionData | null;
  standings: Standing[];
  fixtures: FixtureMatch[];
  upcomingMatches: FixtureMatch[];
  pastMatches: FixtureMatch[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const CompetitionDetailContext = createContext<CompetitionDetailContextValue | null>(null);

export function useCompetitionDetail() {
  const context = useContext(CompetitionDetailContext);
  if (!context) {
    throw new Error('useCompetitionDetail must be used within CompetitionDetailProvider');
  }
  return context;
}

interface CompetitionDetailProviderProps {
  competitionId: string;
  children: ReactNode;
}

export function CompetitionDetailProvider({ competitionId, children }: CompetitionDetailProviderProps) {
  const [league, setLeague] = useState<CompetitionData | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!competitionId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel (eager loading)
      const [leagueData, standingsData, fixturesData] = await Promise.all([
        getLeagueById(competitionId),
        getLeagueStandings(competitionId).catch(() => ({ standings: [] })),
        getLeagueFixtures(competitionId, { limit: 100 }).catch(() => ({ fixtures: [] })),
      ]);

      setLeague(leagueData.league);
      setStandings(standingsData.standings || []);
      setFixtures(fixturesData.fixtures || []);
    } catch (err: any) {
      setError(err.message || 'Lig bilgileri yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute upcoming and past matches
  const upcomingMatches = fixtures
    .filter(m => m.status_id !== 8)
    .sort((a, b) => a.match_time - b.match_time);

  const pastMatches = fixtures.filter(m => m.status_id === 8);

  const value: CompetitionDetailContextValue = {
    competitionId,
    league,
    standings,
    fixtures,
    upcomingMatches,
    pastMatches,
    loading,
    error,
    refreshData: fetchData,
  };

  return (
    <CompetitionDetailContext.Provider value={value}>
      {children}
    </CompetitionDetailContext.Provider>
  );
}

export { CompetitionDetailContext };
