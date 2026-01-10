/**
 * Match Detail Page - SIMPLIFIED VERSION
 *
 * Single-page component with:
 * - Query param routing (?tab=stats)
 * - Eager loading (all data fetched upfront)
 * - Flat state (no Context)
 * - WebSocket for score updates only
 * - Props-based tab components
 */

import { useEffect, useState } from 'react';
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

  // Flat state - simple, no Context
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any>(null);
  const [h2h, setH2h] = useState<any>(null);
  const [standings, setStandings] = useState<any>(null);
  const [lineup, setLineup] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);

  // Eager load ALL data on mount
  useEffect(() => {
    if (!matchId) return;

    const loadAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        // First fetch match to get season_id
        const matchResult = await getMatchById(matchId);
        setMatch(matchResult);

        // Then fetch all other data in parallel - BASIT!
        const results = await Promise.allSettled([
          getMatchLiveStats(matchId),
          getMatchHalfStats(matchId),
          fetch(`/api/matches/${matchId}/incidents`).then(r => r.json()),
          getMatchH2H(matchId),
          matchResult.season_id ? getSeasonStandings(matchResult.season_id) : Promise.resolve(null),
          getMatchLineup(matchId),
          getMatchTrend(matchId),
          fetch(`/api/predictions/match/${matchId}`).then(r => r.json()),
        ]);

        // Extract data
        const [liveStatsRes, halfStatsRes, eventsRes, h2hRes, standingsRes, lineupRes, trendRes, aiRes] = results;

        // Set stats (combine fullTime and halfTime)
        if (liveStatsRes.status === 'fulfilled' && halfStatsRes.status === 'fulfilled') {
          setStats({
            fullTime: liveStatsRes.value,
            halfTime: halfStatsRes.value,
            firstHalfStats: halfStatsRes.value?.firstHalfStats || null,
            secondHalfStats: halfStatsRes.value?.secondHalfStats || null,
          });
        } else if (liveStatsRes.status === 'fulfilled') {
          setStats({
            fullTime: liveStatsRes.value,
            halfTime: null,
            firstHalfStats: null,
            secondHalfStats: null,
          });
        }

        // Set events
        if (eventsRes.status === 'fulfilled') {
          const eventsData = eventsRes.value;
          setEvents(eventsData?.data || eventsData?.incidents || []);
        }

        // Set H2H
        if (h2hRes.status === 'fulfilled') {
          setH2h(h2hRes.value);
        }

        // Set standings
        if (standingsRes.status === 'fulfilled') {
          setStandings(standingsRes.value);
        }

        // Set lineup
        if (lineupRes.status === 'fulfilled') {
          setLineup(lineupRes.value);
        }

        // Set trend
        if (trendRes.status === 'fulfilled') {
          setTrend(trendRes.value);
        }

        // Set AI predictions
        if (aiRes.status === 'fulfilled') {
          const aiData = aiRes.value;
          setAi(aiData?.data || aiData);
        }
      } catch (err: any) {
        console.error('Failed to load match data:', err);
        setError(err.message || 'Maç verileri yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [matchId]); // SADECE matchId değişince - SONSUZ DÖNGÜ YOK!

  // WebSocket - SADECE skor update
  useMatchSocket(matchId || '', {
    onScoreChange: (event) => {
      setMatch(
        (prev) =>
          prev
            ? {
                ...prev,
                home_score: event.homeScore,
                away_score: event.awayScore,
              }
            : null
      );
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
          <p className="text-gray-600 text-lg">Maç bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Hata</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/livescore/diary"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  // Not found state
  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-gray-400 text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Maç Bulunamadı</h2>
          <p className="text-gray-600 mb-6">Bu maç bulunamadı veya silinmiş olabilir.</p>
          <Link
            to="/livescore/diary"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  const matchStatus = (match as any).status ?? (match as any).status_id ?? 1;
  const isLive = [2, 3, 4, 5, 7].includes(matchStatus);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Match Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Competition Info */}
          {match.competition && (
            <div className="flex items-center gap-2 mb-4 text-blue-100">
              {match.competition.logo_url && (
                <img src={match.competition.logo_url} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-sm font-medium">{match.competition.name}</span>
              {isLive && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                  CANLI
                </span>
              )}
            </div>
          )}

          {/* Teams and Score */}
          <div className="flex items-center justify-between gap-6">
            {/* Home Team */}
            <div className="flex-1 flex flex-col items-center">
              {match.home_team?.logo_url && (
                <img src={match.home_team.logo_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-2" />
              )}
              <h2 className="text-lg sm:text-xl font-bold text-center">{match.home_team?.name || 'Ev Sahibi'}</h2>
            </div>

            {/* Score */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-4xl sm:text-5xl font-bold">{match.home_score ?? 0}</div>
              <div className="text-2xl sm:text-3xl font-light opacity-60">-</div>
              <div className="text-4xl sm:text-5xl font-bold">{match.away_score ?? 0}</div>
            </div>

            {/* Away Team */}
            <div className="flex-1 flex flex-col items-center">
              {match.away_team?.logo_url && (
                <img src={match.away_team.logo_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-2" />
              )}
              <h2 className="text-lg sm:text-xl font-bold text-center">{match.away_team?.name || 'Deplasman'}</h2>
            </div>
          </div>

          {/* Match Time/Status */}
          <div className="text-center mt-4">
            <p className="text-blue-100 text-sm">
              {new Date((match.match_time || 0) * 1000).toLocaleString('tr-TR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          {activeTab === 'stats' && <StatsTab data={stats} match={match} />}
          {activeTab === 'events' && <EventsTab data={events} match={match} />}
          {activeTab === 'h2h' && <H2HTab data={h2h} match={match} />}
          {activeTab === 'standings' && <StandingsTab data={standings} match={match} />}
          {activeTab === 'lineup' && <LineupTab data={lineup} match={match} />}
          {activeTab === 'trend' && <TrendTab data={trend} match={match} />}
          {activeTab === 'ai' && <AITab data={ai} match={match} />}
        </div>
      </div>
    </div>
  );
}

export default MatchDetailPage;
