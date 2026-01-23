/**
 * SofascoreMatchRow
 *
 * Compact match row component inspired by Sofascore design
 * Features:
 * - Horizontal layout with time/score in center
 * - Team logos and names
 * - Live minute indicator with pulsing animation
 * - Favorite toggle
 */

import { useNavigate } from 'react-router-dom';
import type { Match } from '../../api/matches';
import { isLiveMatch, isFinishedMatch, MatchState } from '../../utils/matchStatus';
import { useFavorites } from '../../context/FavoritesContext';
import { useAIPredictions } from '../../context/AIPredictionsContext';
import { Star, Robot } from '@phosphor-icons/react';

interface SofascoreMatchRowProps {
    match: Match;
}

export function SofascoreMatchRow({ match }: SofascoreMatchRowProps) {
    const navigate = useNavigate();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { getPredictionByMatch } = useAIPredictions();
    const prediction = getPredictionByMatch(match.id);
    const hasPrediction = !!prediction;
    const isMatchFavorite = isFavorite(match.id);

    // Safety check
    if (!match || typeof match !== 'object' || !match.id) {
        return null;
    }

    const status = (match as any).status ?? (match as any).match_status ?? 0;
    const isLive = isLiveMatch(status);
    const isFinished = isFinishedMatch(status);
    const isHalftime = status === MatchState.HALF_TIME;

    // Get minute text from backend
    const minuteText = match.minute_text || '';

    // Get match time for display
    const matchTime = match.match_time ?? 0;
    const matchDate = new Date(matchTime * 1000);
    const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Scores
    const homeScore = Number((match as any).home_score ?? 0);
    const awayScore = Number((match as any).away_score ?? 0);

    // Team names
    const homeTeamName = (match as any).home_team_name || match.home_team?.name || 'Ev Sahibi';
    const awayTeamName = (match as any).away_team_name || match.away_team?.name || 'Deplasman';

    const handleClick = () => {
        navigate(`/match/${match.id}/stats`);
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFavorite(match.id);
    };

    return (
        <div
            onClick={handleClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                backgroundColor: isLive ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                borderLeft: isLive ? '3px solid #ef4444' : '3px solid transparent',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isLive ? 'rgba(239, 68, 68, 0.08)' : '#f9fafb';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isLive ? 'rgba(239, 68, 68, 0.04)' : 'transparent';
            }}
        >
            {/* Time/Minute Column */}
            <div style={{
                width: '52px',
                flexShrink: 0,
                textAlign: 'center',
            }}>
                {isLive ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                    }}>
                        {/* Live dot with pulse */}
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isHalftime ? '#f59e0b' : '#ef4444',
                            animation: isHalftime ? 'none' : 'livePulse 1.5s ease-in-out infinite',
                        }} />
                        {/* Minute */}
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: isHalftime ? '#f59e0b' : '#ef4444',
                        }}>
                            {isHalftime ? 'HT' : minuteText || "—"}
                        </span>
                    </div>
                ) : isFinished ? (
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#6b7280',
                    }}>
                        BİTTİ
                    </span>
                ) : (
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        color: '#374151',
                    }}>
                        {timeStr}
                    </span>
                )}
            </div>

            {/* Teams Container */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: 0,
            }}>
                {/* Home Team Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    {/* Logo */}
                    {match.home_team?.logo_url ? (
                        <img
                            src={match.home_team.logo_url}
                            alt=""
                            style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div style={{ width: '18px', height: '18px', backgroundColor: '#e5e7eb', borderRadius: '2px', flexShrink: 0 }} />
                    )}

                    {/* Team Name */}
                    <span style={{
                        fontSize: '0.875rem',
                        fontWeight: homeScore > awayScore && isFinished ? '600' : '400',
                        color: homeScore > awayScore && isFinished ? '#111827' : '#374151',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                    }}>
                        {homeTeamName}
                    </span>

                    {/* Home Score */}
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: isLive ? '#ef4444' : (homeScore > awayScore && isFinished ? '#111827' : '#374151'),
                        width: '20px',
                        textAlign: 'right',
                    }}>
                        {status !== MatchState.NOT_STARTED ? homeScore : '-'}
                    </span>
                </div>

                {/* Away Team Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    {/* Logo */}
                    {match.away_team?.logo_url ? (
                        <img
                            src={match.away_team.logo_url}
                            alt=""
                            style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div style={{ width: '18px', height: '18px', backgroundColor: '#e5e7eb', borderRadius: '2px', flexShrink: 0 }} />
                    )}

                    {/* Team Name */}
                    <span style={{
                        fontSize: '0.875rem',
                        fontWeight: awayScore > homeScore && isFinished ? '600' : '400',
                        color: awayScore > homeScore && isFinished ? '#111827' : '#374151',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                    }}>
                        {awayTeamName}
                    </span>

                    {/* Away Score */}
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: isLive ? '#ef4444' : (awayScore > homeScore && isFinished ? '#111827' : '#374151'),
                        width: '20px',
                        textAlign: 'right',
                    }}>
                        {status !== MatchState.NOT_STARTED ? awayScore : '-'}
                    </span>
                </div>
            </div>

            {/* Right Actions */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: '12px',
                flexShrink: 0,
            }}>
                {/* AI Prediction Badge */}
                {hasPrediction && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#dbeafe',
                            borderRadius: '4px',
                        }}
                        title="Yapay Zeka Tahmini Var"
                    >
                        <Robot size={14} weight="fill" color="#3b82f6" />
                    </div>
                )}

                {/* Favorite Button */}
                <button
                    onClick={handleFavoriteClick}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    title={isMatchFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                >
                    <Star
                        size={18}
                        weight={isMatchFavorite ? 'fill' : 'regular'}
                        color={isMatchFavorite ? '#f59e0b' : '#9ca3af'}
                    />
                </button>
            </div>

            {/* CSS Animation for live pulse */}
            <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
      `}</style>
        </div>
    );
}

export default SofascoreMatchRow;
