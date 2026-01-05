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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pb-safe">
            {/* Premium Header */}
            <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3 md:p-4 sticky top-0 z-30 shadow-xl border-b border-slate-700/50 backdrop-blur-sm">
                <div className="max-w-5xl mx-auto flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 md:p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 bg-white/5 backdrop-blur-sm border border-white/10 flex-shrink-0"
                    >
                        <CaretLeft size={20} weight="bold" className="md:w-[22px] md:h-[22px]" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm text-gray-300 font-semibold tracking-wide uppercase truncate">
                            {match.competition?.name || 'Lig'}
                        </p>
                    </div>
                </div>
            </header>

            {/* Premium Match Info Area */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-white pt-4 md:pt-8 pb-6 md:pb-10 px-3 md:px-4 overflow-hidden">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
                </div>
                
                <div className="max-w-3xl mx-auto flex items-start justify-between gap-1 md:gap-2 lg:gap-8 relative z-10">

                    {/* Premium Home Team */}
                    <div
                        className="flex-1 flex flex-col items-center text-center cursor-pointer group"
                        onClick={() => navigate(`/team/${match.home_team_id}`)}
                    >
                        {match.home_team?.logo_url ? (
                            <div className="relative mb-2 md:mb-4 transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                                <img
                                    src={match.home_team.logo_url}
                                    alt=""
                                    className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 object-contain drop-shadow-2xl filter group-hover:brightness-110 transition-all duration-300"
                                />
                            </div>
                        ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-2 md:mb-4 flex items-center justify-center shadow-xl border border-white/10 group-hover:scale-110 transition-all duration-300">
                                <Users size={20} className="text-gray-400 md:w-[28px] md:h-[28px]" />
                            </div>
                        )}
                        <p className="font-black text-xs sm:text-sm md:text-lg leading-tight w-full break-words px-1 text-white drop-shadow-lg group-hover:text-white/90 transition-colors">
                            {match.home_team?.name || 'Ev Sahibi'}
                        </p>
                    </div>

                    {/* Score & Live Status */}
                    <div className="flex flex-col items-center shrink-0 w-[80px] sm:w-[100px] md:w-[140px]">
                        {(() => {
                            const status = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;
                            const isLive = status >= 2 && status <= 7;
                            const isFinished = status === 8;
                            const minuteText = match.minute_text || '—';

                            return (
                                <div className="flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-3 w-full flex-wrap">
                                    {isLive && (
                                        <>
                                            {status === 3 ? (
                                                <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] md:text-xs lg:text-sm font-black rounded-full whitespace-nowrap shadow-lg shadow-amber-500/50 border border-white/20">
                                                    İY
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] md:text-xs lg:text-sm font-black rounded-full animate-pulse whitespace-nowrap shadow-lg shadow-red-500/50 border border-white/20">
                                                    CANLI
                                                </span>
                                            )}
                                            {minuteText && minuteText !== '—' && (
                                                <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] md:text-xs lg:text-sm font-black rounded-full whitespace-nowrap min-w-[28px] md:min-w-[32px] text-center shadow-lg shadow-indigo-500/50 border border-white/20">
                                                    {minuteText}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {isFinished && (
                                        <span className="px-2 py-1 md:px-4 md:py-1.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white text-[10px] md:text-xs lg:text-sm font-black rounded-full shadow-lg border border-white/20">
                                            MS
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="relative bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-xl md:rounded-2xl px-3 py-2 md:px-5 md:py-3 lg:px-8 lg:py-4 backdrop-blur-md border border-white/20 md:border-2 shadow-2xl w-full">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl md:rounded-2xl"></div>
                            <div className="relative text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black tracking-widest leading-none font-mono text-white drop-shadow-lg">
                                {match.home_score ?? 0}<span className="text-white/60 mx-1 md:mx-2">-</span>{match.away_score ?? 0}
                            </div>
                        </div>

                        <p className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-2 font-medium text-center">
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

                    {/* Premium Away Team */}
                    <div
                        className="flex-1 flex flex-col items-center text-center cursor-pointer group"
                        onClick={() => navigate(`/team/${match.away_team_id}`)}
                    >
                        {match.away_team?.logo_url ? (
                            <div className="relative mb-2 md:mb-4 transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                                <img
                                    src={match.away_team.logo_url}
                                    alt=""
                                    className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 object-contain drop-shadow-2xl filter group-hover:brightness-110 transition-all duration-300"
                                />
                            </div>
                        ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-2 md:mb-4 flex items-center justify-center shadow-xl border border-white/10 group-hover:scale-110 transition-all duration-300">
                                <Users size={20} className="text-gray-400 md:w-[28px] md:h-[28px]" />
                            </div>
                        )}
                        <p className="font-black text-xs sm:text-sm md:text-lg leading-tight w-full break-words px-1 text-white drop-shadow-lg group-hover:text-white/90 transition-colors">
                            {match.away_team?.name || 'Deplasman'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Premium Tabs */}
            <div className="bg-gradient-to-b from-white to-gray-50/50 sticky top-[52px] md:top-[60px] z-20 shadow-lg border-b border-gray-200/50 backdrop-blur-sm">
                <div className="max-w-5xl mx-auto">
                    <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
                        {allTabs.map((tab) => {
                            const isActive = activeTab === tab.id || (tab.id === 'ai' && activeTab === 'ai' as any);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex-shrink-0 min-w-[70px] sm:min-w-[80px] md:min-w-[100px] py-2.5 md:py-4 px-1.5 md:px-2 
                                        flex flex-col items-center justify-center gap-1 md:gap-2 
                                        transition-all duration-300 relative group
                                        ${isActive 
                                            ? 'text-indigo-600 bg-gradient-to-b from-indigo-50/50 to-transparent' 
                                            : 'text-gray-500 hover:text-indigo-500 hover:bg-indigo-50/30'
                                        }
                                    `}
                                >
                                    <div className={`relative transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                        <tab.Icon
                                            size={20}
                                            weight={isActive ? "fill" : "regular"}
                                            className={`transition-all duration-300 md:w-6 md:h-6 ${isActive ? 'drop-shadow-lg' : ''}`}
                                        />
                                        {isActive && (
                                            <div className="absolute inset-0 bg-indigo-200/30 rounded-full blur-md -z-10"></div>
                                        )}
                                    </div>
                                    <span className={`text-[9px] sm:text-[10px] md:text-[11px] font-bold tracking-wide transition-colors duration-300 leading-tight text-center ${isActive ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-500'}`}>
                                        {tab.label}
                                    </span>

                                    {/* Premium Active Indicator */}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 md:h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-t-full mx-1 md:mx-2 shadow-lg shadow-indigo-500/50" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>


            {/* Premium Tab Content */}
            <div className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-6">
                {tabLoading ? (
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-12 text-center border border-gray-200/50 shadow-lg">
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                            </div>
                            <p className="text-gray-600 font-semibold">Yükleniyor...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-8 text-center border-2 border-red-200/50 shadow-lg">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">❌</span>
                            </div>
                            <p className="text-red-700 font-bold text-lg">{error}</p>
                        </div>
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
        <div className="flex gap-2 md:gap-2 border-b-2 border-gray-200 pb-2 md:pb-2 overflow-x-auto">
            <button
                onClick={() => setActivePeriod('full')}
                className={`px-3 py-1.5 md:px-4 md:py-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 text-xs md:text-sm whitespace-nowrap ${
                    activePeriod === 'full' 
                        ? 'bg-blue-600 text-white font-semibold' 
                        : 'bg-transparent text-gray-600'
                }`}
            >
                TÜMÜ
            </button>
            <button
                onClick={() => setActivePeriod('first')}
                className={`px-3 py-1.5 md:px-4 md:py-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 text-xs md:text-sm whitespace-nowrap ${
                    activePeriod === 'first' 
                        ? 'bg-blue-600 text-white font-semibold' 
                        : 'bg-transparent text-gray-600'
                }`}
            >
                1. YARI
            </button>
            {/* Only show 2. YARI tab if match has reached 2nd half or later */}
            {isSecondHalfOrLater && (
                <button
                    onClick={() => setActivePeriod('second')}
                    className={`px-3 py-1.5 md:px-4 md:py-2 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 text-xs md:text-sm whitespace-nowrap ${
                        activePeriod === 'second' 
                            ? 'bg-blue-600 text-white font-semibold' 
                            : 'bg-transparent text-gray-600'
                    }`}
                >
                    2. YARI
                </button>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-3 md:gap-4">
            {/* Period Tabs - Always show if we have any stats or match has started */}
            {(hasFullTimeStats || matchStatus >= 2) && <PeriodTabs />}

            {/* Stats List */}
            {stats.length > 0 ? (
                <div className="flex flex-col gap-2 md:gap-3">
                    {stats.map((stat: any, idx: number) => (
                        <StatRow key={idx} label={getStatName(stat.type)} home={stat.home ?? '-'} away={stat.away ?? '-'} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-2 md:gap-3">
                    {/* Show message based on period */}
                    <div className="text-center p-4 md:p-5 text-gray-600 bg-gray-50 rounded-lg mb-3 md:mb-4 text-sm md:text-base">
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
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2 md:mb-3 gap-2">
                <span className="font-semibold text-gray-900 text-sm md:text-base min-w-[30px] text-right">{home}</span>
                <span className="text-gray-600 text-xs md:text-sm font-medium text-center flex-1">{label}</span>
                <span className="font-semibold text-gray-900 text-sm md:text-base min-w-[30px] text-left">{away}</span>
            </div>
            <div className="flex gap-1 h-1.5 md:h-2">
                <div className="bg-blue-600 rounded-full" style={{ flex: homePercent }}></div>
                <div className="bg-red-500 rounded-full" style={{ flex: 100 - homePercent }}></div>
            </div>
        </div>
    );
}

// H2H Content
function H2HContent({ data }: { data: any }) {
    if (!data) {
        return (
            <div className="text-center p-8 md:p-10 text-gray-600 bg-white rounded-xl">
                H2H verisi bulunamadı
            </div>
        );
    }

    const summary = data.summary;
    const h2hMatches = data.h2hMatches || [];

    return (
        <div className="flex flex-col gap-3 md:gap-4">
            {/* H2H Summary */}
            {summary && summary.total > 0 && (
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 text-center">
                    <h3 className="m-0 mb-3 md:mb-4 font-semibold text-sm md:text-base">Karşılıklı Maçlar Özeti</h3>
                    <div className="flex justify-center gap-4 md:gap-6">
                        <div className="text-center">
                            <div className="font-bold text-blue-600 text-lg md:text-2xl">{summary.homeWins}</div>
                            <div className="text-gray-600 text-xs md:text-sm mt-1">Ev Kazandı</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-gray-400 text-lg md:text-2xl">{summary.draws}</div>
                            <div className="text-gray-600 text-xs md:text-sm mt-1">Berabere</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-red-500 text-lg md:text-2xl">{summary.awayWins}</div>
                            <div className="text-gray-600 text-xs md:text-sm mt-1">Dep Kazandı</div>
                        </div>
                    </div>
                    <div className="mt-3 text-gray-600 text-xs md:text-sm">
                        Toplam {summary.total} maç
                    </div>
                </div>
            )}

            {/* Previous H2H Matches */}
            {h2hMatches.length > 0 && (
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100">
                    <h4 className="m-0 mb-3 font-semibold text-sm md:text-base">Son Karşılaşmalar</h4>
                    <div className="flex flex-col gap-2">
                        {h2hMatches.slice(0, 5).map((match: any, idx: number) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center gap-2">
                                <span className="text-xs md:text-sm text-gray-600 truncate">{match.date || match.match_time}</span>
                                <span className="font-semibold text-sm md:text-base whitespace-nowrap">{match.home_score ?? '-'} - {match.away_score ?? '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* If no data at all */}
            {!summary && h2hMatches.length === 0 && (
                <div className="text-center p-8 md:p-10 text-gray-600 bg-white rounded-xl">
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
            <div className="text-center p-8 md:p-10 text-gray-600 bg-white rounded-xl">
                Puan durumu bulunamadı
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs md:text-sm">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="p-2 md:p-3 text-left font-semibold sticky left-0 bg-gray-50 z-10">#</th>
                            <th className="p-2 md:p-3 text-left font-semibold min-w-[120px] md:min-w-[150px]">Takım</th>
                            <th className="p-2 md:p-3 text-center font-semibold">O</th>
                            <th className="p-2 md:p-3 text-center font-semibold">G</th>
                            <th className="p-2 md:p-3 text-center font-semibold">B</th>
                            <th className="p-2 md:p-3 text-center font-semibold">M</th>
                            <th className="p-2 md:p-3 text-center font-semibold">P</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((team: any, idx: number) => {
                            const isHighlighted = team.team_id === homeTeamId || team.team_id === awayTeamId;
                            return (
                                <tr key={idx} className={`border-b border-gray-100 ${isHighlighted ? 'bg-blue-50' : 'bg-white'}`}>
                                    <td className="p-2 md:p-3 font-semibold sticky left-0 bg-inherit z-10">{team.position || idx + 1}</td>
                                    <td className="p-2 md:p-3">
                                        <div
                                            onClick={() => navigate(`/team/${team.team_id}`)}
                                            className="flex items-center gap-2 cursor-pointer text-blue-700 hover:text-blue-900"
                                            style={{ fontWeight: isHighlighted ? '600' : '400' }}
                                        >
                                            {team.team_logo && (
                                                <img
                                                    src={team.team_logo}
                                                    alt=""
                                                    className="w-4 h-4 md:w-5 md:h-5 object-contain flex-shrink-0"
                                                />
                                            )}
                                            <span className="truncate">{team.team_name || `Takım ${idx + 1}`}</span>
                                        </div>
                                    </td>
                                    <td className="p-2 md:p-3 text-center">{team.played}</td>
                                    <td className="p-2 md:p-3 text-center">{team.won}</td>
                                    <td className="p-2 md:p-3 text-center">{team.drawn}</td>
                                    <td className="p-2 md:p-3 text-center">{team.lost}</td>
                                    <td className="p-2 md:p-3 text-center font-semibold">{team.points}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// AI Content
function AIContent({ matchId }: { matchId: string }) {
    const [predictions, setPredictions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch all predictions for this match
        const fetchPredictions = async () => {
            try {
                const API_BASE = import.meta.env.VITE_API_URL || '/api';
                const url = `${API_BASE}/predictions/match/${matchId}`;
                console.log('[AIContent] Fetching predictions from:', url);
                const res = await fetch(url);
                console.log('[AIContent] Response status:', res.status);
                if (res.ok) {
                    const data = await res.json();
                    console.log('[AIContent] Response data:', data);
                    if (data.success && data.predictions) {
                        const preds = data.predictions.map((p: any) => ({
                            id: p.id,
                            match_external_id: p.match_external_id,
                            prediction_type: p.prediction_type,
                            prediction_value: p.prediction_value,
                            overall_confidence: p.overall_confidence,
                            bot_name: p.bot_name,
                            minute_at_prediction: p.minute_at_prediction,
                            score_at_prediction: p.score_at_prediction,
                            prediction_result: p.prediction_result,
                            created_at: p.created_at,
                        }));
                        console.log('[AIContent] Setting predictions:', preds);
                        setPredictions(preds);
                    } else {
                        console.log('[AIContent] No predictions in response');
                    }
                } else {
                    console.error('[AIContent] Response not OK:', res.status, res.statusText);
                }
            } catch (error) {
                console.error('[AIContent] Fetch predictions error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPredictions();
    }, [matchId]);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-12 text-center border border-gray-200/50 shadow-lg">
                <div className="flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                    </div>
                    <div>
                        <p className="text-gray-700 font-semibold text-lg mb-1">Yapay zeka analizi yükleniyor...</p>
                        <p className="text-gray-500 text-sm">Tahminler hazırlanıyor</p>
                    </div>
                </div>
            </div>
        );
    }

    if (predictions.length === 0) {
        return (
            <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-12 text-center border border-gray-200/50 shadow-lg">
                <div className="flex flex-col items-center justify-center">
                    <div className="relative mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center shadow-inner">
                            <Robot size={40} weight="duotone" className="text-gray-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full border-4 border-white"></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-3 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        Tahmin Bulunamadı
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                        Bu maç için henüz yapay zeka tarafından oluşturulmuş güvenilir bir tahmin bulunmuyor.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
                {predictions.map((prediction) => {
                    // Determine status colors
                    const isWinner = prediction.prediction_result === 'winner';
                    const isLoser = prediction.prediction_result === 'loser';
                    const isPending = !prediction.prediction_result || prediction.prediction_result === 'pending';
                    
                    // Parse score at prediction
                    const scoreAtPrediction = prediction.score_at_prediction || '0-0';
                    
                    return (
                        <div 
                            key={prediction.id} 
                            className={`p-3 md:p-4 hover:bg-gray-50 transition-colors duration-150`}
                        >
                            <div className="flex items-center justify-between gap-2 md:gap-4 flex-wrap sm:flex-nowrap">
                                {/* Left Side: Bot Info */}
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 sm:flex-initial">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                            <Robot size={14} weight="fill" className="text-white md:w-[18px] md:h-[18px]" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1 sm:flex-initial">
                                        <div className="flex items-center gap-1 md:gap-2 flex-wrap text-xs md:text-sm">
                                            <span className="font-bold text-gray-900 truncate">
                                                {prediction.bot_name || 'GoalGPT AI'}
                                            </span>
                                            {prediction.minute_at_prediction && (
                                                <>
                                                    <span className="text-gray-300">-</span>
                                                    <span className="text-gray-600 font-medium whitespace-nowrap">
                                                        {prediction.minute_at_prediction}. Dakika
                                                    </span>
                                                </>
                                            )}
                                            {scoreAtPrediction && (
                                                <>
                                                    <span className="text-gray-300">-</span>
                                                    <span className="text-gray-500 font-medium whitespace-nowrap">
                                                        Skor
                                                    </span>
                                                    <span className="font-semibold text-gray-700 whitespace-nowrap">
                                                        {scoreAtPrediction}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Center: Prediction Detail */}
                                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 order-3 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
                                    <div className="px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200/50">
                                        <span className="text-xs md:text-sm font-bold text-gray-800 whitespace-nowrap">
                                            {prediction.prediction_type}
                                        </span>
                                    </div>
                                </div>

                                {/* Right Side: Status Badge */}
                                <div className="flex-shrink-0 order-2 sm:order-3">
                                    {isPending && (
                                        <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                                            <span className="text-[10px] md:text-xs font-bold text-amber-700 whitespace-nowrap">BEKLİYOR</span>
                                        </div>
                                    )}
                                    {isWinner && (
                                        <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                            <Trophy size={12} weight="fill" className="text-emerald-600 md:w-[14px] md:h-[14px]" />
                                            <span className="text-[10px] md:text-xs font-bold text-emerald-700 whitespace-nowrap">KAZANDI</span>
                                        </div>
                                    )}
                                    {isLoser && (
                                        <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-red-50 rounded-lg border border-red-200">
                                            <WarningCircle size={12} weight="fill" className="text-red-600 md:w-[14px] md:h-[14px]" />
                                            <span className="text-[10px] md:text-xs font-bold text-red-700 whitespace-nowrap">KAYBETTİ</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
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
