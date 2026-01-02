
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLeagueById, getLeagueFixtures, getLeagueStandings } from '../../api/matches';

interface CompetitionData {
    id: string; // db id
    external_id: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
    country_id: string | null;
    country_name: string | null;
    category_id: string | null;
}

interface Standing {
    position: number;
    team_id: string;
    team_name: string;
    team_logo: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    points: number;
}

interface FixtureMatch {
    id: string;
    match_time: number;
    status_id: number;
    round: string | null;
    home_team: {
        id: string;
        name: string;
        logo_url: string | null;
    };
    away_team: {
        id: string;
        name: string;
        logo_url: string | null;
    };
    home_score: number | null;
    away_score: number | null;
}

export function CompetitionDetailPage() {
    const { id } = useParams<{ id: string }>(); // This is the external_id of the league
    const navigate = useNavigate();

    const [league, setLeague] = useState<CompetitionData | null>(null);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'fixtures' | 'standings' | 'stats'>('overview');

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch league details
                const leagueData = await getLeagueById(id);
                setLeague(leagueData.league);

                // Fetch standings
                const standingsData = await getLeagueStandings(id).catch(() => ({ standings: [] }));
                setStandings(standingsData.standings || []);

                // Fetch fixtures (limit 100 for now)
                const fixturesData = await getLeagueFixtures(id, { limit: 100 }).catch(() => ({ fixtures: [] }));
                setFixtures(fixturesData.fixtures || []);

            } catch (err: any) {
                setError(err.message || 'Lig bilgileri yüklenemedi');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
                <div className="text-center">
                    <div className="text-2xl mb-2">⏳</div>
                    Yükleniyor...
                </div>
            </div>
        );
    }

    if (error || !league) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">
                <div className="text-center">
                    <div className="text-2xl mb-2">❌</div>
                    {error || 'Lig bulunamadı'}
                    <div className="mt-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Geri Dön
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Upcoming matches (not finished)
    const upcomingMatches = fixtures
        .filter(m => m.status_id !== 8)
        .sort((a, b) => a.match_time - b.match_time);

    // Past matches (finished)
    const pastMatches = fixtures
        .filter(m => m.status_id === 8);

    return (
        <div className="min-h-screen bg-slate-900 text-white pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 relative overflow-hidden">
                {/* Background glow effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="max-w-4xl mx-auto relative z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
                    >
                        ← Geri
                    </button>

                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center p-4 backdrop-blur-sm border border-white/10 shadow-xl">
                            {league.logo_url ? (
                                <img src={league.logo_url} alt={league.name} className="w-full h-full object-contain drop-shadow-md" />
                            ) : (
                                <span className="text-4xl">🏆</span>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1 font-medium tracking-wide uppercase">
                                {league.country_name || 'Uluslararası'}
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{league.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-slate-300">
                                <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                                    <span className="text-emerald-400">●</span> Aktif Sezon
                                </div>
                                <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                                    {standings.length > 0 ? `${standings.length} Takım` : 'Takımlar yükleniyor'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
                <div className="max-w-4xl mx-auto flex overflow-x-auto no-scrollbar">
                    {[
                        { id: 'overview', label: '📊 Genel Bakış' },
                        { id: 'fixtures', label: '📅 Fikstür' },
                        { id: 'standings', label: '🏆 Puan Durumu' },
                        // { id: 'stats', label: '📈 İstatistikler' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                flex-1 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all relative
                ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}
              `}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Upcoming Matches */}
                        <div className="space-y-6">
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                                    <h3 className="font-semibold text-white">Gelecek Maçlar</h3>
                                    <button
                                        onClick={() => setActiveTab('fixtures')}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                    >
                                        Tümünü Gör →
                                    </button>
                                </div>
                                <div className="divide-y divide-slate-700/50">
                                    {upcomingMatches.length > 0 ? (
                                        upcomingMatches.slice(0, 5).map(match => (
                                            <MatchRow key={match.id} match={match} navigate={navigate} />
                                        ))
                                    ) : (
                                        <div className="p-6 text-center text-slate-500 text-sm">Gelecek maç bulunamadı</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Standings Summary */}
                        <div className="space-y-6">
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                                    <h3 className="font-semibold text-white">Zirve Yarışı</h3>
                                    <button
                                        onClick={() => setActiveTab('standings')}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                    >
                                        Detaylı Tablo →
                                    </button>
                                </div>
                                {standings.length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-slate-500 border-b border-slate-700/50 bg-slate-800/30">
                                                <th className="p-3 text-left font-medium w-10">#</th>
                                                <th className="p-3 text-left font-medium">Takım</th>
                                                <th className="p-3 text-center font-medium w-10">P</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {standings.slice(0, 5).map(s => (
                                                <tr key={s.team_id} className="hover:bg-slate-700/30 transition-colors">
                                                    <td className={`p-3 font-semibold ${s.position <= 1 ? 'text-yellow-400' :
                                                            s.position <= 4 ? 'text-blue-400' : 'text-slate-300'
                                                        }`}>{s.position}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            {s.team_logo ? (
                                                                <img src={s.team_logo} alt="" className="w-6 h-6 object-contain" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">⚽</div>
                                                            )}
                                                            <span
                                                                onClick={() => navigate(`/team/${s.team_id}`)}
                                                                className="text-white hover:text-blue-400 hover:underline cursor-pointer truncate max-w-[120px]"
                                                            >
                                                                {s.team_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-white bg-slate-800/30">{s.points}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6 text-center text-slate-500 text-sm">Puan durumu bulunamadı</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'fixtures' && (
                    <div className="space-y-6">
                        {/* Upcoming */}
                        {upcomingMatches.length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="p-4 bg-slate-800/80 border-b border-slate-700 font-semibold text-blue-400 sticky top-0">
                                    Gelecek Maçlar
                                </div>
                                <div className="divide-y divide-slate-700/50">
                                    {upcomingMatches.map(match => (
                                        <MatchRow key={match.id} match={match} navigate={navigate} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Past */}
                        {pastMatches.length > 0 && (
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="p-4 bg-slate-800/80 border-b border-slate-700 font-semibold text-slate-400 sticky top-0">
                                    Tamamlanan Maçlar
                                </div>
                                <div className="divide-y divide-slate-700/50">
                                    {pastMatches.map(match => (
                                        <MatchRow key={match.id} match={match} navigate={navigate} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {fixtures.length === 0 && (
                            <div className="p-12 text-center bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-500">
                                Henüz fikstür bulunamadı.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'standings' && (
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
                        {standings.length > 0 ? (
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                                        <th className="p-4 text-left font-medium w-14">Poz</th>
                                        <th className="p-4 text-left font-medium">Takım</th>
                                        <th className="p-4 text-center font-medium w-12 bg-slate-800/50">O</th>
                                        <th className="p-4 text-center font-medium w-12">G</th>
                                        <th className="p-4 text-center font-medium w-12">B</th>
                                        <th className="p-4 text-center font-medium w-12">M</th>
                                        <th className="p-4 text-center font-medium w-14">Avg</th>
                                        <th className="p-4 text-center font-bold text-white w-14 bg-slate-800/50">Puan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {standings.map((s, idx) => (
                                        <tr key={s.team_id} className="hover:bg-slate-700/30 transition-colors group">
                                            <td className="p-4">
                                                <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                          ${idx < 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                        idx < 4 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            idx >= standings.length - 3 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                                'bg-slate-700/30 text-slate-400'}
                        `}>
                                                    {s.position}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-4">
                                                    {s.team_logo ? (
                                                        <img src={s.team_logo} alt="" className="w-8 h-8 object-contain transition-transform group-hover:scale-110" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">⚽</div>
                                                    )}
                                                    <span
                                                        onClick={() => navigate(`/team/${s.team_id}`)}
                                                        className="text-white font-medium hover:text-blue-400 hover:underline cursor-pointer text-base"
                                                    >
                                                        {s.team_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center text-slate-300 bg-slate-800/30 font-medium">{s.played}</td>
                                            <td className="p-4 text-center text-emerald-400">{s.won}</td>
                                            <td className="p-4 text-center text-slate-400">{s.drawn}</td>
                                            <td className="p-4 text-center text-red-400">{s.lost}</td>
                                            <td className="p-4 text-center text-slate-300 font-medium">{s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}</td>
                                            <td className="p-4 text-center font-bold text-lg text-white bg-slate-800/30 shadow-inner">{s.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center text-slate-500">Puan durumu bulunamadı.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function MatchRow({ match, navigate }: { match: FixtureMatch; navigate: any }) {
    const isFinished = match.status_id === 8;
    const isLive = [2, 3, 4, 5, 7].includes(match.status_id);
    const matchDate = new Date(match.match_time * 1000);

    return (
        <div
            onClick={() => navigate(`/match/${match.id}`)}
            className="p-4 flex items-center hover:bg-slate-700/30 transition-colors cursor-pointer group"
        >
            {/* Date/Time */}
            <div className="w-20 text-center flex flex-col justify-center text-xs text-slate-400 font-medium border-r border-slate-700/50 pr-4 mr-4">
                <span className="mb-1">{matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                {isLive ? (
                    <span className="text-red-500 font-bold animate-pulse">CANLI</span>
                ) : (
                    <span className="text-slate-300">{matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
            </div>

            {/* Teams & Score */}
            <div className="flex-1 flex justify-between items-center relative">
                {/* Home */}
                <div className="flex-1 flex items-center justify-end gap-3 text-right">
                    <span className="font-medium text-white group-hover:text-blue-400 transition-colors">{match.home_team.name}</span>
                    {match.home_team.logo_url ? (
                        <img src={match.home_team.logo_url} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-700" />
                    )}
                </div>

                {/* Score Box */}
                <div className="w-20 flex justify-center">
                    {isFinished || isLive ? (
                        <div className={`
                 px-3 py-1 rounded-lg font-bold text-sm tracking-wider
                 ${isLive ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-slate-700 text-white'}
               `}>
                            {match.home_score} - {match.away_score}
                        </div>
                    ) : (
                        <div className="text-slate-500 text-xs font-medium bg-slate-800 px-2 py-1 rounded">VS</div>
                    )}
                </div>

                {/* Away */}
                <div className="flex-1 flex items-center gap-3 text-left">
                    {match.away_team.logo_url ? (
                        <img src={match.away_team.logo_url} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-700" />
                    )}
                    <span className="font-medium text-white group-hover:text-blue-400 transition-colors">{match.away_team.name}</span>
                </div>
            </div>

            {/* Arrow */}
            <div className="hidden md:block pl-4 text-slate-600 group-hover:text-blue-500 transition-colors">
                →
            </div>
        </div>
    );
}

export default CompetitionDetailPage;
