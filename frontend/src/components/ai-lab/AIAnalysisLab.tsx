import { useState } from 'react';
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
    Sparkle
} from '@phosphor-icons/react';

// Mock FootyStats Data (will be replaced with real API data)
const MOCK_FOOTYSTATS_DATA = {
    match: {
        id: 'demo-match-1',
        home_team: 'Fenerbahçe',
        away_team: 'Galatasaray',
        home_logo: '🟡',
        away_logo: '🔴',
        date: '2024-01-20T19:00:00',
        league: 'Süper Lig',
        stadium: 'Ülker Stadyumu'
    },
    potentials: {
        btts_potential: 78,
        over25_potential: 72,
        over15_potential: 92,
        corners_potential: 11.5,
        cards_potential: 4.8,
    },
    xg: {
        home_xg_prematch: 1.85,
        away_xg_prematch: 1.42,
        total_xg: 3.27
    },
    form: {
        home_form: 'WDWWW',
        away_form: 'LWDWL',
        home_ppg: 2.4,
        away_ppg: 1.6
    },
    h2h: {
        total_matches: 10,
        home_wins: 4,
        draws: 3,
        away_wins: 3,
        btts_percentage: 70,
        avg_goals: 2.8
    },
    referee: {
        name: 'Atilla Karaoğlan',
        cards_per_match: 4.2,
        penalties_per_match: 0.35,
        btts_percentage: 65
    },
    trends: {
        home: [
            { type: 'positive', text: 'Son 8 ev maçını kaybetmedi' },
            { type: 'positive', text: 'Evinde maç başına 2.1 gol atıyor' },
            { type: 'warning', text: 'Son 3 maçta sarı kart ortalaması 2.3' }
        ],
        away: [
            { type: 'negative', text: 'Deplasmanda son 4 maçın 3\'ünü kaybetti' },
            { type: 'positive', text: 'Her deplasman maçında gol attı (son 6)' },
            { type: 'warning', text: 'Defans sorunlu: Maç başı 1.8 gol yiyor' }
        ]
    }
};

// AI Analysis Response (Mock)
const MOCK_AI_ANALYSIS = {
    verdict: 'EV SAHİBİ KAZANIR & 2.5 ÜST',
    confidence: 82,
    reasoning: `Fenerbahçe'nin ev performansı dikkat çekici. Son 8 maçı kaybetmedi ve xG ortalaması (1.85) lig ortalamasının üzerinde. 
  
Galatasaray'ın deplasman performansı zayıf: son 4 maçın 3'ünü kaybetti ve maç başı 1.8 gol yiyor.

İki takımın da gol atma eğilimi yüksek (H2H BTTS %70), bu da maçın gollü geçeceğini işaret ediyor.`,
    value_bets: [
        { market: 'Ev Sahibi Kazanır', odds: 1.75, value: 'Yüksek' },
        { market: '2.5 Üst', odds: 1.85, value: 'Orta' },
        { market: 'KG Var & Ev Sahibi', odds: 2.40, value: 'Altın' }
    ],
    warnings: [
        'Hakem kart gösterme eğilimli (4.2/maç)',
        'Derby atmosferi beklenmedik sonuçlara yol açabilir'
    ]
};

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

