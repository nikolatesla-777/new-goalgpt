import { Robot, ChartLineUp } from '@phosphor-icons/react';
import { useBotStats } from '../../hooks/useBotStats';
import { useEffect, useState } from 'react';

export function AIScanningWidget() {
    const { stats, loading } = useBotStats();

    // Animated number state
    const [displayRate, setDisplayRate] = useState(0);

    useEffect(() => {
        if (stats?.global.win_rate) {
            const target = stats.global.win_rate;
            let start = 0;
            const duration = 1500;
            const increment = target / (duration / 16);

            const timer = setInterval(() => {
                start += increment;
                if (start >= target) {
                    setDisplayRate(target);
                    clearInterval(timer);
                } else {
                    setDisplayRate(start);
                }
            }, 16);

            return () => clearInterval(timer);
        }
    }, [stats?.global.win_rate]);

    return (
        <div className="relative bg-[#111] rounded-3xl p-6 overflow-hidden mb-8 border border-white/5 shadow-2xl group">
            {/* Background Grid Effect */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                }}
            />

            {/* Animated Glow in Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/10 rounded-full blur-3xl animate-pulse" />

            <div className="relative z-10 flex flex-col items-center justify-center py-2">

                {/* Dynamic Status Section */}
                <div className="flex items-center justify-between w-full mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center border border-white/10 shadow-lg">
                            <Robot size={24} weight="duotone" className="text-green-500" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#111] animate-bounce" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white leading-tight">
                                AI Analiz Modu
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs text-green-500 font-bold uppercase tracking-wide">
                                    Aktif Taranıyor
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Success Rate Stats */}
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <ChartLineUp size={14} weight="bold" className="text-green-400" />
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Başarı Oranı
                            </span>
                        </div>
                        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                            %{loading ? '...' : displayRate.toFixed(1)}
                        </div>
                    </div>
                </div>

                {/* Info Text */}
                <p className="text-gray-500 text-xs text-center max-w-sm leading-relaxed mb-4">
                    Yapay zeka modellerimiz 7/24 aktif olarak maçları analiz ediyor.
                    <span className="text-gray-300 font-bold"> {stats?.global.total_predictions || 0} maç</span> analiz edildi.
                </p>

                {/* Scanning Bar */}
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}</style>
        </div>
    );
}
