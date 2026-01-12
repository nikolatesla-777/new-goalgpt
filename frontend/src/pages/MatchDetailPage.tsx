/**
 * Match Detail Page - LAZY LOADING VERSION (PERFORMANCE OPTIMIZED)
 *
 * CRITICAL CHANGE: Only load data for the ACTIVE tab
 * - Initial load: Match info + Stats + Events (fast endpoints)
 * - Tab switch: Load that tab's data on-demand
 * - No more 50-second wait for ALL data!
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  getMatchById,
  getMatchLiveStats,
  getMatchHalfStats,
  getMatchH2H,
  getSeasonStandings,
  getMatchLineup,
  getMatchTrend,
} from '../api/matches';
import type { Match } from '../api/matches';
import { useMatchSocket } from '../hooks/useSocket';

// Import tab components
import StatsTab from '../components/match-detail/tabs/StatsTab';
import EventsTab from '../components/match-detail/tabs/EventsTab';
import H2HTab from '../components/match-detail/tabs/H2HTab';
import StandingsTab from '../components/match-detail/tabs/StandingsTab';
import LineupTab from '../components/match-detail/tabs/LineupTab';
import TrendTab from '../components/match-detail/tabs/TrendTab';
import AITab from '../components/match-detail/tabs/AITab';

type TabId = 'stats' | 'events' | 'h2h' | 'standings' | 'lineup' | 'trend' | 'ai';

const TABS: { id: TabId; label: string }[] = [
  { id: 'stats', label: 'İstatistikler' },
  { id: 'events', label: 'Olaylar' },
  { id: 'h2h', label: 'H2H' },
  { id: 'standings', label: 'Puan Durumu' },
  { id: 'lineup', label: 'Kadro' },
  { id: 'trend', label: 'Trend' },
  { id: 'ai', label: 'AI Tahminler' },
];

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'stats';

  // Initial loading state (only for match + stats + events)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Match + Stats (loaded immediately)
  const [match, setMatch] = useState<Match | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any>(null);

  // Tab-specific data (lazy loaded)
  const [h2h, setH2h] = useState<any>(null);
  const [standings, setStandings] = useState<any>(null);
  const [lineup, setLineup] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);

  // Tab loading states
  const [tabLoading, setTabLoading] = useState<Record<TabId, boolean>>({
    stats: false,
    events: false,
    h2h: false,
    standings: false,
    lineup: false,
    trend: false,
    ai: false,
  });

  // PERFORMANCE FIX: Load ONLY essential data on mount (match + stats + events)
  // These are fast endpoints (~500ms each)
  useEffect(() => {
    if (!matchId) return;

    const loadInitialData = async () => {
      // Step 1: Fetch BASIC match info first (render Header immediately)
      // Do NOT set global loading=true here if we already have match data (e.g. from nav)
      if (!match) setLoading(true);
      setError(null);

      try {
        // Fetch match first to get season_id and header info
        const matchResult = await getMatchById(matchId);
        setMatch(matchResult);

        // Only turn off GLOBAL loading here - the page is now usable
        setLoading(false);

        // Step 2: Fetch Stats & Events in background (Lazy Load)
        // These are heavy and shouldn't block the UI
        setTabLoading(prev => ({ ...prev, stats: true, events: true }));

        const results = await Promise.allSettled([
          getMatchLiveStats(matchId),
          getMatchHalfStats(matchId),
          fetch(`/api/matches/${matchId}/incidents`).then(r => r.json()),
        ]);

        const [liveStatsRes, halfStatsRes, eventsRes] = results;

        // Set stats
        if (liveStatsRes.status === 'fulfilled' && halfStatsRes.status === 'fulfilled') {
          setStats({
            fullTime: liveStatsRes.value,
            halfTime: halfStatsRes.value,
            firstHalfStats: halfStatsRes.value?.firstHalfStats || null,
            secondHalfStats: halfStatsRes.value?.secondHalfStats || null,
          });
        } else if (liveStatsRes.status === 'fulfilled') {
          // Fallback if half-stats fails
          setStats({
            fullTime: liveStatsRes.value,
            halfTime: null,
            firstHalfStats: null,
            secondHalfStats: null,
          });
        }

        // Set events - CRITICAL FIX: API returns {success, data: {incidents: []}}
        // Must extract the nested incidents array, not the data object
        if (eventsRes.status === 'fulfilled') {
          const eventsData = eventsRes.value;
          // Handle all possible response structures:
          // 1. {data: {incidents: []}} - current API format
          // 2. {data: {results: []}} - alternative format
          // 3. {incidents: []} - flat format
          // 4. {data: []} - array directly in data
          const incidents =
            eventsData?.data?.incidents ||  // nested incidents array
            eventsData?.data?.results ||    // nested results array
            (Array.isArray(eventsData?.data) ? eventsData.data : null) || // data is array
            eventsData?.incidents ||        // flat incidents
            eventsData?.results ||          // flat results
            [];
          setEvents(incidents);
          console.log(`[MatchDetail] Set ${incidents.length} events from API`);
        }
      } catch (err: any) {
        console.error('Failed to load match data:', err);
        setError(err.message || 'Maç verileri yüklenirken bir hata oluştu');
      } finally {
        setLoading(false); // Ensure loading is off even if error
        setTabLoading(prev => ({ ...prev, stats: false, events: false }));
      }
    };

    loadInitialData();
  }, [matchId]);

  // PERFORMANCE FIX: Lazy load tab data ONLY when tab becomes active
  // This prevents loading 48s+ endpoints (trend, incidents) upfront
  useEffect(() => {
    if (!matchId || !match) return;

    // Helper function to wrap API calls with timeout
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T | null> => {
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      );
      try {
        return await Promise.race([promise, timeoutPromise]) as T;
      } catch (err: any) {
        console.error(`[MatchDetail] Request timed out: ${err.message}`);
        return null;
      }
    };

    const loadTabData = async () => {
      try {
        switch (activeTab) {
          case 'h2h':
            if (!h2h) {
              setTabLoading(prev => ({ ...prev, h2h: true }));
              const data = await withTimeout(getMatchH2H(matchId));
              setH2h(data);
              setTabLoading(prev => ({ ...prev, h2h: false }));
            }
            break;

          case 'standings':
            if (!standings && match.season_id) {
              setTabLoading(prev => ({ ...prev, standings: true }));
              const data = await withTimeout(getSeasonStandings(match.season_id));
              setStandings(data);
              setTabLoading(prev => ({ ...prev, standings: false }));
            }
            break;

          case 'lineup':
            if (!lineup) {
              setTabLoading(prev => ({ ...prev, lineup: true }));
              // CRITICAL: Add 10s timeout to prevent infinite loading
              const data = await withTimeout(getMatchLineup(matchId), 10000);
              setLineup(data);
              setTabLoading(prev => ({ ...prev, lineup: false }));
            }
            break;

          case 'trend':
            if (!trend) {
              setTabLoading(prev => ({ ...prev, trend: true }));
              // CRITICAL: Add 10s timeout to prevent infinite loading
              const data = await withTimeout(getMatchTrend(matchId), 10000);
              setTrend(data);
              setTabLoading(prev => ({ ...prev, trend: false }));
            }
            break;

          case 'ai':
            if (!ai) {
              setTabLoading(prev => ({ ...prev, ai: true }));
              const response = await fetch(`/api/predictions/match/${matchId}`);
              const aiData = await response.json();
              setAi(aiData?.data || aiData);
              setTabLoading(prev => ({ ...prev, ai: false }));
            }
            break;
        }
      } catch (err) {
        console.error(`Failed to load ${activeTab} data:`, err);
        setTabLoading(prev => ({ ...prev, [activeTab]: false }));
      }
    };

    loadTabData();
  }, [activeTab, matchId, match, h2h, standings, lineup, trend, ai]);

  // Track last score update timestamp to prevent stale updates
  const lastScoreUpdateRef = useRef<number>(0);

  // WebSocket for real-time score updates with timestamp validation
  useMatchSocket(matchId || '', {
    onScoreChange: (event) => {
      if (!match) return;

      // CRITICAL: Only apply update if it's newer than the last one
      // This prevents stale WebSocket events from overwriting current scores
      if (event.timestamp && event.timestamp <= lastScoreUpdateRef.current) {
        console.log(`[MatchDetail] Ignoring stale score update: ${event.homeScore}-${event.awayScore} (ts=${event.timestamp}, lastTs=${lastScoreUpdateRef.current})`);
        return;
      }

      lastScoreUpdateRef.current = event.timestamp || Date.now();
      setMatch(prev => prev ? {
        ...prev,
        home_score: event.homeScore,
        away_score: event.awayScore,
      } : null);
    },
  });

  // Tab change handler
  const handleTabChange = (tab: TabId) => {
    setSearchParams({ tab });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Maç yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bir hata oluştu</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  // No match found
  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Maç bulunamadı</h2>
          <p className="text-gray-600 mb-4">Bu maç mevcut değil veya silinmiş.</p>
          <Link to="/" className="text-blue-600 hover:underline">
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Match Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            {/* Home Team */}
            <div className="flex items-center gap-3 flex-1">
              {match.home_team?.logo_url && (
                <img
                  src={match.home_team.logo_url}
                  alt={match.home_team.name}
                  className="w-12 h-12 object-contain"
                />
              )}
              <div className="text-right">
                <div className="font-bold text-xl text-gray-900">{match.home_team?.name}</div>
              </div>
            </div>

            {/* Score */}
            <div className="text-center px-6">
              <div className="text-4xl font-bold text-gray-900">
                {match.home_score ?? 0} - {match.away_score ?? 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {match.minute_text || 'Başlamadı'}
              </div>
            </div>

            {/* Away Team */}
            <div className="flex items-center gap-3 flex-1">
              <div className="text-left">
                <div className="font-bold text-xl text-gray-900">{match.away_team?.name}</div>
              </div>
              {match.away_team?.logo_url && (
                <img
                  src={match.away_team.logo_url}
                  alt={match.away_team.name}
                  className="w-12 h-12 object-contain"
                />
              )}
            </div>
          </div>

          {/* Competition Info */}
          <div className="text-center mt-4 text-sm text-gray-600">
            {match.competition?.name}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                {tab.label}
                {tabLoading[tab.id] && (
                  <span className="ml-2 inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === 'stats' && <StatsTab data={stats} match={match} />}
        {activeTab === 'events' && <EventsTab data={events} match={match} />}
        {activeTab === 'h2h' && (
          tabLoading.h2h ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">H2H verileri yükleniyor...</p>
            </div>
          ) : (
            <H2HTab data={h2h} match={match} />
          )
        )}
        {activeTab === 'standings' && (
          tabLoading.standings ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Puan durumu yükleniyor...</p>
            </div>
          ) : (
            <StandingsTab data={standings} match={match} />
          )
        )}
        {activeTab === 'lineup' && (
          tabLoading.lineup ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Kadro yükleniyor...</p>
            </div>
          ) : (
            <LineupTab data={lineup} match={match} />
          )
        )}
        {activeTab === 'trend' && (
          tabLoading.trend ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Trend verileri yükleniyor... (Bu biraz sürebilir)</p>
            </div>
          ) : (
            <TrendTab data={trend} match={match} />
          )
        )}
        {activeTab === 'ai' && (
          tabLoading.ai ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">AI tahminler yükleniyor...</p>
            </div>
          ) : (
            <AITab data={ai} match={match} />
          )
        )}
      </div>
    </div>
  );
}

export default MatchDetailPage;
