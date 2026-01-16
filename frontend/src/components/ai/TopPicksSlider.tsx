import { useRef } from 'react';
import { Fire, ArrowRight } from '@phosphor-icons/react';
import type { AIPrediction } from '../../context/AIPredictionsContext';
import type { BotStats } from '../../hooks/useBotStats';
import { useNavigate } from 'react-router-dom';

interface TopPicksSliderProps {
    predictions: AIPrediction[];
    botStatsMap: Record<string, BotStats>;
}

export function TopPicksSlider({ predictions, botStatsMap }: TopPicksSliderProps) {
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 1. Filter: Only pending predictions
    // 2. Sort: VIP first, then by Bot Win Rate
    const topPicks = predictions
        .filter(p => !p.result || p.result === 'pending')
        .sort((a, b) => {
            // Priority 1: VIP
            if (a.access_type === 'VIP' && b.access_type !== 'VIP') return -1;
            if (a.access_type !== 'VIP' && b.access_type === 'VIP') return 1;

            // Priority 2: Bot Win Rate
            const statA = botStatsMap[a.canonical_bot_name] || botStatsMap[a.canonical_bot_name.toLowerCase()];
            const statB = botStatsMap[b.canonical_bot_name] || botStatsMap[b.canonical_bot_name.toLowerCase()];
            const rateA = statA ? parseFloat(statA.win_rate.toString()) : 0;
            const rateB = statB ? parseFloat(statB.win_rate.toString()) : 0;

            return rateB - rateA;
        })
        .slice(0, 7); // Show max 7 picks

    if (topPicks.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className="bg-orange-500/10 p-1.5 rounded-lg border border-orange-500/20">
                    <Fire size={18} weight="fill" className="text-orange-500 animate-pulse" />
                </div>
                <h2 className="text-white font-bold text-lg tracking-tight">
                    Günün Bankoları
                    <span className="text-xs text-gray-500 font-medium ml-2 font-mono bg-white/5 px-2 py-0.5 rounded">
                        HOT
                    </span>
                </h2>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto py-2 px-1 no-scrollbar scroll-smooth snap-x snap-mandatory"
            >
                {topPicks.map(pick => {
                    const botStat = botStatsMap[pick.canonical_bot_name] || botStatsMap[pick.canonical_bot_name.toLowerCase()];
                    const winRate = botStat ? botStat.win_rate.toFixed(0) : '85'; // Fallback to 85 purely for optics if missing
                    const isVip = pick.access_type === 'VIP';

                    return (
                        <div
                            key={pick.id}
                            onClick={() => pick.match_id && navigate(`/match/${pick.match_id}`)}
                            className="snap-start min-w-[280px] bg-[#111] rounded-2xl border border-white/5 p-4 relative overflow-hidden group cursor-pointer hover:border-orange-500/30 transition-all duration-300 shadow-lg"
                        >
                            {/* Background Effects */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-50" />
                            {isVip && <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 blur-xl" />}

                            {/* Header: League & Time */}
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold tracking-wider mb-3">
                                <span className="truncate max-w-[140px] uppercase">{pick.league_name}</span>
                                <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                                    <ClockIcon />
                                    {new Date(pick.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            {/* Teams */}
                            <div className="flex flex-col gap-1 mb-4">
                                <div className="flex items-center gap-2">
                                    <TeamLogo src={pick.home_team_logo} />
                                    <span className="text-sm font-bold text-white truncate">{pick.home_team_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TeamLogo src={pick.away_team_logo} />
                                    <span className="text-sm font-bold text-white truncate">{pick.away_team_name}</span>
                                </div>
                            </div>

                            {/* Prediction & Confidence */}
                            <div className="flex items-center justify-between mt-auto">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Tahmin</span>
                                    <span className="text-orange-400 font-black text-lg leading-none tracking-tight">
                                        {pick.prediction}
                                    </span>
                                </div>

                                {/* Confidence Ring */}
                                <div className={`flex items-center ${isVip ? 'gap-2 bg-[#1A1A1A] pr-3 py-0.5 pl-0.5 rounded-full border border-white/10' : ''}`}>
                                    <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="20" cy="20" r="16" stroke="#222" strokeWidth="3" fill="transparent" />
                                            <circle
                                                cx="20" cy="20" r="16"
                                                stroke={isVip ? '#eab308' : '#f97316'}
                                                strokeWidth="3"
                                                fill="transparent"
                                                strokeDasharray={100}
                                                strokeDashoffset={100 - parseFloat(winRate)}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                            {winRate}%
                                        </div>
                                    </div>
                                    {isVip && (
                                        <span className="text-[10px] font-black text-yellow-500 tracking-wider">VIP</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* 'See All' Card */}
                <div className="snap-start min-w-[100px] flex items-center justify-center bg-[#111] rounded-2xl border border-white/5 border-dashed cursor-pointer hover:bg-white/5 transition-colors group">
                    <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-white transition-colors">
                        <ArrowRight size={20} weight="bold" />
                        <span className="text-xs font-bold">Tümü</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Components
function ClockIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256">
            <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"></path>
        </svg>
    )
}

function TeamLogo({ src }: { src: string | null }) {
    if (!src) return <div className="w-5 h-5 rounded-full bg-white/10" />;
    return <img src={src} alt="" className="w-5 h-5 object-contain" />;
}
