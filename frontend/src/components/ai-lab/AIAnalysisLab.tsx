import { useState, useEffect } from 'react';
import {
    Brain,
    TrendUp,
    Target,
    Warning,
    CheckCircle,
    XCircle,
    ChartBar,
    Users,
    Flag,
    Lightning,
    CaretRight,
    Sparkle,
    MagnifyingGlass,
    CircleNotch,
    CalendarBlank
} from '@phosphor-icons/react';

// Types
interface MatchData {
    match: {
        id: string;
        external_id: string;
        home_team: string;
        away_team: string;
        home_logo: string;
        away_logo: string;
        date: string;
        league: string;
        status_id: number;
    };
    potentials: {
        btts_potential: number | null;
        over25_potential: number | null;
        over15_potential: number | null;
        corners_potential: number | null;
        cards_potential: number | null;
    };
    xg: {
        home_xg_prematch: number | null;
        away_xg_prematch: number | null;
        total_xg: number | null;
    };
    form: {
        home_form: string | null;
        away_form: string | null;
        home_ppg: number | null;
        away_ppg: number | null;
    };
    h2h: {
        total_matches: number;
        home_wins: number;
        draws: number;
        away_wins: number;
        btts_percentage: number | null;
        avg_goals: number | null;
    } | null;
    odds: {
        home_win: number | null;
        draw: number | null;
        away_win: number | null;
    } | null;
    trends: {
        home: Array<{ type: string; text: string }>;
        away: Array<{ type: string; text: string }>;
    };
    data_source: {
        has_footystats_match: boolean;
        has_home_team_data: boolean;
        has_away_team_data: boolean;
    };
}

interface TodayMatch {
    fs_id: number;
    home_name: string;
    away_name: string;
    league_name?: string | null;
    country?: string | null;
    date_unix: number;
    status: string;
    score: string | null;
    potentials: {
        btts: number | null;
        over25: number | null;
        avg: number | null;
    };
    xg?: {
        home: number | null;
        away: number | null;
    };
    odds?: {
        home: number | null;
        draw: number | null;
        away: number | null;
    };
}

// FootyStats detailed match data
interface FSMatchDetail {
    fs_id: number;
    home_name: string;
    away_name: string;
    date_unix: number;
    status: string;
    score: string | null;
    potentials: {
        btts: number | null;
        over25: number | null;
        over15: number | null;
        corners: number | null;
        cards: number | null;
    };
    xg: {
        home: number | null;
        away: number | null;
        total: number | null;
    };
    odds: {
        home: number | null;
        draw: number | null;
        away: number | null;
    };
    form?: {
        home: { overall: string | null; home_only: string | null; ppg: number | null; btts_pct: number | null; over25_pct: number | null };
        away: { overall: string | null; away_only: string | null; ppg: number | null; btts_pct: number | null; over25_pct: number | null };
    };
    h2h?: {
        total_matches: number;
        home_wins: number;
        draws: number;
        away_wins: number;
        btts_pct: number | null;
        avg_goals: number | null;
    };
    trends?: {
        home: Array<{ sentiment: string; text: string }>;
        away: Array<{ sentiment: string; text: string }>;
    };
}

interface LiveMatch {
    id: string;
    home_team_name: string;
    away_team_name: string;
    home_logo?: string;
    away_logo?: string;
    league_name: string;
    status_id: number;
}

// Progress Bar Component
function ProgressBar({ value, max = 100, color = 'blue' }: { value: number; max?: number; color?: string }) {
    const percentage = Math.min((value / max) * 100, 100);
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
        purple: 'bg-purple-500'
    };

    return (
        <div className="w-full bg-gray-700 rounded-full h-3">
            <div
                className={`h-3 rounded-full transition-all duration-500 ${colorClasses[color]}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

// Form Display Component
function FormDisplay({ form, label }: { form: string | null; label: string }) {
    if (!form) return (
        <div>
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-gray-500 text-sm">Veri yok</div>
        </div>
    );

    const getFormColor = (char: string) => {
        switch (char.toUpperCase()) {
            case 'W': return 'bg-green-500';
            case 'D': return 'bg-yellow-500';
            case 'L': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div>
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="flex gap-1">
                {form.split('').slice(0, 5).map((char, i) => (
                    <span
                        key={i}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white ${getFormColor(char)}`}
                    >
                        {char.toUpperCase()}
                    </span>
                ))}
            </div>
        </div>
    );
}

// Trend Item Component
function TrendItem({ type, text }: { type: string; text: string }) {
    const getIcon = () => {
        switch (type.toLowerCase()) {
            case 'great':
            case 'positive':
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'bad':
            case 'negative':
                return <XCircle className="w-4 h-4 text-red-400" />;
            case 'chart':
                return <ChartBar className="w-4 h-4 text-blue-400" />;
            case 'warning':
                return <Warning className="w-4 h-4 text-yellow-400" />;
            default:
                return <CaretRight className="w-4 h-4 text-gray-400" />;
        }
    };

    const getBgColor = () => {
        switch (type.toLowerCase()) {
            case 'great':
            case 'positive':
                return 'bg-green-500/10 border-l-2 border-green-500';
            case 'bad':
            case 'negative':
                return 'bg-red-500/10 border-l-2 border-red-500';
            case 'chart':
                return 'bg-blue-500/10 border-l-2 border-blue-500';
            default:
                return 'bg-gray-700/30';
        }
    };

    return (
        <div className={`flex items-start gap-3 p-3 rounded-lg ${getBgColor()}`}>
            {getIcon()}
            <span className="text-sm text-gray-300">{text}</span>
        </div>
    );
}

