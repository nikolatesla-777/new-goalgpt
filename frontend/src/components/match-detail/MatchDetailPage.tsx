/**
 * Match Detail Page
 * 
 * Full page component for displaying detailed match information
 * Accessed via /match/:matchId route
 */

import { useState, useEffect, useRef } from 'react';
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

type TabType = 'stats' | 'h2h' | 'standings' | 'lineup' | 'trend' | 'events';

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


    // Fetch match info with periodic polling for live matches
    // CRITICAL: Use getLiveMatches() first (has minute_text), then fallback to diary
    useEffect(() => {
        const fetchMatch = async () => {
            if (!matchId) return;

            // Only show loading on initial fetch, not on poll updates
            if (!hasLoadedRef.current) setLoading(true);

            try {
                let foundMatch: Match | undefined;

                // Step 1: Try getMatchById first (works for any date, fetches directly from database)
                try {
                    foundMatch = await getMatchById(matchId);
                } catch (error: any) {
                    // If match not found by ID, try other methods
                    console.log('[MatchDetailPage] Match not found by ID, trying live matches...');

                    // Step 2: Try getLiveMatches (has real-time minute_text for currently live matches)
                    try {
                        const liveResponse = await getLiveMatches();
                        foundMatch = liveResponse.results?.find((m: Match) => m.id === matchId);
                    } catch {
                        // Live endpoint failed, continue to next step
                    }
                }

                if (foundMatch) {
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

        // Poll every 10 seconds for live match updates (same as homepage pattern)
        const pollInterval = setInterval(fetchMatch, 3000);

        return () => clearInterval(pollInterval);
    }, [matchId]);

    // Fetch tab data
    useEffect(() => {
        const fetchTabData = async () => {
            if (!matchId || !match) return;

            setTabLoading(true);
            setTabData(null);
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
                        if (match.season_id) {
                            result = await getSeasonStandings(match.season_id);
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
                setTabData(result);
            } catch (err: any) {
                console.error('Tab data fetch error:', err);
                setError(err.message || 'Veri yüklenirken hata oluştu');
                setTabData(null); // Ensure data is null on error
            } finally {
                setTabLoading(false);
            }
        };

        fetchTabData();
    }, [activeTab, matchId, match]);

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'stats', label: 'İstatistikler', icon: '📊' },
        { id: 'events', label: 'Etkinlikler', icon: '📋' },
        { id: 'h2h', label: 'H2H', icon: '⚔️' },
        { id: 'standings', label: 'Puan Durumu', icon: '🏆' },
        { id: 'lineup', label: 'Kadro', icon: '👥' },
        { id: 'trend', label: 'Trend', icon: '📈' },
    ];

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

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
            {/* Header */}
            <header style={{ backgroundColor: '#1f2937', color: 'white', padding: '16px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '8px' }}
                    >
                        ←
                    </button>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
                            {match.competition?.name || 'Lig'}
                        </p>
                    </div>
                </div>
            </header>

            {/* Match Info */}
            <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '24px 16px 32px' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                    {/* Home Team */}
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        {match.home_team?.logo_url && (
                            <img
                                src={match.home_team.logo_url}
                                alt=""
                                style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto 8px' }}
                            />
                        )}
                        <p style={{ fontWeight: '600', fontSize: '16px', margin: 0 }}>
                            {match.home_team?.name || 'Ev Sahibi'}
                        </p>
                    </div>

                    {/* Score & Live Status */}
                    <div style={{ textAlign: 'center' }}>
                        {/* Live Status Badges - Same as MatchCard.tsx */}
                        {(() => {
                            const status = (match as any).status ?? (match as any).status_id ?? (match as any).match_status ?? 0;
                            const isLive = status >= 2 && status <= 7; // FIRST_HALF to PENALTY_SHOOTOUT
                            const isFinished = status === 8; // END
                            const minuteText = match.minute_text || '—';

                            return (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                                    {isLive && (
                                        <>
                                            {/* CRITICAL FIX: Halftime shows "DEVRE ARASI" instead of "CANLI" */}
                                            {status === 3 ? (
                                                <span style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#f59e0b',
                                                    color: 'white',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 'bold',
                                                    borderRadius: '6px',
                                                }}>
                                                    DEVRE ARASI
                                                </span>
                                            ) : (
                                                <span style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#ef4444',
                                                    color: 'white',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 'bold',
                                                    borderRadius: '6px',
                                                    animation: 'pulse 2s infinite',
                                                }}>
                                                    CANLI
                                                </span>
                                            )}
                                            {/* Phase 4-4: Display minute_text from backend */}
                                            {minuteText && minuteText !== '—' && (
                                                <span style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#f59e0b',
                                                    color: 'white',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 'bold',
                                                    borderRadius: '6px',
                                                }}>
                                                    {minuteText}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {isFinished && (
                                        <span style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#6b7280',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            fontWeight: 'bold',
                                            borderRadius: '6px',
                                        }}>
                                            MS
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                        <div style={{ fontSize: '48px', fontWeight: 'bold', letterSpacing: '4px' }}>
                            {match.home_score ?? 0} - {match.away_score ?? 0}
                        </div>
                        <p style={{ fontSize: '14px', opacity: 0.8, margin: '8px 0 0' }}>
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
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        {match.away_team?.logo_url && (
                            <img
                                src={match.away_team.logo_url}
                                alt=""
                                style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto 8px' }}
                            />
                        )}
                        <p style={{ fontWeight: '600', fontSize: '16px', margin: 0 }}>
                            {match.away_team?.name || 'Deplasman'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex' }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: '16px 8px',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                                backgroundColor: 'transparent',
                                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
                            <span style={{ fontSize: '12px' }}>{tab.label}</span>
                        </button>
                    ))}
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
                        {activeTab === 'stats' && <StatsContent data={tabData} match={match} />}
                        {activeTab === 'events' && <EventsContent data={tabData} match={match} />}
                        {activeTab === 'h2h' && <H2HContent data={tabData} />}
                        {activeTab === 'standings' && <StandingsContent data={tabData} homeTeamId={match.home_team_id} awayTeamId={match.away_team_id} />}
                        {activeTab === 'lineup' && <LineupContent data={tabData} match={match} />}
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

// Events Content (Timeline)
function EventsContent({ data, match }: { data: any; match: Match }) {
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MatchTrendChart
                data={data?.trend}
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
function LineupContent({ data, match }: { data: any; match: Match }) {
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
                            <div key={idx} style={{ padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '8px', fontSize: '14px' }}>
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
                            <div key={idx} style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '8px', fontSize: '14px' }}>
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
