/**
 * Match Detail Modal
 * 
 * Modal component for displaying detailed match information
 * Includes tabs: H2H, Standings, Stats, Lineup, Trend
 */

import { useState, useEffect } from 'react';
import type { Match } from '../../api/matches';
import {
    getMatchAnalysis,
    getMatchTeamStats,
    getMatchLineup,
    getSeasonStandings,
    getMatchTrend,
    getMatchHalfStats,
    getMatchPlayerStats,
} from '../../api/matches';
import { MatchTrendChart } from './MatchTrendChart';

interface MatchDetailModalProps {
    match: Match;
    onClose: () => void;
}

type TabType = 'stats' | 'h2h' | 'standings' | 'lineup';

export function MatchDetailModal({ match, onClose }: MatchDetailModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('stats');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [trendData, setTrendData] = useState<any>(null);

    const matchId = (match as any).external_id || (match as any).match_id || match.id;
    const seasonId = match.season_id;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setData(null);
            setTrendData(null);

            try {
                let result;
                switch (activeTab) {
                    case 'stats':
                        // Fetch both full time, half time stats and trend data for stats tab
                        const [statsResult, halfStatsResult, trendResult] = await Promise.allSettled([
                            getMatchTeamStats(matchId),
                            getMatchHalfStats(matchId).catch(() => null), // Don't fail if half stats fails
                            getMatchTrend(matchId).catch(() => null) // Don't fail if trend fails
                        ]);
                        result = {
                            fullTime: statsResult.status === 'fulfilled' ? statsResult.value : null,
                            halfTime: halfStatsResult.status === 'fulfilled' ? halfStatsResult.value : null,
                        };
                        setTrendData(trendResult.status === 'fulfilled' ? trendResult.value : null);
                        break;
                    case 'h2h':
                        result = await getMatchAnalysis(matchId);
                        setTrendData(null);
                        break;
                    case 'standings':
                        if (seasonId) {
                            result = await getSeasonStandings(seasonId);
                        } else {
                            result = null; // No season_id
                        }
                        setTrendData(null);
                        break;
                    case 'lineup':
                        // Fetch Lineup and Player Stats together
                        const [lineupResult, playerStatsResult] = await Promise.all([
                            getMatchLineup(matchId),
                            getMatchPlayerStats(matchId).catch(() => null) // Don't fail if stats missing
                        ]);
                        result = {
                            lineup: lineupResult,
                            stats: playerStatsResult
                        };
                        setTrendData(null);
                        break;
                }
                setData(result);
            } catch (err: any) {
                console.error('Tab data fetch error:', err);
                setError(err.message || 'Veri yüklenirken hata oluştu');
                setData(null); // Ensure data is null on error
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, matchId, seasonId]);

    const tabs: { id: TabType; label: string }[] = [
        { id: 'stats', label: 'İstatistikler' },
        { id: 'h2h', label: 'H2H' },
        { id: 'standings', label: 'Puan Durumu' },
        { id: 'lineup', label: 'Kadro' },
    ];

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    width: '90%',
                    maxWidth: '800px',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Home Team */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {match.home_team?.logo_url && (
                                <img
                                    src={match.home_team.logo_url}
                                    alt=""
                                    style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                                />
                            )}
                            <span style={{ fontWeight: '600', fontSize: '16px' }}>
                                {match.home_team?.name || 'Ev Sahibi'}
                            </span>
                        </div>

                        {/* Score */}
                        <div
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#1f2937',
                                borderRadius: '8px',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '18px',
                            }}
                        >
                            {match.home_score ?? 0} - {match.away_score ?? 0}
                        </div>

                        {/* Away Team */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '600', fontSize: '16px' }}>
                                {match.away_team?.name || 'Deplasman'}
                            </span>
                            {match.away_team?.logo_url && (
                                <img
                                    src={match.away_team.logo_url}
                                    alt=""
                                    style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                                />
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: '#e5e7eb',
                            cursor: 'pointer',
                            fontSize: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div
                    style={{
                        display: 'flex',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: 'white',
                    }}
                >
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                border: 'none',
                                backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
                                color: activeTab === tab.id ? 'white' : '#6b7280',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '20px',
                    }}
                >
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                            Yükleniyor...
                        </div>
                    )}

                    {error && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '40px',
                                color: '#ef4444',
                                backgroundColor: '#fef2f2',
                                borderRadius: '8px',
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {!loading && !error && data && (
                        <div>
                            {activeTab === 'stats' && <StatsContent data={data} match={match} trendData={trendData} />}
                            {activeTab === 'h2h' && <H2HContent data={data} />}
                            {activeTab === 'standings' && <StandingsContent data={data} homeTeamId={match.home_team_id} awayTeamId={match.away_team_id} />}
                            {activeTab === 'lineup' && <LineupContent data={data} />}
                        </div>
                    )}

                    {!loading && !error && !data && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                            Veri bulunamadı
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Stats Tab Content
function StatsContent({ data, match, trendData }: { data: any; match?: Match; trendData?: any }) {
    const [activePeriod, setActivePeriod] = useState<'full' | 'first' | 'second'>('full');

    // Parse half time stats data
    const parseHalfStats = (halfData: any, sign: 'p1' | 'p2' | 'ft'): any[] => {
        if (!halfData?.results || !Array.isArray(halfData.results)) {
            return [];
        }

        const stats: any[] = [];
        for (const statObj of halfData.results) {
            if (statObj.Sign !== sign) continue;

            for (const [key, value] of Object.entries(statObj)) {
                if (key === 'Sign') continue;
                const statId = Number(key);
                if (isNaN(statId)) continue;
                const values = Array.isArray(value) ? value : [];
                if (values.length >= 2) {
                    stats.push({ type: statId, home: values[0], away: values[1] });
                }
            }
        }
        return stats;
    };

    let rawStats: any[] = [];
    if (activePeriod === 'full') {
        rawStats = data?.fullTime?.results || data?.results || [];
    } else if (activePeriod === 'first') {
        rawStats = parseHalfStats(data?.halfTime, 'p1');
    } else if (activePeriod === 'second') {
        rawStats = parseHalfStats(data?.halfTime, 'p2');
    }

    const stats = sortStats(rawStats).filter(s => getStatName(s.type) !== '');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trendData && match && (
                <MatchTrendChart
                    data={trendData}
                    homeTeamName={match.home_team?.name}
                    awayTeamName={match.away_team?.name}
                    homeTeamLogo={match.home_team?.logo_url}
                    awayTeamLogo={match.away_team?.logo_url}
                />
            )}

            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
                {(['full', 'first', 'second'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setActivePeriod(p)}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            background: activePeriod === p ? '#3b82f6' : 'transparent',
                            color: activePeriod === p ? 'white' : '#6b7280',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: activePeriod === p ? '600' : '400',
                        }}
                    >
                        {p === 'full' ? 'TÜMÜ' : p === 'first' ? '1. YARI' : '2. YARI'}
                    </button>
                ))}
            </div>

            {stats.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {stats.map((stat: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ flex: 1, textAlign: 'right', fontWeight: '600' }}>{stat.home ?? '-'}</span>
                            <span style={{ flex: 2, textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>{getStatName(stat.type)}</span>
                            <span style={{ flex: 1, textAlign: 'left', fontWeight: '600' }}>{stat.away ?? '-'}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    {activePeriod === 'first' ? '1. yarı istatistikleri henüz mevcut değil.' :
                        activePeriod === 'second' ? '2. yarı istatistikleri henüz mevcut değil.' :
                            'İstatistik verisi bulunamadı.'}
                </div>
            )}
        </div>
    );
}

