/**
 * Match Detail Page
 * 
 * Full page component for displaying detailed match information
 * Accessed via /match/:matchId route
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getMatchH2H,
    getMatchTeamStats,
    getMatchLiveStats,
    getMatchLineup,
    getSeasonStandings,
    getMatchTrend,
    getLiveMatches,
    getMatchDetailLive,
    getMatchHalfStats,
    getMatchById,
} from '../../api/matches';
import type { Match } from '../../api/matches';
import { MatchTrendChart } from './MatchTrendChart';
import { MatchEventsTimeline } from './MatchEventsTimeline';
import { ChartBar, ListBullets, Sword, Trophy, Users, TrendUp, Robot, CaretLeft, WarningCircle } from '@phosphor-icons/react';
import { useMatchSocket } from '../../hooks/useSocket';

import { useAIPredictions } from '../../context/AIPredictionsContext';

type TabType = 'ai' | 'stats' | 'h2h' | 'standings' | 'lineup' | 'trend' | 'events';

export function MatchDetailPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();

    const [match, setMatch] = useState<Match | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('stats');
    const [loading, setLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabData, setTabData] = useState<any>(null);
    const hasLoadedRef = useRef(false);
    const tabDataLoadedRef = useRef<{ tab: TabType; matchId: string } | null>(null); // Track which tab+matchId has been loaded
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // For WebSocket event debouncing
    const isFetchingRef = useRef(false); // Prevent overlapping requests



    // Fetch match info with periodic polling for live matches
    // CRITICAL FIX: Prefer getLiveMatches for live matches (more up-to-date)
    // getMatchById is fallback for finished/upcoming matches
    useEffect(() => {
        const fetchMatch = async () => {
            if (!matchId) return;

            // Only show loading on initial fetch, not on poll updates
            if (!hasLoadedRef.current) setLoading(true);

            try {
                let foundMatch: Match | undefined;

                // Step 1: Try getLiveMatches first (most up-to-date for live matches)
                // This ensures we get the latest status for live matches
                try {
                    const liveResponse = await getLiveMatches();
                    foundMatch = liveResponse.results?.find((m: Match) => m.id === matchId);
                } catch (error: any) {
                    // Live endpoint failed, continue to next step
                    console.log('[MatchDetailPage] Live matches endpoint failed, trying getMatchById...');
                }

                // Step 2: If not found in live matches, try getMatchById (works for any date)
                if (!foundMatch) {
                    try {
                        foundMatch = await getMatchById(matchId);
                    } catch (error: any) {
                        // Match not found
                        console.log('[MatchDetailPage] Match not found by ID');
                    }
                }

                // Step 3: If found in both, prefer live matches data (more up-to-date)
                if (foundMatch) {
                    // Double-check: if match is live, prefer live matches data
                    const isLiveStatus = [2, 3, 4, 5, 7].includes((foundMatch as any).status_id ?? 0);
                    if (isLiveStatus) {
                        // Try to get from live matches again to ensure consistency
                        try {
                            const liveResponse = await getLiveMatches();
                            const liveMatch = liveResponse.results?.find((m: Match) => m.id === matchId);
                            if (liveMatch) {
                                foundMatch = liveMatch;  // Prefer live matches data
                            }
                        } catch {
                            // Keep foundMatch
                        }
                    }

                    setMatch(foundMatch);
                    setError(null);
                } else if (!match) {
                    // Only set error if we don't have existing data
                    setError('Maç bulunamadı');
                }
            } catch (err: any) {
                if (!match) {
                    setError(err.message || 'Maç yüklenirken hata oluştu');
                }
            } finally {
                hasLoadedRef.current = true;
                setLoading(false);
            }
        };

        fetchMatch();

        // CRITICAL FIX: Removed polling to prevent screen flickering
        // Real-time updates should come from WebSocket, not polling
        // Polling causes unnecessary re-renders and screen flickering
        // If WebSocket is not available, user can manually refresh the page

        // No polling interval - WebSocket handles real-time updates
    }, [matchId]);

    // Fetch tab data function - extracted to be reusable from WebSocket handlers
    const fetchTabData = useCallback(async (forceRefresh: boolean = false) => {
        if (!matchId) return;

        // CRITICAL FIX: Check if this exact tab+matchId combination has already been loaded
        // This prevents unnecessary refetches when match object reference changes (e.g., WebSocket updates)
        // But allow force refresh from WebSocket events
        if (!forceRefresh && tabDataLoadedRef.current?.tab === activeTab && tabDataLoadedRef.current?.matchId === matchId) {
            // This tab data is already loaded for this match, skip refetch
            // CRITICAL: Don't set loading state or clear data - just return silently
            return;
        }

        // CRITICAL FIX: For standings tab, we need match.season_id, so wait for match to load
        if (activeTab === 'standings' && !match?.season_id) {
            // Don't fetch yet, wait for match to load
            return;
        }

        // Prevent overlapping requests
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        // CRITICAL FIX: Only set loading state when actually fetching NEW data
        // Don't clear existing data until we have new data (prevents flickering)
        setTabLoading(true);
        // DON'T clear tabData here - keep existing data visible while loading new data
        setError(null); // Clear previous errors

        try {
            let result;
            switch (activeTab) {
                case 'stats':
                    // Fetch combined stats (live-stats endpoint includes both basic and detailed stats)
                    // Also fetch half time stats for period selection
                    const [liveStats, halfStats] = await Promise.allSettled([
                        getMatchLiveStats(matchId).catch(() => null), // Fail gracefully, fallback to teamStats
                        getMatchHalfStats(matchId).catch(() => null) // Fail gracefully
                    ]);

                    // If liveStats failed, fallback to teamStats
                    let fullTimeData = null;
                    if (liveStats.status === 'fulfilled' && liveStats.value) {
                        fullTimeData = {
                            stats: liveStats.value.stats || [],
                            incidents: liveStats.value.incidents || [],
                        };
                    } else {
                        // Fallback to getMatchTeamStats
                        try {
                            const teamStats = await getMatchTeamStats(matchId);
                            fullTimeData = teamStats;
                        } catch {
                            fullTimeData = null;
                        }
                    }

                    result = {
                        fullTime: fullTimeData,
                        halfTime: halfStats.status === 'fulfilled' ? halfStats.value : null,
                    };
                    break;
                case 'h2h':
                    result = await getMatchH2H(matchId);
                    break;
                case 'standings':
                    // CRITICAL FIX: Get season_id from match if available, otherwise skip
                    // Don't fail if match is not loaded yet - just return null
                    const seasonId = match?.season_id;
                    if (seasonId) {
                        result = await getSeasonStandings(seasonId);
                    } else {
                        result = null; // No season_id, result stays null
                    }
                    break;
                case 'lineup':
                    result = await getMatchLineup(matchId);
                    break;
                case 'trend':
                    // Fetch both trend and live detail (for incidents/events)
                    // If match is finished, getMatchDetailLive might still return events if available
                    const [trendData, detailLive] = await Promise.all([
                        getMatchTrend(matchId),
                        getMatchDetailLive(matchId).catch(() => ({})) // Fail gracefully
                    ]);
                    result = {
                        trend: trendData,
                        incidents: detailLive?.incidents || []
                    };
                    break;
                case 'events':
                    // Fetch incidents for events timeline
                    // Try detail-live first (for live matches), then fallback to stats (for finished matches)
                    let eventsData = await getMatchDetailLive(matchId).catch(() => ({}));
                    let incidents = eventsData?.incidents || [];

                    // If no incidents from detail-live, try stats endpoint (has historical data)
                    if (incidents.length === 0) {
                        const statsData = await getMatchTeamStats(matchId).catch(() => ({}));
                        incidents = statsData?.incidents || [];
                    }

                    result = { incidents };
                    break;
            }
            // CRITICAL FIX: Only update data if we got a result
            // This prevents clearing existing data if fetch fails
            if (result !== undefined) {
                setTabData(result);
                // Mark this tab+matchId as loaded ONLY after successful fetch
                tabDataLoadedRef.current = { tab: activeTab, matchId: matchId };
            }
        } catch (err: any) {
            console.error('Tab data fetch error:', err);
            setError(err.message || 'Veri yüklenirken hata oluştu');
            // CRITICAL: Don't clear existing data on error - keep showing old data
            // Only clear if this is the first load (tabData is null)
            if (tabData === null) {
                setTabData(null);
            }
        } finally {
            setTabLoading(false);
            isFetchingRef.current = false;
        }
    }, [matchId, activeTab, match?.season_id]);

    // Fetch tab data when tab or matchId changes
    useEffect(() => {
        // CRITICAL FIX: Only fetch if match is available OR if we're fetching data that doesn't need match
        // For events/trend/h2h/lineup, we don't need match object
        // For standings, we need match.season_id, but we handle that gracefully
        if (matchId) {
            fetchTabData(false);
        }
        // CRITICAL FIX: Only refetch when activeTab or matchId changes
        // match object updates (e.g., WebSocket score changes) should NOT trigger refetch
        // We use tabDataLoadedRef to track what's already loaded and prevent unnecessary refetches
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, matchId, match?.season_id]);

    // WebSocket integration for real-time updates

    // Debounced refresh function for tab data
    const refreshTabData = useCallback(() => {
        if (!matchId || isFetchingRef.current) return;

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce tab data refresh (500ms)
        debounceTimerRef.current = setTimeout(() => {
            // Invalidate tabDataLoadedRef to force refresh
            tabDataLoadedRef.current = null;
            fetchTabData(true); // Force refresh from WebSocket
        }, 500);
    }, [matchId, activeTab, fetchTabData]);

    // Debounced refresh function for match info
    const refreshMatchInfo = useCallback(() => {
        if (!matchId) return;

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce match info refresh (500ms)
        debounceTimerRef.current = setTimeout(async () => {
            try {
                // Try to get updated match info from live matches
                const liveResponse = await getLiveMatches();
                const updatedMatch = liveResponse.results?.find((m: Match) => m.id === matchId);
                if (updatedMatch) {
                    setMatch(updatedMatch);
                }
            } catch (error) {
                console.error('[MatchDetailPage] Failed to refresh match info:', error);
            }
        }, 500);
    }, [matchId]);

    // WebSocket event handlers
    useMatchSocket(matchId || '', {
        onScoreChange: (event) => {
            if (!matchId || event.matchId !== matchId) return;

            console.log('[MatchDetailPage] WebSocket score change:', event);

            // Optimistic update: Update match info immediately
            setMatch(prevMatch => {
                if (!prevMatch) return prevMatch;
                return {
                    ...prevMatch,
                    home_score: event.homeScore ?? (prevMatch as any).home_score,
                    away_score: event.awayScore ?? (prevMatch as any).away_score,
                };
            });

            // Refresh match info (debounced)
            refreshMatchInfo();

            // Refresh tab data if events/stats/trend tab is active
            if (['events', 'stats', 'trend'].includes(activeTab)) {
                refreshTabData();
            }
        },
        onMatchStateChange: (event) => {
            if (!matchId || event.matchId !== matchId) return;

            console.log('[MatchDetailPage] WebSocket match state change:', event);

            // Update match status
            setMatch(prevMatch => {
                if (!prevMatch) return prevMatch;
                return {
                    ...prevMatch,
                    status: event.statusId ?? (prevMatch as any).status,
                    status_id: event.statusId ?? (prevMatch as any).status_id,
                };
            });

            // Refresh match info (debounced)
            refreshMatchInfo();

            // Refresh all tab data (status change affects all tabs)
            refreshTabData();
        },
        onAnyEvent: (event) => {
            if (!matchId || event.matchId !== matchId) return;

            console.log('[MatchDetailPage] WebSocket any event:', event);

            // For events tab, refresh immediately
            if (activeTab === 'events') {
                refreshTabData();
            }

            // For stats/trend tabs, refresh if relevant
            if (['stats', 'trend'].includes(activeTab)) {
                refreshTabData();
            }
        },
    });



    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', border: '3px solid #e5e7eb', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                    <p style={{ marginTop: '16px', color: '#6b7280' }}>Maç bilgileri yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <p style={{ color: '#ef4444', marginBottom: '16px' }}>❌ {error || 'Maç bulunamadı'}</p>
                    <button
                        onClick={() => navigate('/')}
                        style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Ana Sayfaya Dön
                    </button>
                </div>
            </div>
        );
    }



    // ... (rest of the component)

    const tabs = [
        { id: 'stats' as TabType, label: 'İstatistikler', Icon: ChartBar },
        { id: 'events' as TabType, label: 'Etkinlikler', Icon: ListBullets },
        { id: 'h2h' as TabType, label: 'H2H', Icon: Sword },
        { id: 'standings' as TabType, label: 'Puan Durumu', Icon: Trophy },
        { id: 'lineup' as TabType, label: 'Kadro', Icon: Users },
        { id: 'trend' as TabType, label: 'Trend', Icon: TrendUp },
    ];

    // Add AI Prediction tab as first item
    const allTabs = [
        { id: 'ai' as any, label: 'AI TAHMİN', Icon: Robot },
        ...tabs
    ];


    return (
        <div className="min-h-screen bg-gray-50 pb-safe">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 sticky top-0 z-30 shadow-md">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <CaretLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <p className="text-sm text-gray-400 font-medium">
                            {match.competition?.name || 'Lig'}
                        </p>
                    </div>
                </div>
            </header>

            {/* Match Info Area */}
            <div className="bg-gray-900 text-white pt-6 pb-8 px-4">
                <div className="max-w-3xl mx-auto flex items-start justify-between gap-2 md:gap-8 relative">

                    {/* Home Team */}
                    <div
                        className="flex-1 flex flex-col items-center text-center cursor-pointer group"
                        onClick={() => navigate(`/team/${match.home_team_id}`)}
                    >
                        {match.home_team?.logo_url ? (
                            <div className="relative mb-3 transform transition-transform group-hover:scale-105 duration-200">
                                <img
                                    src={match.home_team.logo_url}
                                    alt=""
                                    className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-lg"
                                />
                            </div>
                        ) : (
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-800 rounded-full mb-3 flex items-center justify-center">
                                <Users size={24} className="text-gray-600" />
                            </div>
                        )}
                        <p className="font-bold text-sm md:text-lg leading-tight w-full break-words px-1">
                            {match.home_team?.name || 'Ev Sahibi'}
                        </p>
                    </div>

                    {/* Score & Live Status */}
                    <div className="flex flex-col items-center shrink-0 w-[100px] md:w-[140px]">
                        {(() => {
                            const status = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;
                            const isLive = status >= 2 && status <= 7;
                            const isFinished = status === 8;
                            const minuteText = match.minute_text || '—';

                            return (
                                <div className="flex items-center justify-center gap-1.5 mb-2 w-full">
                                    {isLive && (
                                        <>
                                            {status === 3 ? (
                                                <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] md:text-xs font-bold rounded-full whitespace-nowrap">
                                                    İY
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] md:text-xs font-bold rounded-full animate-pulse whitespace-nowrap">
                                                    CANLI
                                                </span>
                                            )}
                                            {minuteText && minuteText !== '—' && (
                                                <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] md:text-xs font-bold rounded-full whitespace-nowrap min-w-[24px] text-center">
                                                    {minuteText}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {isFinished && (
                                        <span className="px-3 py-1 bg-gray-600 text-white text-[10px] md:text-xs font-bold rounded-full">
                                            MS
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="bg-white/10 rounded-xl px-4 py-2 md:px-6 md:py-3 backdrop-blur-sm border border-white/5 shadow-inner">
                            <div className="text-3xl md:text-5xl font-bold tracking-widest leading-none font-mono">
                                {match.home_score ?? 0}<span className="text-gray-400 mx-1">-</span>{match.away_score ?? 0}
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 mt-2 font-medium">
                            {(() => {
                                const status = (match as any).status ?? (match as any).status_id ?? 0;
                                switch (status) {
                                    case 1: return 'Başlamadı';
                                    case 2: return '1. Yarı';
                                    case 3: return 'Devre Arası';
                                    case 4: return '2. Yarı';
                                    case 5: return 'Uzatmalar';
                                    case 7: return 'Penaltılar';
                                    case 8: return 'Maç Sonu';
                                    default: return match.minute_text || '';
                                }
                            })()}
                        </p>
                    </div>

                    {/* Away Team */}
                    <div
                        className="flex-1 flex flex-col items-center text-center cursor-pointer group"
                        onClick={() => navigate(`/team/${match.away_team_id}`)}
                    >
                        {match.away_team?.logo_url ? (
                            <div className="relative mb-3 transform transition-transform group-hover:scale-105 duration-200">
                                <img
                                    src={match.away_team.logo_url}
                                    alt=""
                                    className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-lg"
                                />
                            </div>
                        ) : (
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-800 rounded-full mb-3 flex items-center justify-center">
                                <Users size={24} className="text-gray-600" />
                            </div>
                        )}
                        <p className="font-bold text-sm md:text-lg leading-tight w-full break-words px-1">
                            {match.away_team?.name || 'Deplasman'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Premium Tabs */}
            <div className="bg-white sticky top-[60px] z-20 shadow-sm border-b border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
                        {allTabs.map((tab) => {
                            const isActive = activeTab === tab.id || (tab.id === 'ai' && activeTab === 'ai' as any); // Handle AI tab type specifically if needed
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex-1 min-w-[85px] sm:min-w-[100px] py-4 px-2 
                                        flex flex-col items-center justify-center gap-2 
                                        transition-all duration-200 relative group
                                        ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
                                    `}
                                >
                                    <tab.Icon
                                        size={24}
                                        weight={isActive ? "fill" : "regular"}
                                        className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                                    />
                                    <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                        {tab.label}
                                    </span>

                                    {/* Active Indicator */}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full mx-4" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>


            {/* Tab Content */}
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
                {tabLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        Yükleniyor...
                    </div>
                ) : error ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#ef4444',
                        backgroundColor: '#fef2f2',
                        borderRadius: '12px',
                        border: '1px solid #fecaca'
                    }}>
                        <p style={{ margin: 0, fontWeight: '500' }}>❌ {error}</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'ai' && <AIContent matchId={matchId || ''} />}
                        {activeTab === 'stats' && <StatsContent data={tabData} match={match} />}
                        {activeTab === 'events' && <EventsContent data={tabData} match={match} />}
                        {activeTab === 'h2h' && <H2HContent data={tabData} />}
                        {activeTab === 'standings' && <StandingsContent data={tabData} homeTeamId={match.home_team_id} awayTeamId={match.away_team_id} />}
                        {activeTab === 'lineup' && <LineupContent data={tabData} match={match} navigate={navigate} />}
                        {activeTab === 'trend' && <TrendContent data={tabData} match={match} />}
                    </>
                )}
            </div>
        </div>
    );
}

// Stats Tab Content
type StatsPeriod = 'full' | 'first' | 'second';

function StatsContent({ data, match }: { data: any; match: Match }) {
    // CRITICAL FIX: Don't process stats if data is null/undefined (still loading)
    // Only process when data has been fetched (even if empty)
    const hasData = data !== null && data !== undefined;

    // If data is still loading (null/undefined), show loading state
    if (!hasData) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Yükleniyor...
            </div>
        );
    }

    // Determine match status
    const matchStatus = (match as any).status ?? (match as any).status_id ?? 1;

    // Determine which tabs to show based on match status:
    // - 1 = NOT_STARTED: No tabs (no stats yet)
    // - 2 = FIRST_HALF: Only TÜMÜ/1.YARI (same data)
    // - 3 = HALF_TIME: Only TÜMÜ/1.YARI (same data)
    // - 4+ = SECOND_HALF, OVERTIME, PENALTIES, END: Show all tabs
    const isFirstHalf = matchStatus === 2 || matchStatus === 3; // 1st half or halftime
    const isSecondHalfOrLater = matchStatus >= 4; // 2nd half, overtime, penalties, or finished

    const [activePeriod, setActivePeriod] = useState<StatsPeriod>('full');

    // Parse half time stats data
    const parseHalfStats = (halfData: any, sign: 'p1' | 'p2' | 'ft'): any[] => {
        if (!halfData?.results || !Array.isArray(halfData.results)) {
            return [];
        }

        const stats: any[] = [];
        for (const statObj of halfData.results) {
            if (statObj.Sign !== sign) continue;

            // Extract stats from the object (keys are stat IDs)
            for (const [key, value] of Object.entries(statObj)) {
                if (key === 'Sign') continue;

                const statId = Number(key);
                if (isNaN(statId)) continue;

                const values = Array.isArray(value) ? value : [];
                if (values.length >= 2) {
                    stats.push({
                        type: statId,
                        home: values[0],
                        away: values[1],
                    });
                }
            }
        }
        return stats;
    };

    // Get full time stats (used for TÜMÜ and 1.YARI when in first half)
    const getFullTimeStats = (): any[] => {
        if (data?.fullTime?.stats && Array.isArray(data.fullTime.stats)) {
            return data.fullTime.stats;
        } else if (data?.fullTime?.results) {
            if (Array.isArray(data.fullTime.results)) {
                return data.fullTime.results;
            }
        } else if (data?.stats && Array.isArray(data.stats)) {
            return data.stats;
        } else if (data?.results && Array.isArray(data.results)) {
            return data.results;
        }
        return [];
    };

    // Get first half stats snapshot from database (saved at halftime)
    const firstHalfStatsSnapshot = data?.firstHalfStats || null;
    const hasFirstHalfSnapshot = !!firstHalfStatsSnapshot && Array.isArray(firstHalfStatsSnapshot) && firstHalfStatsSnapshot.length > 0;

    // Calculate second half stats by subtracting first half from total
    const calculateSecondHalfStats = (): any[] => {
        if (!hasFirstHalfSnapshot) return [];

        const fullStats = getFullTimeStats();
        if (fullStats.length === 0) return [];

        const secondHalfStats: any[] = [];

        for (const fullStat of fullStats) {
            // Find matching first half stat
            const firstHalfStat = firstHalfStatsSnapshot.find((s: any) => s.type === fullStat.type);

            if (firstHalfStat) {
                // Calculate 2nd half = Total - 1st half
                const homeSecondHalf = (fullStat.home ?? 0) - (firstHalfStat.home ?? 0);
                const awaySecondHalf = (fullStat.away ?? 0) - (firstHalfStat.away ?? 0);

                secondHalfStats.push({
                    ...fullStat,
                    home: Math.max(0, homeSecondHalf), // Ensure non-negative
                    away: Math.max(0, awaySecondHalf),
                });
            } else {
                // No first half data for this stat - assume all in second half
                secondHalfStats.push(fullStat);
            }
        }

        return secondHalfStats;
    };

    // Get stats based on active period
    let rawStats: any[] = [];

    if (activePeriod === 'full') {
        // TÜMÜ: Current total stats from API
        rawStats = getFullTimeStats();
    } else if (activePeriod === 'first') {
        // 1. YARI: 
        // - If in 1st half: Same as TÜMÜ (live data)
        // - If in 2nd half or later: Use firstHalfStatsSnapshot (saved at halftime)
        if (isFirstHalf) {
            rawStats = getFullTimeStats();
        } else if (hasFirstHalfSnapshot) {
            rawStats = firstHalfStatsSnapshot;
        } else {
            // Fallback: Try halfTime API data, then use total stats
            const halfStats = parseHalfStats(data?.halfTime, 'p1');
            rawStats = halfStats.length > 0 ? halfStats : getFullTimeStats();
        }
    } else if (activePeriod === 'second') {
        // 2. YARI: Calculate as TÜMÜ - 1. YARI
        if (hasFirstHalfSnapshot) {
            rawStats = calculateSecondHalfStats();
        } else {
            // Fallback 1: Try halfTime API data
            const halfStats = parseHalfStats(data?.halfTime, 'p2');
            if (halfStats.length > 0) {
                rawStats = halfStats;
            } else {
                // Fallback 2: If in 2nd half but no 1st half snapshot, show current total (live data)
                // This is better than showing nothing - user can still see live stats
                rawStats = getFullTimeStats();
            }
        }
    }

    // Sort and filter unknown stats
    const stats = sortStats(rawStats).filter(s => getStatName(s.type) !== '');

    // Get basic stats fallback (for match info from database)
    const basicStats = [
        { label: 'Gol', home: match.home_score ?? 0, away: match.away_score ?? 0 },
        { label: 'Sarı Kart', home: (match as any).home_yellow_cards ?? 0, away: (match as any).away_yellow_cards ?? 0 },
        { label: 'Kırmızı Kart', home: (match as any).home_red_cards ?? 0, away: (match as any).away_red_cards ?? 0 },
        { label: 'Korner', home: (match as any).home_corners ?? 0, away: (match as any).away_corners ?? 0 },
    ];

    // Check if we have any full time stats (to determine if tabs should be shown)
    const hasFullTimeStats = getFullTimeStats().length > 0;

    // Render period tabs component
    const PeriodTabs = () => (
        <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '8px'
        }}>
            <button
                onClick={() => setActivePeriod('full')}
                style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: activePeriod === 'full' ? '#3b82f6' : 'transparent',
                    color: activePeriod === 'full' ? 'white' : '#6b7280',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: activePeriod === 'full' ? '600' : '400',
                    transition: 'all 0.2s',
                }}
            >
                TÜMÜ
            </button>
            <button
                onClick={() => setActivePeriod('first')}
                style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: activePeriod === 'first' ? '#3b82f6' : 'transparent',
                    color: activePeriod === 'first' ? 'white' : '#6b7280',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: activePeriod === 'first' ? '600' : '400',
                    transition: 'all 0.2s',
                }}
            >
                1. YARI
            </button>
            {/* Only show 2. YARI tab if match has reached 2nd half or later */}
            {isSecondHalfOrLater && (
                <button
                    onClick={() => setActivePeriod('second')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: activePeriod === 'second' ? '#3b82f6' : 'transparent',
                        color: activePeriod === 'second' ? 'white' : '#6b7280',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: activePeriod === 'second' ? '600' : '400',
                        transition: 'all 0.2s',
                    }}
                >
                    2. YARI
                </button>
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Period Tabs - Always show if we have any stats or match has started */}
            {(hasFullTimeStats || matchStatus >= 2) && <PeriodTabs />}

            {/* Stats List */}
            {stats.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {stats.map((stat: any, idx: number) => (
                        <StatRow key={idx} label={getStatName(stat.type)} home={stat.home ?? '-'} away={stat.away ?? '-'} />
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Show message based on period */}
                    <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#6b7280',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        marginBottom: '16px'
                    }}>
                        {activePeriod === 'first' && (isFirstHalf
                            ? 'Maç devam ediyor, detaylı istatistikler güncelleniyor...'
                            : '1. yarı detaylı istatistikleri mevcut değil.'
                        )}
                        {activePeriod === 'second' && '2. yarı detaylı istatistikleri mevcut değil. Temel bilgiler gösteriliyor.'}
                        {activePeriod === 'full' && 'Detaylı istatistik verisi bulunamadı. Temel bilgiler gösteriliyor.'}
                    </div>
                    {/* Show basic stats as fallback */}
                    {basicStats.map((stat, idx) => (
                        <StatRow key={idx} label={stat.label} home={stat.home} away={stat.away} />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatRow({ label, home, away }: { label: string; home: any; away: any }) {
    const homeNum = Number(home) || 0;
    const awayNum = Number(away) || 0;
    const total = homeNum + awayNum || 1;
    const homePercent = (homeNum / total) * 100;

    return (
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>{home}</span>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>{label}</span>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>{away}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', height: '6px' }}>
                <div style={{ flex: homePercent, backgroundColor: '#3b82f6', borderRadius: '3px' }}></div>
                <div style={{ flex: 100 - homePercent, backgroundColor: '#ef4444', borderRadius: '3px' }}></div>
            </div>
        </div>
    );
}

// H2H Content
function H2HContent({ data }: { data: any }) {
    if (!data) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', backgroundColor: 'white', borderRadius: '12px' }}>
                H2H verisi bulunamadı
            </div>
        );
    }

    const summary = data.summary;
    const h2hMatches = data.h2hMatches || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* H2H Summary */}
            {summary && summary.total > 0 && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 16px', fontWeight: '600' }}>Karşılıklı Maçlar Özeti</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '18px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '24px' }}>{summary.homeWins}</div>
                            <div style={{ color: '#6b7280', fontSize: '14px' }}>Ev Kazandı</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#9ca3af', fontSize: '24px' }}>{summary.draws}</div>
                            <div style={{ color: '#6b7280', fontSize: '14px' }}>Berabere</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '24px' }}>{summary.awayWins}</div>
                            <div style={{ color: '#6b7280', fontSize: '14px' }}>Dep Kazandı</div>
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', color: '#6b7280' }}>
                        Toplam {summary.total} maç
                    </div>
                </div>
            )}

            {/* Previous H2H Matches */}
            {h2hMatches.length > 0 && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
                    <h4 style={{ margin: '0 0 12px', fontWeight: '600' }}>Son Karşılaşmalar</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {h2hMatches.slice(0, 5).map((match: any, idx: number) => (
                            <div key={idx} style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>{match.date || match.match_time}</span>
                                <span style={{ fontWeight: '600' }}>{match.home_score ?? '-'} - {match.away_score ?? '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* If no data at all */}
            {!summary && h2hMatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', backgroundColor: 'white', borderRadius: '12px' }}>
                    H2H verisi bulunamadı
                </div>
            )}
        </div>
    );
}

// Standings Content
function StandingsContent({ data, homeTeamId, awayTeamId }: { data: any; homeTeamId: string; awayTeamId: string }) {
    const navigate = useNavigate();
    const standings = data?.results || [];

    if (!standings.length) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', backgroundColor: 'white', borderRadius: '12px' }}>
                Puan durumu bulunamadı
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600' }}>#</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600' }}>Takım</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600' }}>O</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600' }}>G</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600' }}>B</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600' }}>M</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600' }}>P</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((team: any, idx: number) => {
                        const isHighlighted = team.team_id === homeTeamId || team.team_id === awayTeamId;
                        return (
                            <tr key={idx} style={{ backgroundColor: isHighlighted ? '#dbeafe' : 'transparent', borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px', fontWeight: '600' }}>{team.position || idx + 1}</td>
                                <td style={{ padding: '12px 8px' }}>
                                    <div
                                        onClick={() => navigate(`/team/${team.team_id}`)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            color: '#1e40af',
                                            fontWeight: isHighlighted ? '600' : '400'
                                        }}
                                    >
                                        {team.team_logo && (
                                            <img
                                                src={team.team_logo}
                                                alt=""
                                                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                            />
                                        )}
                                        <span style={{ textDecoration: 'none' }}>
                                            {team.team_name || `Takım ${idx + 1}`}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>{team.played}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>{team.won}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>{team.drawn}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>{team.lost}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600' }}>{team.points}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// AI Content
function AIContent({ matchId }: { matchId: string }) {
    const { predictions, loading: contextLoading } = useAIPredictions();
    const [prediction, setPrediction] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // First try to get from context
        const contextPred = predictions.get(matchId);
        if (contextPred) {
            setPrediction(contextPred);
            setLoading(false);
            return;
        }

        // If not in context, fetch directly from API
        const fetchPrediction = async () => {
            try {
                const API_BASE = import.meta.env.VITE_API_URL || '/api';
                const url = `${API_BASE}/predictions/match/${matchId}`;
                console.log('[AIContent] Fetching prediction from:', url);
                const res = await fetch(url);
                console.log('[AIContent] Response status:', res.status);
                if (res.ok) {
                    const data = await res.json();
                    console.log('[AIContent] Response data:', data);
                    if (data.success && data.prediction) {
                        const pred = {
                            id: data.prediction.id,
                            match_external_id: data.prediction.match_external_id,
                            prediction_type: data.prediction.prediction_type,
                            prediction_value: data.prediction.prediction_value,
                            overall_confidence: data.prediction.overall_confidence,
                            bot_name: data.prediction.bot_name,
                            minute_at_prediction: data.prediction.minute_at_prediction,
                            prediction_result: data.prediction.prediction_result,
                        };
                        console.log('[AIContent] Setting prediction:', pred);
                        setPrediction(pred);
                    } else {
                        console.log('[AIContent] No prediction in response');
                    }
                } else {
                    console.error('[AIContent] Response not OK:', res.status, res.statusText);
                }
            } catch (error) {
                console.error('[AIContent] Fetch prediction error:', error);
            } finally {
                setLoading(false);
            }
        };

        if (!contextLoading) {
            fetchPrediction();
        }
    }, [matchId, predictions, contextLoading]);

    if (loading || contextLoading) {
        return (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Yapay zeka analizi yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!prediction) {
        return (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Robot size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Tahmin Bulunamadı</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                    Bu maç için henüz yapay zeka tarafından oluşturulmuş güvenilir bir tahmin bulunmuyor.
                </p>
            </div>
        );
    }

    // Determine confidence color


    return (
        <div className="flex flex-col gap-6">
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                {/* Header with Robot Icon */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                        <Robot size={120} weight="fill" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <Robot size={24} weight="fill" className="text-blue-200" />
                                <span className="text-blue-100 font-bold tracking-wider text-xs uppercase">
                                    {prediction.bot_name || 'GoalGPT AI'}
                                </span>
                            </div>
                            {prediction.minute_at_prediction && (
                                <span className="text-blue-100 text-xs font-medium bg-blue-800/30 px-2 py-1 rounded">
                                    ⏱ {prediction.minute_at_prediction}. dk
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold">Maç Tahmini</h2>
                    </div>
                </div>

                {/* Prediction Content */}
                <div className="p-6">
                    <div className="flex flex-col items-center justify-center text-center mb-8">
                        <span className="text-sm text-gray-400 font-medium mb-2 uppercase tracking-wide">Önerilen Tercih</span>
                        <div className="text-4xl font-black text-gray-800 mb-2 tracking-tight">
                            {prediction.prediction_type}
                        </div>
                        <div className="bg-gray-100 px-4 py-1 rounded-full text-gray-600 font-bold text-sm">
                            {prediction.prediction_value}
                        </div>
                    </div>

                    {/* Status Badge (Replaces Confidence Meter) */}
                    <div className="mb-6">
                        {(!prediction.prediction_result || prediction.prediction_result === 'pending') && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-center gap-3 text-amber-700">
                                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                                <span className="font-bold text-lg">BEKLİYOR</span>
                            </div>
                        )}
                        {prediction.prediction_result === 'winner' && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-center gap-3 text-green-700">
                                <div className="p-1 bg-green-100 rounded-full">
                                    <Trophy size={20} weight="fill" className="text-green-600" />
                                </div>
                                <span className="font-bold text-lg">KAZANDI</span>
                            </div>
                        )}
                        {prediction.prediction_result === 'loser' && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-center gap-3 text-red-700">
                                <div className="p-1 bg-red-100 rounded-full">
                                    <WarningCircle size={20} weight="fill" className="text-red-600" />
                                </div>
                                <span className="font-bold text-lg">KAYBETTİ</span>
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-center text-gray-400">
                        * Bu tahmin yapay zeka modelleri tarafından istatistiksel veriler kullanılarak oluşturulmuştur. Kesinlik içermez.
                    </div>
                </div>
            </div>
        </div>
    );
}

// Events Content (Timeline)
function EventsContent({ data, match }: { data: any; match: Match }) {
    // CRITICAL FIX: Don't process incidents if data is null/undefined (still loading)
    // Only process when data has been fetched (even if empty)
    const hasData = data !== null && data !== undefined;

    // If data is still loading (null/undefined), show loading state
    if (!hasData) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Yükleniyor...
            </div>
        );
    }

    const incidents = data?.incidents || [];
    const matchStatusId = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;

    // Always render MatchEventsTimeline - it handles empty state with "MAÇ BAŞLADI" marker
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MatchEventsTimeline
                incidents={incidents}
                homeTeamName={match.home_team?.name}
                awayTeamName={match.away_team?.name}
                matchStatusId={matchStatusId}
            />
        </div>
    );
}

// Trend Content
function TrendContent({ data, match }: { data: any; match: Match }) {
    // According to TheSports API docs:
    // "Trend data is available only when the match is in progress"
    // Status IDs: 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=PENALTY_SHOOTOUT
    const matchStatus = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;
    const isLiveMatch = matchStatus && [2, 3, 4, 5, 7].includes(matchStatus);

    if (!isLiveMatch) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
            }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
                    Trend verisi sadece maç devam ederken mevcuttur.
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#9ca3af' }}>
                    Bu maç henüz başlamadı veya tamamlandı.
                </p>
            </div>
        );
    }

    // Relaxed check: Only show "Not available" if we truly have NO data
    // The service handles live/finished logic. If we have data, show it.
    const hasData = (data?.trend?.first_half?.length > 0 || data?.trend?.second_half?.length > 0);

    if (!hasData && !isLiveMatch) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
            }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
                    Trend verisi bulunamadı.
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#9ca3af' }}>
                    Bu maç için trend verisi henüz oluşmamış olabilir.
                </p>
            </div>
        );
    }

    // Get current minute from match
    const currentMinute = (match as any).minute ?? null;

    // Get incidents from data (passed from parent)
    const incidents = data?.incidents || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MatchTrendChart
                data={data?.trend}
                incidents={incidents}
                homeTeamName={match.home_team?.name}
                awayTeamName={match.away_team?.name}
                homeTeamLogo={match.home_team?.logo_url}
                awayTeamLogo={match.away_team?.logo_url}
                currentMinute={currentMinute}
            />
        </div>
    );
}

// Lineup Content
function LineupContent({ data, match, navigate }: { data: any; match: Match; navigate: any }) {
    const lineup = data?.results || data;
    const homeLineup = lineup?.home || lineup?.home_lineup || [];
    const awayLineup = lineup?.away || lineup?.away_lineup || [];

    if (!homeLineup.length && !awayLineup.length) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', backgroundColor: 'white', borderRadius: '12px' }}>
                Kadro bilgisi henüz açıklanmadı
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: '600', color: '#3b82f6', textAlign: 'center' }}>
                    {match.home_team?.name || 'Ev Sahibi'}
                </h4>
                {homeLineup.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {homeLineup.slice(0, 11).map((player: any, idx: number) => (
                            <div
                                key={idx}
                                onClick={() => player.id && navigate(`/player/${player.id}`)}
                                style={{
                                    padding: '10px',
                                    backgroundColor: '#f0f9ff',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    cursor: player.id ? 'pointer' : 'default',
                                    border: player.id ? '1px solid transparent' : 'none',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => { if (player.id) { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                                onMouseLeave={(e) => { if (player.id) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; } }}
                            >
                                {player.shirt_number && <span style={{ fontWeight: '700', marginRight: '12px', color: '#3b82f6' }}>{player.shirt_number}</span>}
                                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ textAlign: 'center', color: '#6b7280' }}>Kadro bilgisi yok</p>
                )}
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: '600', color: '#ef4444', textAlign: 'center' }}>
                    {match.away_team?.name || 'Deplasman'}
                </h4>
                {awayLineup.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {awayLineup.slice(0, 11).map((player: any, idx: number) => (
                            <div
                                key={idx}
                                onClick={() => player.id && navigate(`/player/${player.id}`)}
                                style={{
                                    padding: '10px',
                                    backgroundColor: '#fef2f2',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    cursor: player.id ? 'pointer' : 'default',
                                    border: player.id ? '1px solid transparent' : 'none',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => { if (player.id) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                                onMouseLeave={(e) => { if (player.id) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; } }}
                            >
                                {player.shirt_number && <span style={{ fontWeight: '700', marginRight: '12px', color: '#ef4444' }}>{player.shirt_number}</span>}
                                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ textAlign: 'center', color: '#6b7280' }}>Kadro bilgisi yok</p>
                )}
            </div>
        </div>
    );
}

// Helper function - TheSports API stat types
// CRITICAL: These mappings are based on official TheSports API documentation (TechnicalStatistics & HalfTimeStatistics)
function getStatName(type: number): string {
    const statNames: Record<number, string> = {
        // Basic match stats (from detail_live)
        1: 'Gol',
        2: 'Korner',
        3: 'Sarı Kart',
        4: 'Kırmızı Kart',
        5: 'Ofsayt',
        6: 'Serbest Vuruş',
        7: 'Aut',
        8: 'Penaltı',
        9: 'Oyuncu Değişikliği',
        21: 'İsabetli Şut',
        22: 'İsabetsiz Şut',
        23: 'Atak',
        24: 'Tehlikeli Atak',
        25: 'Top Hakimiyeti (%)',
        37: 'Engellenen Şut',

        // Detailed stats (from team_stats / half_team_stats)
        33: 'Top Sürme',
        34: 'Başarılı Top Sürme',
        36: 'Uzaklaştırma',
        38: 'Top Çalma',
        39: 'Müdahale',
        40: 'Toplam Pas',
        41: 'İsabetli Pas',
        42: 'Kilit Pas',
        43: 'Orta',
        44: 'İsabetli Orta',
        45: 'Uzun Pas',
        46: 'İsabetli Uzun Pas',
        51: 'Faul',
        52: 'Kurtarış',
        63: 'Serbest Vuruş',
        69: 'Direkten Dönen',
        83: 'Toplam Şut',

        // Custom Detailed Stats (Mapped from team_stats/list)
        101: 'Toplam Pas',
        102: 'İsabetli Pas',
        103: 'Kilit Pas',
        104: 'İsabetli Orta',
        105: 'İsabetli Uzun Top',
        106: 'Top Kesme',
        107: 'Faul',
        108: 'Ofsayt',
        109: 'Hızlı Hücum Şutu',
        110: 'İkili Mücadele',
        111: 'Uzaklaştırma',
        112: 'Başarılı Çalım',
        113: 'Kazanılan İkili Mücadele',
        115: 'Direkten Dönen'
    };
    return statNames[type] || '';
}

/**
 * Helper function to sort statistics in a logical order
 */
function sortStats(stats: any[]): any[] {
    const order = [
        // Goals & Basic
        1,  // Goals
        25, // Ball Possession

        // Shots
        83, // Total Shots
        21, // Shots on Target
        22, // Shots off Target
        37, // Blocked Shots
        115, 69, // Woodwork
        109, // Fastbreak shots

        // Attack
        2,  // Corners
        23, // Attacks
        24, // Dangerous Attacks
        5, 108, // Offsides

        // Passing
        40, 101, // Total Passes
        41, 102, // Accurate Passes
        42, 103, // Key Passes
        43, // Crosses
        44, 104, // Accurate Crosses
        45, // Long Balls
        46, 105, // Accurate Long Balls

        // Dribbles
        33, // Dribbles
        34, 112, // Dribble Success

        // Defense
        39, 110, // Tackles / Duels
        113, // Duels Won
        38, 106, // Interceptions
        36, 111, // Clearances
        52, // Saves

        // Discipline
        51, 107, // Fouls
        3,  // Yellow Cards
        4   // Red Cards
    ];

    return [...stats].sort((a, b) => {
        const indexA = order.indexOf(a.type);
        const indexB = order.indexOf(b.type);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both in list, sort by index
        if (indexA !== -1) return -1; // Only A in list, A comes first
        if (indexB !== -1) return 1;  // Only B in list, B comes first
        return a.type - b.type; // Neither in list, sort by ID
    });
}
