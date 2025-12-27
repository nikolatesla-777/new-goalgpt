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
                        // Fetch both stats and trend data for stats tab
                        const [statsResult, trendResult] = await Promise.allSettled([
                            getMatchTeamStats(matchId),
                            getMatchTrend(matchId).catch(() => null) // Don't fail if trend fails
                        ]);
                        result = statsResult.status === 'fulfilled' ? statsResult.value : null;
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
                        result = await getMatchLineup(matchId);
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
    const stats = data?.results || [];

    if (!stats.length) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Trend Chart */}
                {trendData && match && (
                    <MatchTrendChart
                        data={trendData}
                        homeTeamName={match.home_team?.name}
                        awayTeamName={match.away_team?.name}
                        homeTeamLogo={match.home_team?.logo_url}
                        awayTeamLogo={match.away_team?.logo_url}
                    />
                )}
                <div style={{ textAlign: 'center', color: '#6b7280' }}>İstatistik verisi bulunamadı</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Trend Chart - Show at the top */}
            {trendData && match && (
                <MatchTrendChart
                    data={trendData}
                    homeTeamName={match.home_team?.name}
                    awayTeamName={match.away_team?.name}
                    homeTeamLogo={match.home_team?.logo_url}
                    awayTeamLogo={match.away_team?.logo_url}
                />
            )}
            
            {/* Stats List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.map((stat: any, idx: number) => (
                <div
                    key={idx}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                    }}
                >
                    <span style={{ flex: 1, textAlign: 'right', fontWeight: '600' }}>
                        {stat.home ?? '-'}
                    </span>
                    <span style={{ flex: 2, textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                        {getStatName(stat.type)}
                    </span>
                    <span style={{ flex: 1, textAlign: 'left', fontWeight: '600' }}>
                        {stat.away ?? '-'}
                    </span>
                </div>
            ))}
            </div>
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
    const lineup = data?.results || data;

    if (!lineup) {
        return <div style={{ textAlign: 'center', color: '#6b7280' }}>Kadro bilgisi bulunamadı</div>;
    }

    const homeLineup = lineup.home || lineup.home_lineup || [];
    const awayLineup = lineup.away || lineup.away_lineup || [];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#1f2937' }}>Ev Sahibi</h4>
                {homeLineup.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {homeLineup.slice(0, 11).map((player: any, idx: number) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '8px',
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                }}
                            >
                                {player.shirt_number && <span style={{ fontWeight: '600', marginRight: '8px' }}>{player.shirt_number}</span>}
                                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: '#6b7280' }}>Kadro bilgisi yok</div>
                )}
            </div>
            <div>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#1f2937' }}>Deplasman</h4>
                {awayLineup.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {awayLineup.slice(0, 11).map((player: any, idx: number) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '8px',
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                }}
                            >
                                {player.shirt_number && <span style={{ fontWeight: '600', marginRight: '8px' }}>{player.shirt_number}</span>}
                                {player.name || player.player_name || `Oyuncu ${idx + 1}`}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: '#6b7280' }}>Kadro bilgisi yok</div>
                )}
            </div>
        </div>
    );
}

// Helper function to get stat name in Turkish
function getStatName(type: number): string {
    const statNames: Record<number, string> = {
        2: 'Şut',
        3: 'İsabetli Şut',
        4: 'Bloke',
        8: 'Korner',
        21: 'Sarı Kart',
        22: 'Kırmızı Kart',
        23: 'Toplam Pas',
        24: 'İsabetli Pas',
        25: 'Topa Sahip Olma %',
        26: 'Faul',
        27: 'Ofsayt',
        37: 'Atak',
        38: 'Tehlikeli Atak',
    };
    return statNames[type] || `İstatistik ${type}`;
}
