/**
 * Match Detail Page
 *
 * Uses MatchDetailProvider for data management.
 * All tab data is handled by the context.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getMatchById } from '../api/matches';
import type { Match } from '../api/matches';
import { useMatchSocket } from '../hooks/useSocket';

// Import tab components and context
import { MatchDetailProvider } from '../components/match-detail/MatchDetailContext';
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

  // Loading state for initial match fetch (header only)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);

  // Load match info for header
  useEffect(() => {
    if (!matchId) return;

    const loadMatch = async () => {
      setLoading(true);
      setError(null);

      try {
        const matchResult = await getMatchById(matchId);
        setMatch(matchResult);
      } catch (err: any) {
        console.error('Failed to load match data:', err);
        setError(err.message || 'Maç verileri yüklenirken bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    loadMatch();
  }, [matchId]);

  // Track last score update timestamp to prevent stale updates
  const lastScoreUpdateRef = useRef<number>(0);

  // WebSocket for real-time score updates
  useMatchSocket(matchId || '', {
    onScoreChange: (event) => {
      if (!match) return;

      if (event.timestamp && event.timestamp <= lastScoreUpdateRef.current) {
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
  if (!match || !matchId) {
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
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content - Wrapped with MatchDetailProvider */}
      <MatchDetailProvider matchId={matchId}>
        <div className="max-w-7xl mx-auto px-4 pb-8">
          {activeTab === 'stats' && <StatsTab />}
          {activeTab === 'events' && <EventsTab />}
          {activeTab === 'h2h' && <H2HTab />}
          {activeTab === 'standings' && <StandingsTab />}
          {activeTab === 'lineup' && <LineupTab />}
          {activeTab === 'trend' && <TrendTab />}
          {activeTab === 'ai' && <AITab />}
        </div>
      </MatchDetailProvider>
    </div>
  );
}

export default MatchDetailPage;