// No Data Placeholder
function NoDataPlaceholder({ message }: { message: string }) {
    return (
        <div className="text-center py-8 text-gray-500">
            <Warning className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{message}</p>
        </div>
    );
}

// Main Component
export function AIAnalysisLab() {
    const [matchData, setMatchData] = useState<MatchData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
    const [todayMatches, setTodayMatches] = useState<TodayMatch[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'live' | 'footystats'>('live');

    // FootyStats detail panel state
    const [selectedFsMatch, setSelectedFsMatch] = useState<FSMatchDetail | null>(null);
    const [fsLoading, setFsLoading] = useState(false);
    const [fsDetailTab, setFsDetailTab] = useState<'potentials' | 'form' | 'h2h' | 'trends' | 'odds'>('potentials');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch live matches from TheSports
    useEffect(() => {
        async function fetchLiveMatches() {
            try {
                const response = await fetch('/api/matches/live');
                const data = await response.json();
                if (data.matches) {
                    setLiveMatches(data.matches);
                }
            } catch (err) {
                console.error('Error fetching live matches:', err);
            }
        }

        fetchLiveMatches();
        const interval = setInterval(fetchLiveMatches, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    // Fetch today's matches from FootyStats
    useEffect(() => {
        async function fetchTodayMatches() {
            try {
                const response = await fetch('/api/footystats/today');
                const data = await response.json();
                if (data.matches) {
                    setTodayMatches(data.matches);
                }
            } catch (err) {
                console.error('Error fetching FootyStats matches:', err);
            }
        }

        fetchTodayMatches();
    }, []);

    // Fetch match analysis when a match is selected (for Live matches)
    async function fetchMatchAnalysis(matchId: string) {
        setLoading(true);
        setError(null);
        setSelectedMatchId(matchId);
        setSelectedFsMatch(null); // Clear FS selection

        try {
            const response = await fetch(`/api/footystats/analysis/${matchId}`);
            if (!response.ok) {
                throw new Error('Maç verisi alınamadı');
            }
            const data = await response.json();
            setMatchData(data);
        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu');
            setMatchData(null);
        } finally {
            setLoading(false);
        }
    }

    // Fetch FootyStats match details by fs_id
    async function fetchFsMatchDetail(match: TodayMatch) {
        setFsLoading(true);
        setSelectedMatchId(null); // Clear Live selection
        setMatchData(null);

        try {
            const response = await fetch(`/api/footystats/match/${match.fs_id}`);
            if (!response.ok) {
                // If endpoint doesn't exist yet, use the data we already have
                setSelectedFsMatch({
                    fs_id: match.fs_id,
                    home_name: match.home_name,
                    away_name: match.away_name,
                    date_unix: match.date_unix,
                    status: match.status,
                    score: match.score,
                    potentials: {
                        btts: match.potentials.btts,
                        over25: match.potentials.over25,
                        over15: match.potentials.avg ? Math.min(Math.round(match.potentials.avg * 30), 95) : null,
                        corners: null,
                        cards: null,
                    },
                    xg: {
                        home: match.xg?.home || null,
                        away: match.xg?.away || null,
                        total: match.xg?.home && match.xg?.away ? match.xg.home + match.xg.away : null,
                    },
                    odds: {
                        home: match.odds?.home || null,
                        draw: match.odds?.draw || null,
                        away: match.odds?.away || null,
                    },
                });
                return;
            }
            const data = await response.json();
            setSelectedFsMatch(data);
        } catch (err: any) {
            // Fallback to basic data
            setSelectedFsMatch({
                fs_id: match.fs_id,
                home_name: match.home_name,
                away_name: match.away_name,
                date_unix: match.date_unix,
                status: match.status,
                score: match.score,
                potentials: {
                    btts: match.potentials.btts,
                    over25: match.potentials.over25,
                    over15: null,
                    corners: null,
                    cards: null,
                },
                xg: {
                    home: match.xg?.home || null,
                    away: match.xg?.away || null,
                    total: null,
                },
                odds: {
                    home: match.odds?.home || null,
                    draw: match.odds?.draw || null,
                    away: match.odds?.away || null,
                },
            });
        } finally {
            setFsLoading(false);
        }
    }

    const hasData = matchData?.data_source?.has_footystats_match ||
                    matchData?.data_source?.has_home_team_data ||
                    matchData?.data_source?.has_away_team_data;

    // Filter matches based on search query
    const filteredLiveMatches = liveMatches.filter(match => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            match.home_team_name?.toLowerCase().includes(query) ||
            match.away_team_name?.toLowerCase().includes(query) ||
            match.league_name?.toLowerCase().includes(query)
        );
    });

    const filteredTodayMatches = todayMatches.filter(match => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            match.home_name?.toLowerCase().includes(query) ||
            match.away_name?.toLowerCase().includes(query) ||
            match.league_name?.toLowerCase().includes(query) ||
            match.country?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Brain className="w-8 h-8 text-purple-400" />
                    <h1 className="text-3xl font-bold">AI Analiz Laboratuvarı</h1>
                    <span className="px-3 py-1 bg-purple-600/30 text-purple-300 text-xs rounded-full">BETA</span>
                </div>
                <p className="text-gray-400">FootyStats verileriyle güçlendirilmiş akıllı maç analizi</p>
            </div>

            {/* Match Selector */}
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <MagnifyingGlass className="w-5 h-5 text-gray-400" />
                        <h2 className="font-semibold">Maç Seçin</h2>
                    </div>

                    {/* Search Input */}
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Takım veya lig ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <MagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 md:ml-auto">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                activeTab === 'live'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            🔴 Canlı ({filteredLiveMatches.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('footystats')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                activeTab === 'footystats'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            <CalendarBlank className="w-4 h-4 inline mr-1" />
                            FootyStats ({filteredTodayMatches.length})
                        </button>
                    </div>
                </div>

                {/* Live Matches List */}
                {activeTab === 'live' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                        {filteredLiveMatches.length === 0 ? (
                            <div className="col-span-full text-center py-8 text-gray-500">
                                {searchQuery ? `"${searchQuery}" için sonuç bulunamadı` : 'Şu anda canlı maç yok'}
                            </div>
                        ) : (
                            filteredLiveMatches.map((match) => (
                                <button
                                    key={match.id}
                                    onClick={() => fetchMatchAnalysis(match.id)}
                                    className={`p-3 rounded-lg text-left transition ${
                                        selectedMatchId === match.id
                                            ? 'bg-purple-600/30 border border-purple-500'
                                            : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                                    }`}
                                >
                                    <div className="text-xs text-gray-400 mb-1">{match.league_name}</div>
                                    <div className="font-medium text-sm">
                                        {match.home_team_name} vs {match.away_team_name}
                                    </div>
                                    <div className="text-xs text-green-400 mt-1">🔴 CANLI</div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* FootyStats Matches List */}
                {activeTab === 'footystats' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                        {filteredTodayMatches.length === 0 ? (
                            <div className="col-span-full text-center py-8 text-gray-500">
                                {searchQuery ? (
                                    <div>
                                        <p>"{searchQuery}" için sonuç bulunamadı</p>
                                        <p className="text-xs mt-2 text-gray-600">
                                            Mevcut ligler: Premier League, Ligue 1, Pro League, A-League
                                        </p>
                                    </div>
                                ) : 'FootyStats\'tan bugünkü maç verisi yok'}
                            </div>
                        ) : (
                            filteredTodayMatches.map((match) => (
                                <button
                                    key={match.fs_id}
                                    onClick={() => fetchFsMatchDetail(match)}
                                    className={`p-3 rounded-lg text-left transition ${
                                        selectedFsMatch?.fs_id === match.fs_id
                                            ? 'bg-blue-600/30 border border-blue-500'
                                            : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                                    }`}
                                >
                                    {match.league_name && (
                                        <div className="text-xs text-gray-400 mb-1 truncate">
                                            {match.country && <span>{match.country} • </span>}
                                            {match.league_name}
                                        </div>
                                    )}
                                    <div className="font-medium text-sm">
                                        {match.home_name} vs {match.away_name}
                                    </div>
                                    {match.potentials.btts && (
                                        <div className="flex gap-2 mt-2 text-xs">
                                            <span className="text-green-400">BTTS: %{match.potentials.btts}</span>
                                            <span className="text-blue-400">O2.5: %{match.potentials.over25}</span>
                                        </div>
                                    )}
                                    {match.xg?.home && (
                                        <div className="flex gap-2 mt-1 text-xs text-cyan-400">
                                            xG: {match.xg.home.toFixed(1)} - {match.xg.away?.toFixed(1)}
                                        </div>
                                    )}
                                    {match.score && (
                                        <div className="text-yellow-400 text-sm mt-1">{match.score}</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* FootyStats Detail Panel */}
            {selectedFsMatch && !matchData && (
                <div className="bg-gray-800 rounded-xl p-6 mb-6">
                    {/* Match Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">⚽</span>
                            <div>
                                <div className="text-xl font-bold">{selectedFsMatch.home_name}</div>
                                <div className="text-sm text-gray-400">Ev Sahibi</div>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">VS</div>
                            {selectedFsMatch.score && (
                                <div className="text-lg font-bold text-yellow-400">{selectedFsMatch.score}</div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xl font-bold">{selectedFsMatch.away_name}</div>
                                <div className="text-sm text-gray-400">Deplasman</div>
                            </div>
                            <span className="text-3xl">⚽</span>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        {[
                            { id: 'potentials', label: 'Potansiyeller', icon: Target },
                            { id: 'form', label: 'Form', icon: TrendUp },
                            { id: 'h2h', label: 'H2H', icon: Users },
                            { id: 'trends', label: 'Trendler', icon: Lightning },
                            { id: 'odds', label: 'Oranlar', icon: ChartBar },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFsDetailTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                                    fsDetailTab === tab.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[300px]">
                        {/* Potentials Tab */}
                        {fsDetailTab === 'potentials' && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-sm text-gray-400 mb-2">BTTS</div>
                                    <div className="text-3xl font-bold text-green-400">
                                        {selectedFsMatch.potentials.btts ? `%${selectedFsMatch.potentials.btts}` : '-'}
                                    </div>
                                    {selectedFsMatch.potentials.btts && (
                                        <ProgressBar value={selectedFsMatch.potentials.btts} color="green" />
                                    )}
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-sm text-gray-400 mb-2">2.5 Üst</div>
                                    <div className="text-3xl font-bold text-blue-400">
                                        {selectedFsMatch.potentials.over25 ? `%${selectedFsMatch.potentials.over25}` : '-'}
                                    </div>
                                    {selectedFsMatch.potentials.over25 && (
                                        <ProgressBar value={selectedFsMatch.potentials.over25} color="blue" />
                                    )}
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-sm text-gray-400 mb-2">1.5 Üst</div>
                                    <div className="text-3xl font-bold text-purple-400">
                                        {selectedFsMatch.potentials.over15 ? `%${selectedFsMatch.potentials.over15}` : '-'}
                                    </div>
                                    {selectedFsMatch.potentials.over15 && (
                                        <ProgressBar value={selectedFsMatch.potentials.over15} color="purple" />
                                    )}
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-sm text-gray-400 mb-2">Korner</div>
                                    <div className="text-3xl font-bold text-yellow-400">
                                        {selectedFsMatch.potentials.corners?.toFixed(1) || '-'}
                                    </div>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-sm text-gray-400 mb-2">Kart</div>
                                    <div className="text-3xl font-bold text-red-400">
                                        {selectedFsMatch.potentials.cards?.toFixed(1) || '-'}
                                    </div>
                                </div>

                                {/* xG Section */}
                                {(selectedFsMatch.xg.home || selectedFsMatch.xg.away) && (
                                    <div className="col-span-full bg-gray-700/50 rounded-lg p-4 mt-4">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <ChartBar className="w-5 h-5 text-cyan-400" />
                                            xG (Beklenen Gol)
                                        </h3>
                                        <div className="flex items-center justify-between">
                                            <div className="text-center flex-1">
                                                <div className="text-sm text-gray-400">{selectedFsMatch.home_name}</div>
                                                <div className="text-3xl font-bold text-cyan-400">
                                                    {selectedFsMatch.xg.home?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                            {selectedFsMatch.xg.total && (
                                                <div className="w-48 mx-4">
                                                    <div className="flex h-8 rounded-lg overflow-hidden">
                                                        <div
                                                            className="bg-cyan-500 flex items-center justify-center"
                                                            style={{ width: `${((selectedFsMatch.xg.home || 0) / selectedFsMatch.xg.total) * 100}%` }}
                                                        >
                                                            <span className="text-xs font-bold">
                                                                {(((selectedFsMatch.xg.home || 0) / selectedFsMatch.xg.total) * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="bg-orange-500 flex items-center justify-center"
                                                            style={{ width: `${((selectedFsMatch.xg.away || 0) / selectedFsMatch.xg.total) * 100}%` }}
                                                        >
                                                            <span className="text-xs font-bold">
                                                                {(((selectedFsMatch.xg.away || 0) / selectedFsMatch.xg.total) * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-center text-sm text-gray-400 mt-1">
                                                        Toplam: {selectedFsMatch.xg.total.toFixed(2)}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-center flex-1">
                                                <div className="text-sm text-gray-400">{selectedFsMatch.away_name}</div>
                                                <div className="text-3xl font-bold text-orange-400">
                                                    {selectedFsMatch.xg.away?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Form Tab */}
                        {fsDetailTab === 'form' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-700/50 rounded-lg p-4">
                                    <h3 className="font-semibold mb-4 text-cyan-400">{selectedFsMatch.home_name}</h3>
                                    {selectedFsMatch.form?.home ? (
                                        <>
                                            {selectedFsMatch.form.home.overall && (
                                                <div className="mb-4">
                                                    <div className="text-xs text-gray-400 mb-1">Son 5 Maç</div>
                                                    <FormDisplay form={selectedFsMatch.form.home.overall} label="" />
                                                </div>
                                            )}
                                            {selectedFsMatch.form.home.home_only && (
                                                <div className="mb-4">
                                                    <div className="text-xs text-gray-400 mb-1">Ev Sahibi Form</div>
                                                    <FormDisplay form={selectedFsMatch.form.home.home_only} label="" />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-3 mt-4">
                                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-400 mb-1">PPG</div>
                                                    <div className="text-xl font-bold text-green-400">
                                                        {selectedFsMatch.form.home.ppg?.toFixed(1) || '-'}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-400 mb-1">BTTS %</div>
                                                    <div className="text-xl font-bold text-yellow-400">
                                                        {selectedFsMatch.form.home.btts_pct ? `${selectedFsMatch.form.home.btts_pct}%` : '-'}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-400 mb-1">O2.5 %</div>
                                                    <div className="text-xl font-bold text-blue-400">
                                                        {selectedFsMatch.form.home.over25_pct ? `${selectedFsMatch.form.home.over25_pct}%` : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <NoDataPlaceholder message="Form verisi mevcut değil" />
                                    )}
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4">
                                    <h3 className="font-semibold mb-4 text-orange-400">{selectedFsMatch.away_name}</h3>
                                    {selectedFsMatch.form?.away ? (
                                        <>
                                            {selectedFsMatch.form.away.overall && (
                                                <div className="mb-4">
                                                    <div className="text-xs text-gray-400 mb-1">Son 5 Maç</div>
                                                    <FormDisplay form={selectedFsMatch.form.away.overall} label="" />
                                                </div>
                                            )}
                                            {selectedFsMatch.form.away.away_only && (
                                                <div className="mb-4">
                                                    <div className="text-xs text-gray-400 mb-1">Deplasman Form</div>
                                                    <FormDisplay form={selectedFsMatch.form.away.away_only} label="" />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-3 mt-4">
                                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-400 mb-1">PPG</div>
                                                    <div className="text-xl font-bold text-green-400">
                                                        {selectedFsMatch.form.away.ppg?.toFixed(1) || '-'}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-400 mb-1">BTTS %</div>
                                                    <div className="text-xl font-bold text-yellow-400">
                                                        {selectedFsMatch.form.away.btts_pct ? `${selectedFsMatch.form.away.btts_pct}%` : '-'}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                                    <div className="text-xs text-gray-400 mb-1">O2.5 %</div>
                                                    <div className="text-xl font-bold text-blue-400">
                                                        {selectedFsMatch.form.away.over25_pct ? `${selectedFsMatch.form.away.over25_pct}%` : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <NoDataPlaceholder message="Form verisi mevcut değil" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* H2H Tab */}
                        {fsDetailTab === 'h2h' && (
                            <div className="bg-gray-700/50 rounded-lg p-6">
                                {selectedFsMatch.h2h ? (
                                    <>
                                        <div className="text-center mb-6">
                                            <div className="text-sm text-gray-400 mb-2">Son {selectedFsMatch.h2h.total_matches} Karşılaşma</div>
                                            <div className="flex justify-center gap-8">
                                                <div>
                                                    <div className="text-3xl font-bold text-cyan-400">{selectedFsMatch.h2h.home_wins}</div>
                                                    <div className="text-xs text-gray-400">{selectedFsMatch.home_name}</div>
                                                </div>
                                                <div>
                                                    <div className="text-3xl font-bold text-gray-400">{selectedFsMatch.h2h.draws}</div>
                                                    <div className="text-xs text-gray-400">Berabere</div>
                                                </div>
                                                <div>
                                                    <div className="text-3xl font-bold text-orange-400">{selectedFsMatch.h2h.away_wins}</div>
                                                    <div className="text-xs text-gray-400">{selectedFsMatch.away_name}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                                <div className="text-sm text-gray-400">H2H BTTS</div>
                                                <div className="text-2xl font-bold text-green-400">
                                                    {selectedFsMatch.h2h.btts_pct ? `%${selectedFsMatch.h2h.btts_pct}` : '-'}
                                                </div>
                                            </div>
                                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                                <div className="text-sm text-gray-400">Ortalama Gol</div>
                                                <div className="text-2xl font-bold text-blue-400">
                                                    {selectedFsMatch.h2h.avg_goals?.toFixed(1) || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <NoDataPlaceholder message="H2H verisi mevcut değil" />
                                )}
                            </div>
                        )}

                        {/* Trends Tab */}
                        {fsDetailTab === 'trends' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-700/50 rounded-lg p-4">
                                    <h3 className="font-semibold mb-4 text-cyan-400">{selectedFsMatch.home_name} Trendleri</h3>
                                    {selectedFsMatch.trends?.home && selectedFsMatch.trends.home.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedFsMatch.trends.home.map((trend, i) => (
                                                <TrendItem key={i} type={trend.sentiment} text={trend.text} />
                                            ))}
                                        </div>
                                    ) : (
                                        <NoDataPlaceholder message="Trend verisi yok" />
                                    )}
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4">
                                    <h3 className="font-semibold mb-4 text-orange-400">{selectedFsMatch.away_name} Trendleri</h3>
                                    {selectedFsMatch.trends?.away && selectedFsMatch.trends.away.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedFsMatch.trends.away.map((trend, i) => (
                                                <TrendItem key={i} type={trend.sentiment} text={trend.text} />
                                            ))}
                                        </div>
                                    ) : (
                                        <NoDataPlaceholder message="Trend verisi yok" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Odds Tab */}
                        {fsDetailTab === 'odds' && (
                            <div className="bg-gray-700/50 rounded-lg p-6">
                                {selectedFsMatch.odds.home || selectedFsMatch.odds.draw || selectedFsMatch.odds.away ? (
                                    <>
                                        <h3 className="text-lg font-semibold mb-4 text-center">1X2 Oranları</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                                <div className="text-sm text-gray-400 mb-2">Ev Sahibi (1)</div>
                                                <div className="text-3xl font-bold text-cyan-400">
                                                    {selectedFsMatch.odds.home?.toFixed(2) || '-'}
                                                </div>
                                                {selectedFsMatch.odds.home && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        %{(100 / selectedFsMatch.odds.home).toFixed(0)} implied
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                                <div className="text-sm text-gray-400 mb-2">Berabere (X)</div>
                                                <div className="text-3xl font-bold text-gray-400">
                                                    {selectedFsMatch.odds.draw?.toFixed(2) || '-'}
                                                </div>
                                                {selectedFsMatch.odds.draw && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        %{(100 / selectedFsMatch.odds.draw).toFixed(0)} implied
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-gray-800 rounded-lg p-4 text-center">
                                                <div className="text-sm text-gray-400 mb-2">Deplasman (2)</div>
                                                <div className="text-3xl font-bold text-orange-400">
                                                    {selectedFsMatch.odds.away?.toFixed(2) || '-'}
                                                </div>
                                                {selectedFsMatch.odds.away && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        %{(100 / selectedFsMatch.odds.away).toFixed(0)} implied
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Value Analysis */}
                                        {selectedFsMatch.potentials.btts && selectedFsMatch.odds.home && (
                                            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                                                <h4 className="text-sm font-semibold mb-3 text-yellow-400">Value Analizi</h4>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">BTTS Potential vs Odds</span>
                                                        <span className={selectedFsMatch.potentials.btts > 50 ? 'text-green-400' : 'text-red-400'}>
                                                            {selectedFsMatch.potentials.btts > 50 ? 'KG VAR Değerli' : 'KG YOK Değerli'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">O2.5 Potential vs Odds</span>
                                                        <span className={selectedFsMatch.potentials.over25 && selectedFsMatch.potentials.over25 > 50 ? 'text-green-400' : 'text-red-400'}>
                                                            {selectedFsMatch.potentials.over25 && selectedFsMatch.potentials.over25 > 50 ? '2.5 Üst Değerli' : '2.5 Alt Değerli'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <NoDataPlaceholder message="Oran verisi mevcut değil" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* FootyStats Loading */}
                    {fsLoading && (
                        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center rounded-xl">
                            <CircleNotch className="w-8 h-8 text-blue-400 animate-spin" />
                        </div>
                    )}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-16">
                    <CircleNotch className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
                    <p className="text-gray-400">Analiz yükleniyor...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 mb-6">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* No Match Selected */}
            {!loading && !matchData && !selectedFsMatch && !error && (
                <div className="text-center py-16 bg-gray-800/50 rounded-xl">
                    <Brain className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">Maç Seçin</h3>
                    <p className="text-gray-500">Analiz için yukarıdan bir maç seçin</p>
                </div>
            )}

            {/* Match Analysis */}
            {!loading && matchData && (
                <>
                    {/* Match Header */}
                    <div className="bg-gray-800 rounded-xl p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {matchData.match.home_logo?.startsWith('http') ? (
                                    <img src={matchData.match.home_logo} alt="" className="w-12 h-12 object-contain" />
                                ) : (
                                    <span className="text-4xl">{matchData.match.home_logo || '⚽'}</span>
                                )}
                                <div>
                                    <div className="text-xl font-bold">{matchData.match.home_team}</div>
                                    <div className="text-sm text-gray-400">Ev Sahibi</div>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-400">VS</div>
                                <div className="text-xs text-gray-500">{matchData.match.league}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xl font-bold">{matchData.match.away_team}</div>
                                    <div className="text-sm text-gray-400">Deplasman</div>
                                </div>
                                {matchData.match.away_logo?.startsWith('http') ? (
                                    <img src={matchData.match.away_logo} alt="" className="w-12 h-12 object-contain" />
                                ) : (
                                    <span className="text-4xl">{matchData.match.away_logo || '⚽'}</span>
                                )}
                            </div>
                        </div>

                        {/* Data Source Indicators */}
                        <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-gray-700">
                            <span className={`text-xs px-2 py-1 rounded ${matchData.data_source.has_footystats_match ? 'bg-green-600/30 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                                FootyStats Maç {matchData.data_source.has_footystats_match ? '✓' : '✗'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${matchData.data_source.has_home_team_data ? 'bg-green-600/30 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                                Ev Sahibi Verisi {matchData.data_source.has_home_team_data ? '✓' : '✗'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${matchData.data_source.has_away_team_data ? 'bg-green-600/30 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                                Deplasman Verisi {matchData.data_source.has_away_team_data ? '✓' : '✗'}
                            </span>
                        </div>
                    </div>

                    {!hasData ? (
                        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-8 text-center">
                            <Warning className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                            <h3 className="text-xl font-semibold text-yellow-400 mb-2">FootyStats Verisi Bulunamadı</h3>
                            <p className="text-gray-400 mb-4">
                                Bu maç için FootyStats verileri mevcut değil. Bunun nedenleri:
                            </p>
                            <ul className="text-sm text-gray-500 space-y-1">
                                <li>• Lig FootyStats aboneliğinizde olmayabilir</li>
                                <li>• Takım eşleştirmesi yapılmamış olabilir</li>
                                <li>• Maç henüz FootyStats sisteminde olmayabilir</li>
                            </ul>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: FootyStats Data */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Potentials Grid */}
                                <div className="bg-gray-800 rounded-xl p-6">
                                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-blue-400" />
                                        Maç Potansiyelleri (FootyStats)
                                    </h2>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="bg-gray-700/50 rounded-lg p-4">
                                            <div className="text-sm text-gray-400 mb-2">BTTS (KG Var)</div>
                                            {matchData.potentials.btts_potential ? (
                                                <>
                                                    <div className="text-2xl font-bold text-green-400">%{matchData.potentials.btts_potential}</div>
                                                    <ProgressBar value={matchData.potentials.btts_potential} color="green" />
                                                </>
                                            ) : (
                                                <div className="text-gray-500">-</div>
                                            )}
                                        </div>
                                        <div className="bg-gray-700/50 rounded-lg p-4">
                                            <div className="text-sm text-gray-400 mb-2">2.5 Üst</div>
                                            {matchData.potentials.over25_potential ? (
                                                <>
                                                    <div className="text-2xl font-bold text-blue-400">%{matchData.potentials.over25_potential}</div>
                                                    <ProgressBar value={matchData.potentials.over25_potential} color="blue" />
                                                </>
                                            ) : (
                                                <div className="text-gray-500">-</div>
                                            )}
                                        </div>
                                        <div className="bg-gray-700/50 rounded-lg p-4">
                                            <div className="text-sm text-gray-400 mb-2">1.5 Üst</div>
                                            {matchData.potentials.over15_potential ? (
                                                <>
                                                    <div className="text-2xl font-bold text-purple-400">%{matchData.potentials.over15_potential}</div>
                                                    <ProgressBar value={matchData.potentials.over15_potential} color="purple" />
                                                </>
                                            ) : (
                                                <div className="text-gray-500">-</div>
                                            )}
                                        </div>
                                        <div className="bg-gray-700/50 rounded-lg p-4">
                                            <div className="text-sm text-gray-400 mb-2">Korner Tahmini</div>
                                            <div className="text-2xl font-bold text-yellow-400">
                                                {matchData.potentials.corners_potential || '-'}
                                            </div>
                                        </div>
                                        <div className="bg-gray-700/50 rounded-lg p-4">
                                            <div className="text-sm text-gray-400 mb-2">Kart Tahmini</div>
                                            <div className="text-2xl font-bold text-red-400">
                                                {matchData.potentials.cards_potential || '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* xG Comparison */}
                                {(matchData.xg.home_xg_prematch || matchData.xg.away_xg_prematch) && (
                                    <div className="bg-gray-800 rounded-xl p-6">
                                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <ChartBar className="w-5 h-5 text-cyan-400" />
                                            xG (Beklenen Gol) Karşılaştırması
                                        </h2>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 text-right">
                                                <div className="text-sm text-gray-400">{matchData.match.home_team}</div>
                                                <div className="text-3xl font-bold text-cyan-400">
                                                    {matchData.xg.home_xg_prematch?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                            {matchData.xg.total_xg && (
                                                <div className="w-48">
                                                    <div className="flex h-8 rounded-lg overflow-hidden">
                                                        <div
                                                            className="bg-cyan-500 flex items-center justify-end pr-2"
                                                            style={{ width: `${((matchData.xg.home_xg_prematch || 0) / matchData.xg.total_xg) * 100}%` }}
                                                        >
                                                            <span className="text-xs font-bold">
                                                                {(((matchData.xg.home_xg_prematch || 0) / matchData.xg.total_xg) * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="bg-orange-500 flex items-center pl-2"
                                                            style={{ width: `${((matchData.xg.away_xg_prematch || 0) / matchData.xg.total_xg) * 100}%` }}
                                                        >
                                                            <span className="text-xs font-bold">
                                                                {(((matchData.xg.away_xg_prematch || 0) / matchData.xg.total_xg) * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="text-sm text-gray-400">{matchData.match.away_team}</div>
                                                <div className="text-3xl font-bold text-orange-400">
                                                    {matchData.xg.away_xg_prematch?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Form & H2H */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Form */}
                                    <div className="bg-gray-800 rounded-xl p-6">
                                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <TrendUp className="w-5 h-5 text-green-400" />
                                            Form Durumu
                                        </h2>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <FormDisplay form={matchData.form.home_form} label={matchData.match.home_team} />
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-400">PPG</div>
                                                    <div className="text-xl font-bold text-green-400">
                                                        {matchData.form.home_ppg?.toFixed(2) || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="border-t border-gray-700" />
                                            <div className="flex items-center justify-between">
                                                <FormDisplay form={matchData.form.away_form} label={matchData.match.away_team} />
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-400">PPG</div>
                                                    <div className="text-xl font-bold text-orange-400">
                                                        {matchData.form.away_ppg?.toFixed(2) || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* H2H */}
                                    <div className="bg-gray-800 rounded-xl p-6">
                                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <Users className="w-5 h-5 text-purple-400" />
                                            Kafa Kafaya (H2H)
                                        </h2>
                                        {matchData.h2h ? (
                                            <>
                                                <div className="text-center mb-4">
                                                    <div className="text-sm text-gray-400 mb-2">Son {matchData.h2h.total_matches} Maç</div>
                                                    <div className="flex justify-center gap-8">
                                                        <div>
                                                            <div className="text-2xl font-bold text-cyan-400">{matchData.h2h.home_wins}</div>
                                                            <div className="text-xs text-gray-400">Ev</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-2xl font-bold text-gray-400">{matchData.h2h.draws}</div>
                                                            <div className="text-xs text-gray-400">Berabere</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-2xl font-bold text-orange-400">{matchData.h2h.away_wins}</div>
                                                            <div className="text-xs text-gray-400">Dep</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                                                    <div className="bg-gray-700/50 rounded p-2">
                                                        <div className="text-gray-400">KG Var</div>
                                                        <div className="font-bold text-green-400">
                                                            {matchData.h2h.btts_percentage ? `%${matchData.h2h.btts_percentage}` : '-'}
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-700/50 rounded p-2">
                                                        <div className="text-gray-400">Ort. Gol</div>
                                                        <div className="font-bold text-blue-400">
                                                            {matchData.h2h.avg_goals || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <NoDataPlaceholder message="H2H verisi yok" />
                                        )}
                                    </div>
                                </div>

                                {/* Odds */}
                                {matchData.odds && (matchData.odds.home_win || matchData.odds.draw || matchData.odds.away_win) && (
                                    <div className="bg-gray-800 rounded-xl p-6">
                                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <Lightning className="w-5 h-5 text-yellow-400" />
                                            Oranlar
                                        </h2>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div className="bg-gray-700/50 rounded-lg p-4">
                                                <div className="text-sm text-gray-400 mb-2">Ev Sahibi</div>
                                                <div className="text-2xl font-bold text-cyan-400">
                                                    {matchData.odds.home_win?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                            <div className="bg-gray-700/50 rounded-lg p-4">
                                                <div className="text-sm text-gray-400 mb-2">Berabere</div>
                                                <div className="text-2xl font-bold text-gray-400">
                                                    {matchData.odds.draw?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                            <div className="bg-gray-700/50 rounded-lg p-4">
                                                <div className="text-sm text-gray-400 mb-2">Deplasman</div>
                                                <div className="text-2xl font-bold text-orange-400">
                                                    {matchData.odds.away_win?.toFixed(2) || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Trends */}
                                {(matchData.trends.home.length > 0 || matchData.trends.away.length > 0) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gray-800 rounded-xl p-6">
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                {matchData.match.home_team} Trendleri
                                            </h3>
                                            {matchData.trends.home.length > 0 ? (
                                                matchData.trends.home.map((trend, i) => (
                                                    <TrendItem key={i} type={trend.type || 'neutral'} text={trend.text || String(trend)} />
                                                ))
                                            ) : (
                                                <p className="text-gray-500 text-sm">Trend verisi yok</p>
                                            )}
                                        </div>
                                        <div className="bg-gray-800 rounded-xl p-6">
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                {matchData.match.away_team} Trendleri
                                            </h3>
                                            {matchData.trends.away.length > 0 ? (
                                                matchData.trends.away.map((trend, i) => (
                                                    <TrendItem key={i} type={trend.type || 'neutral'} text={trend.text || String(trend)} />
                                                ))
                                            ) : (
                                                <p className="text-gray-500 text-sm">Trend verisi yok</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: AI Analysis Placeholder */}
                            <div className="space-y-6">
                                <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/30">
                                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Sparkle className="w-5 h-5 text-yellow-400" />
                                        AI Tahmini
                                    </h2>
                                    <div className="text-center py-8">
                                        <Brain className="w-16 h-16 mx-auto mb-4 text-purple-400 opacity-50" />
                                        <p className="text-gray-400 text-sm">
                                            AI analiz modülü yakında aktif olacak
                                        </p>
                                    </div>
                                </div>

                                {/* Data Quality Info */}
                                <div className="bg-gray-800 rounded-xl p-6">
                                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Flag className="w-5 h-5 text-blue-400" />
                                        Veri Kalitesi
                                    </h2>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">FootyStats Maç Verisi</span>
                                            <span className={matchData.data_source.has_footystats_match ? 'text-green-400' : 'text-red-400'}>
                                                {matchData.data_source.has_footystats_match ? 'Mevcut' : 'Yok'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Ev Sahibi Form Verisi</span>
                                            <span className={matchData.data_source.has_home_team_data ? 'text-green-400' : 'text-red-400'}>
                                                {matchData.data_source.has_home_team_data ? 'Mevcut' : 'Yok'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Deplasman Form Verisi</span>
                                            <span className={matchData.data_source.has_away_team_data ? 'text-green-400' : 'text-red-400'}>
                                                {matchData.data_source.has_away_team_data ? 'Mevcut' : 'Yok'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Footer Note */}
            <div className="mt-8 text-center text-sm text-gray-500">
                <p>FootyStats API entegrasyonu ile çalışmaktadır.</p>
                <p>Aboneliğinize dahil ligler: England Premier League, France Ligue 1, Belgium Pro League, Australia A-League</p>
            </div>
        </div>
    );
}
