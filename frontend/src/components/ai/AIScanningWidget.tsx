import { Cpu, WifiHigh, Lightning, Globe } from '@phosphor-icons/react';
import { useBotStats } from '../../hooks/useBotStats';
import { useEffect, useState } from 'react';

// Premium looking log entries
const LOG_ENTRIES = [
    { type: 'success', text: 'Connection established: eu-central-1' },
    { type: 'info', text: 'Syncing live odds feed...' },
    { type: 'process', text: 'Analyzing pattern: Over 2.5 Goals' },
    { type: 'success', text: 'Neural node handshake active' },
    { type: 'info', text: 'Verifying squad depth: Premier League' },
    { type: 'process', text: 'Calculating xG models...' },
    { type: 'success', text: 'Latency optimized: 12ms' },
    { type: 'info', text: 'Fetching h2h historical data' }
];

export function AIScanningWidget() {
    const { stats } = useBotStats();
    const [logs, setLogs] = useState<Array<typeof LOG_ENTRIES[0] & { id: number }>>([]);
    const [activeNode, setActiveNode] = useState(0);

    // Simulate scrolling terminal logs
    useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
            setLogs(prev => {
                const newLog = LOG_ENTRIES[index % LOG_ENTRIES.length];
                const newLogs = [...prev, { ...newLog, id: Date.now() }].slice(-3); // Keep last 3
                index++;
                return newLogs;
            });
            setActiveNode(Math.floor(Math.random() * 3));
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full mb-8 group">
            {/* Glow Effect behind the card */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-75 transition duration-1000"></div>

            {/* Main Card Container */}
            <div className="relative bg-[#09090b] border border-white/5 rounded-[1.75rem] overflow-hidden shadow-2xl backdrop-blur-3xl">

                {/* Background Grid Pattern */}
                <div className="absolute inset-0 z-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}>
                </div>

                {/* Top Status Bar */}
                <div className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="flex space-x-1">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                        </div>
                        <span className="text-[11px] font-bold tracking-[0.2em] text-green-400 uppercase">
                            Yapay Zeka Aktif
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-medium text-gray-500 font-mono">
                        <span className="flex items-center gap-1.5">
                            <WifiHigh size={14} className="text-green-500/50" />
                            PING: {Math.floor(Math.random() * 15 + 10)}ms
                        </span>
                        <span className="flex items-center gap-1.5 text-green-500/50">
                            <Globe size={14} />
                            REGION: EU-WEST
                        </span>
                    </div>
                </div>

                {/* Content Body */}
                <div className="relative z-10 p-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">

                    {/* Left: The Neural Core Animation */}
                    <div className="flex items-center justify-center">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            {/* Rotating Rings */}
                            <div className="absolute inset-0 border-2 border-green-500/10 rounded-full animate-[spin_10s_linear_infinite]" />
                            <div className="absolute inset-2 border border-green-500/20 rounded-full border-t-transparent animate-[spin_3s_linear_infinite]" />
                            <div className="absolute inset-4 border border-emerald-500/30 rounded-full border-b-transparent animate-[spin_5s_linear_infinite_reverse]" />

                            {/* Center Core */}
                            <div className="relative z-10 bg-gradient-to-br from-green-500/10 to-transparent p-4 rounded-xl border border-green-500/20 shadow-[0_0_30px_-5px_rgba(34,197,94,0.2)] backdrop-blur-md">
                                <Cpu size={32} weight="duotone" className="text-green-400 animate-pulse" />
                            </div>

                            {/* Connecting Lines */}
                            <div className={`absolute -right-4 top-1/2 w-8 h-[1px] bg-gradient-to-r from-green-500/50 to-transparent transition-opacity duration-300 ${activeNode === 0 ? 'opacity-100' : 'opacity-0'}`} />
                        </div>
                    </div>

                    {/* Right: Metrics & Info */}
                    <div className="flex flex-col gap-5">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                GoalGPT <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Core Engine</span>
                            </h2>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                Sistem şu anda <span className="text-white font-bold">{stats?.global.total_predictions || 324}</span> farklı veri noktasını analiz ediyor.
                                Tahmin modelleri 7/24 aktif olarak çalışmaktadır.
                            </p>
                        </div>

                        {/* Metric Cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-[#111] p-3 rounded-lg border border-white/5 hover:border-green-500/20 transition-colors group/metric">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">Analiz</div>
                                <div className="text-white font-mono text-sm group-hover/metric:text-green-400 transition-colors">
                                    {(stats?.global.total_predictions || 0) * 12 + 842}k
                                </div>
                            </div>
                            <div className="bg-[#111] p-3 rounded-lg border border-white/5 hover:border-green-500/20 transition-colors group/metric">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">Uptime</div>
                                <div className="text-white font-mono text-sm group-hover/metric:text-green-400 transition-colors">99.9%</div>
                            </div>
                            <div className="bg-[#111] p-3 rounded-lg border border-white/5 hover:border-green-500/20 transition-colors group/metric">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">İşlem Hızı</div>
                                <div className="text-white font-mono text-sm group-hover/metric:text-green-400 transition-colors">
                                    ~0.04s
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom: Terminal Logs */}
                <div className="relative z-10 bg-[#050505] border-t border-white/5 px-6 py-2.5 min-h-[48px] flex items-center overflow-hidden">
                    <div className="flex items-center gap-3 w-full">
                        <Lightning size={14} weight="fill" className="text-yellow-500/70 animate-pulse shrink-0" />
                        <div className="flex flex-col w-full h-5 overflow-hidden relative">
                            {logs.map((log) => (
                                <span key={log.id} className="text-[10px] font-mono text-gray-400/80 animate-[slideUp_0.3s_ease-out] whitespace-nowrap">
                                    <span className="text-green-500/50 mr-2">➜</span>
                                    {log.text}
                                </span>
                            ))}
                        </div>
                    </div>
                    {/* Gradient Fade for Logs */}
                    <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-[#050505] to-transparent pointer-events-none" />
                </div>

                {/* Progress Line */}
                <div className="h-0.5 w-full bg-[#111] relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 animate-[scanner_3s_ease-in-out_infinite]" />
                </div>
            </div>

            <style>{`
                @keyframes scanner {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
