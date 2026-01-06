import { X, Robot, ArrowRight } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import type { BotStats } from '../../hooks/useBotStats';

interface BotInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    botName: string;
    description: string;
    stats?: BotStats | null;
}

export function BotInfoModal({ isOpen, onClose, botName, description: _description, stats }: BotInfoModalProps) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleNavigate = () => {
        navigate(`/admin/bots/${encodeURIComponent(botName)}`);
    };

    const winRate = stats ? stats.win_rate : 0;
    const wins = stats ? stats.wins : 0;
    const losses = stats ? stats.losses : 0;
    const total = stats ? stats.total_predictions : 0;

    // Get bot icon color based on name
    const getBotIconColor = () => {
        const n = botName.toLowerCase();
        if (n.includes('alert')) return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (n.includes('code')) return 'text-green-500 bg-green-500/10 border-green-500/20';
        if (n.includes('algoritma')) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        return 'text-green-500 bg-green-500/10 border-green-500/20';
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300"
            onClick={handleBackdropClick}
        >
            <div className="bg-[#111] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors z-20"
                >
                    <X size={16} weight="bold" />
                </button>

                {/* Header: Icon + Name + Priority */}
                <div className="p-5 pb-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${getBotIconColor()}`}>
                        <Robot size={24} weight="fill" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">{botName}</h2>
                        <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-gray-400">
                            PRIORITY: 100
                        </span>
                    </div>
                </div>

                {/* Separator */}
                <div className="h-px bg-white/5 mx-5" />

                {/* Stats Section */}
                <div className="p-5">
                    {/* Win Rate with Progress Bar */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-400">Başarı Oranı</span>
                            <span className={`text-xl font-black ${winRate >= 70 ? 'text-green-500' : winRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                %{winRate.toFixed(1)}
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${winRate >= 70 ? 'bg-green-500' : winRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.max(5, winRate)}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats Grid: WINS / LOSS / TOTAL */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-green-500/20 transition-colors">
                            <div className="text-xl font-black text-white">{wins}</div>
                            <div className="text-[10px] text-green-500 font-bold uppercase tracking-wider">WINS</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-red-500/20 transition-colors">
                            <div className="text-xl font-black text-white">{losses}</div>
                            <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">LOSS</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-white/20 transition-colors">
                            <div className="text-xl font-black text-white">{total}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">TOTAL</div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleNavigate}
                        className="w-full bg-green-500 hover:bg-green-600 text-black font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/20"
                    >
                        <span className="text-sm">Bot Detay Sayfasına Git</span>
                        <ArrowRight size={18} weight="bold" />
                    </button>
                </div>
            </div>
        </div>
    );
}