// H2H Tab Content
function H2HContent({ data }: { data: any }) {
    const h2hMatches = data?.results?.h2h || data?.h2h || [];

    if (!h2hMatches.length) {
        return <div style={{ textAlign: 'center', color: '#6b7280' }}>H2H verisi bulunamadı</div>;
    }

    return (
        <div>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '600' }}>Son Karşılaşmalar</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {h2hMatches.slice(0, 10).map((match: any, idx: number) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                        }}
                    >
                        <span style={{ flex: 1 }}>Maç {idx + 1}</span>
                        <span style={{ fontWeight: '600' }}>
                            {match.home_score} - {match.away_score}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Standings Tab Content
function StandingsContent({ data, homeTeamId, awayTeamId }: { data: any; homeTeamId: string; awayTeamId: string }) {
    const standings = data?.results?.standings || data?.standings || [];

    if (!standings.length) {
        return <div style={{ textAlign: 'center', color: '#6b7280' }}>Puan durumu bulunamadı</div>;
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Takım</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>O</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>G</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>B</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>M</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>P</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((team: any, idx: number) => {
                        const isHighlighted = team.team_id === homeTeamId || team.team_id === awayTeamId;
                        return (
                            <tr
                                key={idx}
                                style={{
                                    backgroundColor: isHighlighted ? '#dbeafe' : 'transparent',
                                    borderBottom: '1px solid #e5e7eb',
                                }}
                            >
                                <td style={{ padding: '8px', fontWeight: '600' }}>{team.position || idx + 1}</td>
                                <td style={{ padding: '8px' }}>{team.team_name || `Takım ${idx + 1}`}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{team.played}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{team.won}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{team.drawn}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{team.lost}</td>
                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>{team.points}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// Lineup Tab Content
function LineupContent({ data }: { data: any }) {
    // data.lineup contains the lineup info
    // data.stats contains the player stats (including ratings)

    // Fallback if data is just the lineup itself (backward compat)
    const lineupData = data?.lineup?.results || data?.lineup || data?.results || data;
    const statsData = data?.stats?.results || data?.stats;

    // Helper to get rating for a player
    const getRating = (playerId: string) => {
        if (!statsData || !Array.isArray(statsData)) return null;

        // Find the stats object (it might be nested in results array which contains matches)
        // Adjust based on exact API response. Assuming statsData is the array of matches or stats directly.
        // The endpoint returns { results: [ { id: matchId, player_stats: [...] } ] }
        // So statsData might be that result array.

        // Flatten stats if needed or search directly
        const matchStats = Array.isArray(statsData) ? statsData[0] : statsData;
        if (!matchStats?.player_stats) return null;

        const playerStats = matchStats.player_stats.find((p: any) => p.player_id === playerId);
        return playerStats?.rating ? parseFloat(playerStats.rating).toFixed(1) : null;
    };

    if (!lineupData) {
        return <div style={{ textAlign: 'center', color: '#6b7280' }}>Kadro bilgisi bulunamadı</div>;
    }

    const homeLineup = lineupData.home || lineupData.home_lineup || [];
    const awayLineup = lineupData.away || lineupData.away_lineup || [];

    // Rating color helper
    const getRatingColor = (rating: string | null) => {
        if (!rating) return '#9ca3af'; // gray
        const r = parseFloat(rating);
        if (r >= 7.5) return '#10b981'; // green
        if (r >= 6.5) return '#f59e0b'; // orange
        return '#ef4444'; // red
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#1f2937' }}>Ev Sahibi</h4>
                {homeLineup.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {homeLineup.slice(0, 11).map((player: any, idx: number) => {
                            const rating = getRating(player.id || player.player_id);
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {player.shirt_number && (
                                            <span style={{ fontWeight: '600', marginRight: '8px', minWidth: '20px' }}>
                                                {player.shirt_number}
                                            </span>
                                        )}
                                        {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                                    </div>

                                    {rating && (
                                        <div style={{
                                            backgroundColor: getRatingColor(rating),
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            {rating}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: '#6b7280' }}>Kadro bilgisi yok</div>
                )}
            </div>
            <div>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#1f2937' }}>Deplasman</h4>
                {awayLineup.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {awayLineup.slice(0, 11).map((player: any, idx: number) => {
                            const rating = getRating(player.id || player.player_id);
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '8px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {player.shirt_number && (
                                            <span style={{ fontWeight: '600', marginRight: '8px', minWidth: '20px' }}>
                                                {player.shirt_number}
                                            </span>
                                        )}
                                        {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                                    </div>
                                    {rating && (
                                        <div style={{
                                            backgroundColor: getRatingColor(rating),
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            {rating}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: '#6b7280' }}>Kadro bilgisi yok</div>
                )}
            </div>
        </div>
    );
}

// Helper function to get stat name in Turkish
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
