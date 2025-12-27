/**
 * Match Detail Page
 * 
 * Full page component for displaying detailed match information
 * Accessed via /match/:matchId route
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getMatchH2H,
    getMatchTeamStats,
    getMatchLineup,
    getSeasonStandings,
    getMatchDiary,
    getMatchTrend,
} from '../../api/matches';
import type { Match } from '../../api/matches';
import { MatchTrendChart } from './MatchTrendChart';

type TabType = 'stats' | 'h2h' | 'standings' | 'lineup';

export function MatchDetailPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();

    const [match, setMatch] = useState<Match | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('stats');
    const [loading, setLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabData, setTabData] = useState<any>(null);
    const [trendData, setTrendData] = useState<any>(null);

    // Fetch match info
    useEffect(() => {
        const fetchMatch = async () => {
            if (!matchId) return;

            setLoading(true);
            try {
                // Try to get match from diary (today's matches)
                const today = new Date().toISOString().split('T')[0];
                const response = await getMatchDiary(today);
                const foundMatch = response.results?.find((m: Match) => m.id === matchId);

                if (foundMatch) {
                    setMatch(foundMatch);
                } else {
                    setError('Maç bulunamadı');
                }
            } catch (err: any) {
                setError(err.message || 'Maç yüklenirken hata oluştu');
            } finally {
                setLoading(false);
            }
        };

        fetchMatch();
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
                        // Fetch both stats and trend data for stats tab
                        const [statsResult, trendResult] = await Promise.allSettled([
                            getMatchTeamStats(matchId),
                            getMatchTrend(matchId).catch(() => null) // Don't fail if trend fails
                        ]);
                        result = statsResult.status === 'fulfilled' ? statsResult.value : null;
                        setTrendData(trendResult.status === 'fulfilled' ? trendResult.value : null);
                        break;
                    case 'h2h':
                        result = await getMatchH2H(matchId);
                        setTrendData(null);
                        break;
                    case 'standings':
                        if (match.season_id) {
                            result = await getSeasonStandings(match.season_id);
                        } else {
                            result = null; // No season_id, result stays null
                        }
                        setTrendData(null);
                        break;
                    case 'lineup':
                        result = await getMatchLineup(matchId);
                        setTrendData(null);
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
        { id: 'h2h', label: 'H2H', icon: '⚔️' },
        { id: 'standings', label: 'Puan Durumu', icon: '🏆' },
        { id: 'lineup', label: 'Kadro', icon: '👥' },
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

                    {/* Score */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', fontWeight: 'bold', letterSpacing: '4px' }}>
                            {match.home_score ?? 0} - {match.away_score ?? 0}
                        </div>
                        <p style={{ fontSize: '14px', opacity: 0.8, margin: '8px 0 0' }}>
                            {match.minute_text || 'FT'}
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
                        {activeTab === 'stats' && <StatsContent data={tabData} match={match} trendData={trendData} />}
                        {activeTab === 'h2h' && <H2HContent data={tabData} />}
                        {activeTab === 'standings' && <StandingsContent data={tabData} homeTeamId={match.home_team_id} awayTeamId={match.away_team_id} />}
                        {activeTab === 'lineup' && <LineupContent data={tabData} match={match} />}
                    </>
                )}
            </div>
        </div>
    );
}

// Stats Tab Content
function StatsContent({ data, match, trendData }: { data: any; match: Match; trendData?: any }) {
    // Handle multiple response formats:
    // - live-stats: { stats: [...], incidents: [...] }
    // - team-stats: { results: [...] }
    const rawStats = data?.stats || data?.results || [];

    // Sort and filter unknown stats
    const stats = sortStats(rawStats).filter(s => getStatName(s.type) !== '');

    // Extract trend data from API response (already extracted by getMatchTrend API function)
    const trend = trendData;

    // If no data from API, show basic match stats
    if (!stats.length && match) {
        const basicStats = [
            { label: 'Gol', home: match.home_score ?? 0, away: match.away_score ?? 0 },
            { label: 'Sarı Kart', home: (match as any).home_yellow_cards ?? 0, away: (match as any).away_yellow_cards ?? 0 },
            { label: 'Kırmızı Kart', home: (match as any).home_red_cards ?? 0, away: (match as any).away_red_cards ?? 0 },
            { label: 'Korner', home: (match as any).home_corners ?? 0, away: (match as any).away_corners ?? 0 },
        ];

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Trend Chart */}
                {trend && (
                    <MatchTrendChart
                        data={trend}
                        homeTeamName={match.home_team?.name}
                        awayTeamName={match.away_team?.name}
                    />
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '16px' }}>
                        {data?.message || 'Detaylı istatistik verisi bulunamadı. Temel bilgiler gösteriliyor.'}
                    </p>
                    {basicStats.map((stat, idx) => (
                        <StatRow key={idx} label={stat.label} home={stat.home} away={stat.away} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Trend Chart - Show at the top */}
            {trend && (
                <MatchTrendChart
                    data={trend}
                    homeTeamName={match.home_team?.name}
                    awayTeamName={match.away_team?.name}
                />
            )}
            
            {/* Stats List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.map((stat: any, idx: number) => (
                    <StatRow key={idx} label={getStatName(stat.type)} home={stat.home ?? '-'} away={stat.away ?? '-'} />
                ))}
            </div>
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
                                <td style={{ padding: '12px 8px' }}>{team.team_name || `Takım ${idx + 1}`}</td>
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
