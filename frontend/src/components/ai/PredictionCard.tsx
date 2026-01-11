import { Robot, Trophy, WarningCircle, Clock, Star, Info } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { AIPrediction } from '../../context/AIPredictionsContext';
import { BotInfoModal } from './BotInfoModal';
import { BOT_DESCRIPTIONS, DEFAULT_BOT_DESCRIPTION } from '../../constants/botDescriptions';
import type { BotStats } from '../../hooks/useBotStats';

interface PredictionCardProps {
    prediction: AIPrediction;
    isVip?: boolean;
    isFavorite?: boolean;
    onToggleFavorite?: (e: React.MouseEvent) => void;
    botStats?: BotStats | null;
}

export function PredictionCard({ prediction, isVip = false, isFavorite = false, onToggleFavorite, botStats }: PredictionCardProps) {
    const navigate = useNavigate();
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    // Phase 5: Use new result field
    const isWinner = prediction.result === 'won';
    const isLoser = prediction.result === 'lost';
    const isPending = !prediction.result || prediction.result === 'pending';

    // Bot Info Logic - use canonical_bot_name
    const botName = prediction.canonical_bot_name || 'AI Bot';
    const description = BOT_DESCRIPTIONS[botName] || DEFAULT_BOT_DESCRIPTION;

    // Success Rate Display
    const successRate = botStats ? botStats.win_rate.toFixed(1) : '0.0';

    const handleInfoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsInfoOpen(true);
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleFavorite?.(e);
    };

    // Format match time (DD.MM - HH:mm)
    const matchDate = new Date(prediction.created_at);
    const dateString = matchDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    const timeString = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const dateTimeString = `${dateString} - ${timeString} `;

    // Determine the score to display
    const getDisplayScore = () => {
        // If finished and has final_score, parse it
        if ((isWinner || isLoser) && prediction.final_score) {
            return prediction.final_score;
        }

        // Live scores from ts_matches join
        if (prediction.home_score_display != null && prediction.away_score_display != null) {
            return `${prediction.home_score_display} - ${prediction.away_score_display}`;
        }

        // Fallback to score at prediction time
        if (prediction.score_at_prediction) {
            return prediction.score_at_prediction;
        }

        return '0-0';
    };

    // Get current minute
    const getCurrentMinute = () => {
        // Phase 5: Use live_match_minute and live_match_status
        if (prediction.live_match_minute && (prediction.live_match_status || 0) >= 2 && (prediction.live_match_status || 0) <= 7) {
            return prediction.live_match_minute;
        }
        return prediction.minute_at_prediction;
    };

    // Handle navigation to match detail
    const handleClick = () => {
        // Phase 5: Use match_id instead of match_external_id
        if (prediction.match_id) {
            navigate(`/match/${prediction.match_id}`);
        }
    };

    const displayScore = getDisplayScore();
    const currentMinute = getCurrentMinute();
    // Phase 5: Use live_match_status
    const isLive = (prediction.live_match_status || 0) >= 2 && (prediction.live_match_status || 0) <= 7;
    const isFinished = prediction.live_match_status === 8;

    // Match Status Badge - Professional UI/UX
    const getMatchStatusBadge = () => {
        const status = prediction.live_match_status;

        // LIVE (First Half)
        if (status === 2) {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span className="text-[11px] font-black tracking-wider">LIVE</span>
                </div>
            );
        }

        // HALF TIME
        if (status === 3) {
            return (
                <div className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <span className="text-[11px] font-black tracking-wider">HT</span>
                </div>
            );
        }

        // LIVE (Second Half)
        if (status === 4) {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span className="text-[11px] font-black tracking-wider">LIVE</span>
                </div>
            );
        }

        // OVERTIME (Extra Time)
        if (status === 5) {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500 text-white shadow-lg shadow-purple-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[11px] font-black tracking-wider">ET</span>
                </div>
            );
        }

        // PENALTY
        if (status === 7) {
            return (
                <div className="px-2.5 py-1 rounded-md bg-yellow-500 text-black shadow-lg shadow-yellow-500/30">
                    <span className="text-[11px] font-black tracking-wider">PEN</span>
                </div>
            );
        }

        // FINISHED (Full Time / Maç Sonu)
        if (status === 8) {
            return (
                <div className="px-2.5 py-1 rounded-md bg-green-500/20 text-green-400 border border-green-500/30">
                    <span className="text-[11px] font-black tracking-wider">FT</span>
                </div>
            );
        }

        // NOT STARTED or UNKNOWN (vs)
        return (
            <div className="px-2.5 py-1 rounded-md bg-white/5 text-gray-500 border border-white/10">
                <span className="text-[11px] font-bold tracking-wider">vs</span>
            </div>
        );
    };

    return (
        <>
            <div
                onClick={handleClick}
                className="group relative bg-[#121212] rounded-2xl border border-white/5 shadow-lg transition-all duration-300 hover:border-green-500/30 hover:shadow-green-500/10 cursor-pointer overflow-hidden"
            >
                {/* 1. Header Section: Bot Info & Time */}
                <div className="flex items-center justify-between p-4 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-sm shadow-green-900/20">
                            <Robot size={22} weight="fill" className="text-green-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="block text-white font-bold text-sm tracking-wide leading-tight">
                                    {botName}
                                </span>
                                <button
                                    onClick={handleInfoClick}
                                    className="text-gray-500 hover:text-green-500 transition-colors p-0.5 rounded-full hover:bg-white/5"
                                >
                                    <Info size={16} weight="bold" />
                                </button>
                            </div>
                            <span className="text-[11px] text-gray-400 font-medium tracking-wide block mt-0.5 opacity-80">
                                Basari Orani %{successRate}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* VIP / FREE Badge */}
                        <div className={`px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase ${isVip
                            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20'
                            : 'bg-white/5 text-gray-500 border border-white/10'
                            }`}>
                            {isVip ? 'VIP' : 'FREE'}
                        </div>

                        {/* Favorite Button */}
                        <button
                            onClick={handleToggleFavorite}
                            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${isFavorite
                                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <Star size={14} weight={isFavorite ? 'fill' : 'bold'} />
                        </button>
                    </div>
                </div>

                {/* Separator Line */}
                <div className="h-px bg-white/5 mx-4" />

                {/* 2. League Section */}
                <div className="px-4 py-3 flex items-center gap-2">
                    {/* Country Flag & Name */}
                    {prediction.country_logo && (
                        <div className="flex items-center gap-1.5">
                            <img
                                src={prediction.country_logo}
                                alt=""
                                className="w-4 h-4 object-contain"
                            />
                            {prediction.country_name && (
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest truncate opacity-80">
                                    {prediction.country_name}
                                </span>
                            )}
                            <span className="text-[10px] text-gray-600 font-bold mx-0.5">.</span>
                        </div>
                    )}

                    {/* League Name */}
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest truncate opacity-80 flex-1">
                        {prediction.league_name || 'UNKNOWN LEAGUE'}
                    </span>

                    {/* Date/Time */}
                    <span className="text-[11px] text-gray-500 font-bold tracking-tight whitespace-nowrap pl-2 opacity-60">
                        {dateTimeString}
                    </span>
                </div>

                {/* Separator Line */}
                <div className="h-px bg-white/5 mx-4" />

                {/* 3. Match Section */}
                <div className="px-4 py-5 flex items-center justify-between">
                    {/* Home Team */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 min-w-0">
                        {prediction.home_team_logo ? (
                            <img
                                src={prediction.home_team_logo}
                                alt=""
                                className="w-10 h-10 object-contain flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                        <span className="text-xs font-bold text-white text-center w-full whitespace-normal leading-tight line-clamp-2">
                            {prediction.home_team_name}
                        </span>
                    </div>

                    {/* Score & Status Badge */}
                    <div className="flex-shrink-0 px-2 flex flex-col items-center justify-center gap-2">
                        <span className="text-3xl font-black text-white tracking-widest font-mono leading-none">
                            {displayScore}
                        </span>
                        {/* Professional Match Status Badge */}
                        {getMatchStatusBadge()}
                        {/* Show minute for live matches */}
                        {isLive && currentMinute && (
                            <span className="text-[10px] text-gray-400 font-bold tracking-wide">
                                {currentMinute}'
                            </span>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 min-w-0">
                        {prediction.away_team_logo ? (
                            <img
                                src={prediction.away_team_logo}
                                alt=""
                                className="w-10 h-10 object-contain flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                        <span className="text-xs font-bold text-white text-center w-full whitespace-normal leading-tight line-clamp-2">
                            {prediction.away_team_name}
                        </span>
                    </div>
                </div>

                {/* 4. Footer Section: Prediction & Result */}
                <div className="bg-[#181818] px-4 py-3 mx-4 mb-4 rounded-xl border border-white/5 flex items-center justify-between relative overflow-hidden">
                    {/* Glow Effect */}
                    {isWinner && <div className="absolute inset-0 bg-green-500/5 animate-pulse" />}
                    {isLoser && <div className="absolute inset-0 bg-red-500/5" />}
                    {isPending && <div className="absolute inset-0 bg-yellow-500/5" />}

                    <div className="flex items-center gap-3 relative z-10 w-full">
                        <div className="w-9 h-9 rounded-full bg-[#222] border border-white/5 flex items-center justify-center text-gray-500 flex-shrink-0">
                            <Robot size={18} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">AI TAHMINI</span>
                            <div className="flex items-center flex-wrap gap-2">
                                {/* Phase 5: Use unified prediction field */}
                                <span className="text-sm font-black text-white tracking-tight whitespace-nowrap">
                                    {prediction.prediction}
                                </span>

                                {/* Context Badge (Minute | Score) */}
                                {(prediction.minute_at_prediction || prediction.score_at_prediction) && (
                                    <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-0.5 rounded text-red-400 border border-red-500/10 ml-0 flex-shrink-0">
                                        <Clock size={12} weight="fill" />
                                        <span className="text-xs font-bold whitespace-nowrap">
                                            {prediction.minute_at_prediction}' | {prediction.score_at_prediction || '0-0'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Button (Right Aligned) */}
                        <div className="flex-shrink-0 ml-auto pl-2">
                            {isPending && (
                                <div className="px-4 py-1.5 rounded-lg bg-[#222] border border-white/10 text-gray-400 text-xs font-bold uppercase tracking-wide">
                                    Bekliyor
                                </div>
                            )}
                            {isWinner && (
                                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 text-black rounded-lg shadow-lg shadow-green-500/20">
                                    <Trophy size={14} weight="fill" />
                                    <span className="text-xs font-black uppercase tracking-wide">WIN</span>
                                </div>
                            )}
                            {isLoser && (
                                <div className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg">
                                    <WarningCircle size={14} weight="fill" />
                                    <span className="text-xs font-black uppercase tracking-wide">LOSE</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Popup Modal */}
            <BotInfoModal
                isOpen={isInfoOpen}
                onClose={() => setIsInfoOpen(false)}
                botName={botName}
                description={description}
                stats={botStats}
            />
        </>
    );
}