// Confidence Meter Component
function ConfidenceMeter({ value }: { value: number }) {
    const getColor = () => {
        if (value >= 80) return 'text-green-400';
        if (value >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getLabel = () => {
        if (value >= 80) return 'YÜKSEK GÜVEN';
        if (value >= 60) return 'ORTA GÜVEN';
        return 'DÜŞÜK GÜVEN';
    };

    return (
        <div className="text-center">
            <div className={`text-6xl font-bold ${getColor()}`}>%{value}</div>
            <div className={`text-sm font-semibold ${getColor()}`}>{getLabel()}</div>
        </div>
    );
}

// Form Display Component
function FormDisplay({ form, label }: { form: string; label: string }) {
    const getFormColor = (char: string) => {
        switch (char) {
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
                {form.split('').map((char, i) => (
                    <span
                        key={i}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white ${getFormColor(char)}`}
                    >
                        {char}
                    </span>
                ))}
            </div>
        </div>
    );
}

// Trend Item Component
function TrendItem({ type, text }: { type: string; text: string }) {
    const getIcon = () => {
        switch (type) {
            case 'positive': return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'negative': return <XCircle className="w-4 h-4 text-red-400" />;
            case 'warning': return <Warning className="w-4 h-4 text-yellow-400" />;
            default: return <CaretRight className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="flex items-start gap-2 py-2">
            {getIcon()}
            <span className="text-sm text-gray-300">{text}</span>
        </div>
    );
}

// Main Component
export function AIAnalysisLab() {
    const [selectedMatch] = useState(MOCK_FOOTYSTATS_DATA);
    const [aiAnalysis] = useState(MOCK_AI_ANALYSIS);

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

            {/* Match Header */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">{selectedMatch.match.home_logo}</span>
                        <div>
                            <div className="text-xl font-bold">{selectedMatch.match.home_team}</div>
                            <div className="text-sm text-gray-400">Ev Sahibi</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">VS</div>
                        <div className="text-xs text-gray-500">{selectedMatch.match.league}</div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-xl font-bold">{selectedMatch.match.away_team}</div>
                            <div className="text-sm text-gray-400">Deplasman</div>
                        </div>
                        <span className="text-4xl">{selectedMatch.match.away_logo}</span>
                    </div>
                </div>
            </div>

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
                                <div className="text-2xl font-bold text-green-400">%{selectedMatch.potentials.btts_potential}</div>
                                <ProgressBar value={selectedMatch.potentials.btts_potential} color="green" />
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-2">2.5 Üst</div>
                                <div className="text-2xl font-bold text-blue-400">%{selectedMatch.potentials.over25_potential}</div>
                                <ProgressBar value={selectedMatch.potentials.over25_potential} color="blue" />
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-2">1.5 Üst</div>
                                <div className="text-2xl font-bold text-purple-400">%{selectedMatch.potentials.over15_potential}</div>
                                <ProgressBar value={selectedMatch.potentials.over15_potential} color="purple" />
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-2">Korner Tahmini</div>
                                <div className="text-2xl font-bold text-yellow-400">{selectedMatch.potentials.corners_potential}</div>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-2">Kart Tahmini</div>
                                <div className="text-2xl font-bold text-red-400">{selectedMatch.potentials.cards_potential}</div>
                            </div>
                        </div>
                    </div>

                    {/* xG Comparison */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <ChartBar className="w-5 h-5 text-cyan-400" />
                            xG (Beklenen Gol) Karşılaştırması
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 text-right">
                                <div className="text-sm text-gray-400">{selectedMatch.match.home_team}</div>
                                <div className="text-3xl font-bold text-cyan-400">{selectedMatch.xg.home_xg_prematch}</div>
                            </div>
                            <div className="w-48">
                                <div className="flex h-8 rounded-lg overflow-hidden">
                                    <div
                                        className="bg-cyan-500 flex items-center justify-end pr-2"
                                        style={{ width: `${(selectedMatch.xg.home_xg_prematch / selectedMatch.xg.total_xg) * 100}%` }}
                                    >
                                        <span className="text-xs font-bold">{((selectedMatch.xg.home_xg_prematch / selectedMatch.xg.total_xg) * 100).toFixed(0)}%</span>
                                    </div>
                                    <div
                                        className="bg-orange-500 flex items-center pl-2"
                                        style={{ width: `${(selectedMatch.xg.away_xg_prematch / selectedMatch.xg.total_xg) * 100}%` }}
                                    >
                                        <span className="text-xs font-bold">{((selectedMatch.xg.away_xg_prematch / selectedMatch.xg.total_xg) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="text-sm text-gray-400">{selectedMatch.match.away_team}</div>
                                <div className="text-3xl font-bold text-orange-400">{selectedMatch.xg.away_xg_prematch}</div>
                            </div>
                        </div>
                    </div>

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
                                    <FormDisplay form={selectedMatch.form.home_form} label={selectedMatch.match.home_team} />
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">PPG</div>
                                        <div className="text-xl font-bold text-green-400">{selectedMatch.form.home_ppg}</div>
                                    </div>
                                </div>
                                <div className="border-t border-gray-700" />
                                <div className="flex items-center justify-between">
                                    <FormDisplay form={selectedMatch.form.away_form} label={selectedMatch.match.away_team} />
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">PPG</div>
                                        <div className="text-xl font-bold text-orange-400">{selectedMatch.form.away_ppg}</div>
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
                            <div className="text-center mb-4">
                                <div className="text-sm text-gray-400 mb-2">Son {selectedMatch.h2h.total_matches} Maç</div>
                                <div className="flex justify-center gap-8">
                                    <div>
                                        <div className="text-2xl font-bold text-cyan-400">{selectedMatch.h2h.home_wins}</div>
                                        <div className="text-xs text-gray-400">Ev</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-400">{selectedMatch.h2h.draws}</div>
                                        <div className="text-xs text-gray-400">Berabere</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-orange-400">{selectedMatch.h2h.away_wins}</div>
                                        <div className="text-xs text-gray-400">Dep</div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-sm">
                                <div className="bg-gray-700/50 rounded p-2">
                                    <div className="text-gray-400">KG Var</div>
                                    <div className="font-bold text-green-400">%{selectedMatch.h2h.btts_percentage}</div>
                                </div>
                                <div className="bg-gray-700/50 rounded p-2">
                                    <div className="text-gray-400">Ort. Gol</div>
                                    <div className="font-bold text-blue-400">{selectedMatch.h2h.avg_goals}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Referee Analysis */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Flag className="w-5 h-5 text-red-400" />
                            Hakem Analizi
                        </h2>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-2xl mb-2">👨‍⚖️</div>
                                <div className="font-semibold">{selectedMatch.referee.name}</div>
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-4">
                                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                    <div className="text-sm text-gray-400">Kart/Maç</div>
                                    <div className="text-xl font-bold text-yellow-400">{selectedMatch.referee.cards_per_match}</div>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                    <div className="text-sm text-gray-400">Penaltı/Maç</div>
                                    <div className="text-xl font-bold text-red-400">{selectedMatch.referee.penalties_per_match}</div>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                    <div className="text-sm text-gray-400">KG Var %</div>
                                    <div className="text-xl font-bold text-green-400">%{selectedMatch.referee.btts_percentage}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trends */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <span className="text-2xl">{selectedMatch.match.home_logo}</span>
                                {selectedMatch.match.home_team} Trendleri
                            </h3>
                            {selectedMatch.trends.home.map((trend, i) => (
                                <TrendItem key={i} type={trend.type} text={trend.text} />
                            ))}
                        </div>
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <span className="text-2xl">{selectedMatch.match.away_logo}</span>
                                {selectedMatch.match.away_team} Trendleri
                            </h3>
                            {selectedMatch.trends.away.map((trend, i) => (
                                <TrendItem key={i} type={trend.type} text={trend.text} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Output */}
                <div className="space-y-6">
                    {/* AI Verdict Card */}
                    <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/30">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Sparkle className="w-5 h-5 text-yellow-400" />
                            AI Tahmini
                        </h2>

                        <ConfidenceMeter value={aiAnalysis.confidence} />

                        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
                            <div className="text-xl font-bold text-center text-green-400 mb-4">
                                {aiAnalysis.verdict}
                            </div>
                        </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-400" />
                            AI Analizi
                        </h2>
                        <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                            {aiAnalysis.reasoning}
                        </p>
                    </div>

                    {/* Value Bets */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Lightning className="w-5 h-5 text-yellow-400" />
                            Değer Bahisleri
                        </h2>
                        <div className="space-y-3">
                            {aiAnalysis.value_bets.map((bet, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                                    <div>
                                        <div className="font-medium">{bet.market}</div>
                                        <div className={`text-xs ${bet.value === 'Altın' ? 'text-yellow-400' :
                                            bet.value === 'Yüksek' ? 'text-green-400' : 'text-blue-400'
                                            }`}>
                                            {bet.value} Değer
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold text-purple-400">{bet.odds}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Warnings */}
                    <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-yellow-400">
                            <Warning className="w-5 h-5" />
                            Dikkat Edilmesi Gerekenler
                        </h2>
                        <ul className="space-y-2">
                            {aiAnalysis.warnings.map((warning, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-yellow-200">
                                    <span className="mt-1">•</span>
                                    {warning}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Footer Note */}
            <div className="mt-8 text-center text-sm text-gray-500">
                <p>⚠️ Bu sayfa geliştirme aşamasındadır. Veriler şu anda mock (örnek) verilerdir.</p>
                <p>FootyStats API entegrasyonu tamamlandığında gerçek verilerle çalışacaktır.</p>
            </div>
        </div>
    );
}
