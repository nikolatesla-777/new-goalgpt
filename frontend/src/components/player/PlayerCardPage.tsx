/**
 * Player Card Page
 * 
 * Displays player profile, career stats, and match history
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlayerById } from '../../api/matches';

interface PlayerData {
    id: string;
    external_id: string;
    name: string;
    short_name: string | null;
    logo: string | null;
    team_id: string | null;
    team_name: string | null;
    team_logo: string | null;
    country_id: string | null;
    country_name: string | null;
    nationality: string | null;
    position: string | null;
    shirt_number: number | null;
    age: number | null;
    birthday: string | null;
    height: number | null;
    weight: number | null;
    market_value: number | null;
    market_value_currency: string | null;
    preferred_foot: string | null;
    season_stats: any;
}

interface PlayerMatch {
    id: string;
    external_id: string;
    home_team_name: string;
    away_team_name: string;
    home_team_logo: string | null;
    away_team_logo: string | null;
    home_score: string;
    away_score: string;
    match_time: number;
    competition_name: string;
    player_stats: {
        goals?: number;
        assists?: number;
        minutes_played?: number;
        rating?: string;
    } | null;
}

export function PlayerCardPage() {
    const { playerId } = useParams<{ playerId: string }>();
    const navigate = useNavigate();

    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [matches, setMatches] = useState<PlayerMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!playerId) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getPlayerById(playerId);
                setPlayer(data.player);
                setMatches(data.matches || []);
            } catch (err: any) {
                setError(err.message || 'Oyuncu bilgileri alınamadı');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [playerId]);

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
            <div style={{ color: '#6b7280' }}>Yükleniyor...</div>
        </div>
    );

    if (error || !player) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚫</div>
                <div style={{ color: '#ef4444' }}>{error || 'Oyuncu bulunamadı'}</div>
                <button onClick={() => navigate(-1)} style={{ marginTop: '16px', padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>Geri Dön</button>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Hero / Header Section */}
            <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #172554 100%)', color: 'white', padding: '32px 16px 48px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        ← Geri
                    </button>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                        <div style={{ position: 'relative' }}>
                            {player.logo ? (
                                <img src={player.logo} alt={player.name} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.2)' }} />
                            ) : (
                                <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>👤</div>
                            )}
                            {player.country_id && (
                                <div style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                    {/* Flag placeholder - TheSports doesn't always give flag URL directly, using emoji if possible or just simplified */}
                                    <span style={{ fontSize: '16px' }}>🏳️</span>
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{player.name}</h1>
                                {player.shirt_number && <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>#{player.shirt_number}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', color: 'rgba(255,255,255,0.8)' }}>
                                {player.team_name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => player.team_id && navigate(`/team/${player.team_id}`)}>
                                        {player.team_logo && <img src={player.team_logo} width="20" height="20" alt="" style={{ objectFit: 'contain' }} />}
                                        <span style={{ fontWeight: '500', textDecoration: 'underline' }}>{player.team_name}</span>
                                    </div>
                                )}
                                <span>|</span>
                                <span>{player.position || 'N/A'}</span>
                                <span>|</span>
                                <span>{player.age ? `${player.age} Yaşında` : 'Yaş Yok'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ maxWidth: '800px', margin: '-32px auto 0', padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                    { label: 'Piyasa Değeri', value: player.market_value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', notation: "compact" }).format(player.market_value) : 'N/A', icon: '💰' },
                    { label: 'Boy', value: player.height ? `${player.height} cm` : 'N/A', icon: '📏' },
                    { label: 'Ayak', value: player.preferred_foot === '1' ? 'Sol' : player.preferred_foot === '2' ? 'Sağ' : player.preferred_foot === '3' ? 'Çift' : 'N/A', icon: '👟' },
                    { label: 'Uyruk', value: player.nationality || 'N/A', icon: '🌍' },
                ].map((stat, i) => (
                    <div key={i} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', marginBottom: '4px' }}>{stat.icon}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>{stat.label}</div>
                        <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Content Section */}
            <div style={{ maxWidth: '800px', margin: '24px auto', padding: '0 16px', display: 'grid', gap: '24px' }}>
                {/* Season Stats */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>📊 Sezon İstatistikleri</h3>
                    <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                        {/* Using mock stats logic or safe access if API returns structured stats */}
                        {/* For now, assuming standard stats might be null or simplified */}
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Maç</div>
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e3a5f' }}>{player.season_stats?.matches_total || '-'}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Gol</div>
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>{player.season_stats?.goals_total || '-'}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Asist</div>
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>{player.season_stats?.assists_total || '-'}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Dakika</div>
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{player.season_stats?.minutes_played_total || '-'}</div>
                        </div>
                    </div>
                </div>

                {/* Match History */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>📜 Son Oynanan Maçlar</h3>
                    {matches.length > 0 ? (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {matches.map(match => {
                                const rating = match.player_stats?.rating;
                                return (
                                    <div key={match.id} onClick={() => navigate(`/match/${match.external_id}`)} style={{ display: 'flex', alignItems: 'center', padding: '12px', border: '1px solid #f3f4f6', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '40%' }}>
                                            <div style={{ fontSize: '12px', color: '#6b7280', width: '60px' }}>{new Date(match.match_time * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: match.home_team_name === player.team_name ? 'bold' : 'normal' }}>
                                                    {match.home_team_logo && <img src={match.home_team_logo} width="16" height="16" alt="" />} {match.home_team_name}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: match.away_team_name === player.team_name ? 'bold' : 'normal' }}>
                                                    {match.away_team_logo && <img src={match.away_team_logo} width="16" height="16" alt="" />} {match.away_team_name}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e3a5f' }}>
                                            {match.home_score} - {match.away_score}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '30%', justifyContent: 'flex-end' }}>
                                            {match.player_stats?.goals ? <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>⚽ {match.player_stats.goals}</span> : null}
                                            {match.player_stats?.assists ? <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>🅰️ {match.player_stats.assists}</span> : null}
                                            {rating && <span style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>{rating}</span>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>Son maç bilgisi bulunamadı.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
