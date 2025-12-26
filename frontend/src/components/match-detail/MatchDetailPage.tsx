/**
 * Match Detail Page
 * 
 * Full page component for displaying detailed match information
 * Accessed via /match/:matchId route
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getMatchAnalysis,
    getMatchTeamStats,
    getMatchLineup,
    getSeasonStandings,
    getMatchDiary,
} from '../../api/matches';
import type { Match } from '../../api/matches';

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

            try {
                let result;
                switch (activeTab) {
                    case 'stats':
                        result = await getMatchTeamStats(matchId);
                        break;
                    case 'h2h':
                        result = await getMatchAnalysis(matchId);
                        break;
                    case 'standings':
                        if (match.season_id) {
                            result = await getSeasonStandings(match.season_id);
                        }
                        break;
                    case 'lineup':
                        result = await getMatchLineup(matchId);
                        break;
                }
                setTabData(result);
            } catch (err: any) {
                console.error('Tab data fetch error:', err);
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
                ) : (
                    <>
                        {activeTab === 'stats' && <StatsContent data={tabData} match={match} />}
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
function StatsContent({ data, match }: { data: any; match: Match }) {
    // Handle multiple response formats:
    // - live-stats: { stats: [...], incidents: [...] }
    // - team-stats: { results: [...] }
    const stats = data?.stats || data?.results || [];

    // If no data from API, show basic match stats
    if (!stats.length && match) {
        const basicStats = [
            { label: 'Gol', home: match.home_score ?? 0, away: match.away_score ?? 0 },
            { label: 'Sarı Kart', home: (match as any).home_yellow_cards ?? 0, away: (match as any).away_yellow_cards ?? 0 },
            { label: 'Kırmızı Kart', home: (match as any).home_red_cards ?? 0, away: (match as any).away_red_cards ?? 0 },
            { label: 'Korner', home: (match as any).home_corners ?? 0, away: (match as any).away_corners ?? 0 },
        ];

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '16px' }}>
                    {data?.message || 'Detaylı istatistik verisi bulunamadı. Temel bilgiler gösteriliyor.'}
                </p>
                {basicStats.map((stat, idx) => (
                    <StatRow key={idx} label={stat.label} home={stat.home} away={stat.away} />
                ))}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.map((stat: any, idx: number) => (
                <StatRow key={idx} label={getStatName(stat.type)} home={stat.home ?? '-'} away={stat.away ?? '-'} />
            ))}
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
    const h2hData = data?.results || data;

    if (!h2hData || Object.keys(h2hData).length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', backgroundColor: 'white', borderRadius: '12px' }}>
                H2H verisi bulunamadı
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 16px', fontWeight: '600' }}>Karşılıklı Maçlar</h3>
            <pre style={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                {JSON.stringify(h2hData, null, 2)}
            </pre>
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
// Reference: /match/detail_live and /match/team_stats/detail endpoint response types
// CRITICAL: These mappings are based on actual TheSports API documentation
function getStatName(type: number): string {
    const statNames: Record<number, string> = {
        // Real-time data stats (detail_live) - Basic match stats
        1: 'Korner',
        2: 'Sarı Kart',
        3: 'Kırmızı Kart',
        4: 'İsabetli Şut',
        5: 'İsabetsiz Şut',
        6: 'Atak',
        7: 'Tehlikeli Atak',
        8: 'Top Hakimiyeti',
        9: 'Penaltı',

        // Team stats (team_stats/detail) - Detailed statistics
        10: 'Toplam Şut',
        11: 'Toplam Pas',
        12: 'İsabetli Pas',
        13: 'Kilit Pas',
        14: 'Müdahale',
        15: 'Top Çalma',
        16: 'Faul',
        17: 'Ofsayt',
        18: 'İsabetli Orta',
        19: 'Uzun Pas',
        20: 'Uzaklaştırma',
        21: 'Bloke Şut',

        // Extended stats (some APIs return these)
        22: 'Pas İsabet Oranı',
        23: 'Kurtarış',
        24: 'Şut Bloğu',
        25: 'Topa Sahip Olma',
        26: 'Gol Vuruşu',
        27: 'Aut',
        28: 'Top Kaybı',
        29: 'İkili Mücadele',
        30: 'Kazanılan İkili Mücadele',
        31: 'Havada Kazanılan',
        32: 'Kaleci Çıkışı',
        33: 'Ceza Sahası Korner',
        34: 'Serbest Vuruş',
        35: 'Tehlikeli Serbest Vuruş',

        // Attack analysis
        37: 'Topla Oynama',
        38: 'Gol Pozisyonu',
        39: 'Önemli Pozisyon',
        40: 'Kaçan Pozisyon',

        // Penalty related
        41: 'Kazanılan Penaltı',
        42: 'Kaçırılan Penaltı',
        43: 'Kurtarılan Penaltı',
    };
    return statNames[type] || `İstatistik ${type}`;
}
