import { useNavigate } from 'react-router-dom';
import type { Match } from '../api/matches';
import { isLiveMatch, isFinishedMatch, getMatchStatusText, formatMatchTime, MatchState } from '../utils/matchStatus';
import { useAIPredictions } from '../context/AIPredictionsContext';
import { useFavorites } from '../context/FavoritesContext';
import { Robot, Star } from '@phosphor-icons/react';

// AI Result Badge Helper
function getAIResultBadge(result: string | undefined | null): { text: string; bg: string; color: string } | null {
  switch (result) {
    case 'won':
      return { text: 'KAZANDI', bg: '#22c55e', color: 'white' };
    case 'lost':
      return { text: 'KAYBETTİ', bg: '#ef4444', color: 'white' };
    case 'pending':
      return { text: 'BEKLİYOR', bg: '#f59e0b', color: 'white' };
    case 'push':
    case 'cancelled':
      return { text: 'İADE', bg: '#6b7280', color: 'white' };
    default:
      return null;
  }
}

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const navigate = useNavigate();
  const { matchIds, predictions } = useAIPredictions();
  const { isFavorite, toggleFavorite } = useFavorites();
  const hasPrediction = matchIds.has(match.id);
  const prediction = predictions.get(match.id);
  const aiResultBadge = hasPrediction ? getAIResultBadge(prediction?.result) : null;
  const isMatchFavorite = isFavorite(match.id);

  // CRITICAL FIX: Safety checks
  if (!match || typeof match !== 'object' || !match.id) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
        <p style={{ color: '#991b1b', margin: 0, fontSize: '0.875rem' }}>Geçersiz maç verisi</p>
      </div>
    );
  }

  // Handle favorite toggle (prevent navigation)
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(match.id);
  };

  // Backend is authoritative: do not override status on the frontend based on timestamps.
  const status = (match as any).status ?? (match as any).match_status ?? 0;
  const isLive = isLiveMatch(status);
  const isFinished = isFinishedMatch(status);

  // Phase 4-4: Frontend is a pure renderer - use backend minute_text directly
  // Contract: minute_text is always a string (never null), backend guarantees this
  // Defensive fallback: if missing, show "—"
  const minuteText = match.minute_text || "—";

  // Phase 4-4: Stale badge detection (informational only, no actions)
  // Use backend-provided age_sec if available, otherwise calculate from updated_at (fallback)
  const matchTime = match.match_time ?? 0;
  const updatedAt = match.updated_at;
  const ageSec = match.age_sec ?? (updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000) : null);
  const staleReason = match.stale_reason;

  // Determine threshold based on status (Phase 4-3 compatible)
  const getStaleThreshold = (statusId: number, minute: number | null): number => {
    if (statusId === 3) return 900; // HALF_TIME: 15 minutes
    if (statusId === 4 && minute !== null && minute >= 45) return 180; // SECOND_HALF with progress: 3 minutes
    return 120; // LIVE matches: 2 minutes
  };

  const isStale = isLive && ageSec !== null && ageSec > getStaleThreshold(status, match.minute ?? null);

  // Score fields may come from different backends/serializers (regular vs display). Normalize safely.
  const homeScore = Number((match as any).home_score_regular ?? (match as any).home_score ?? match.home_score ?? 0);
  const awayScore = Number((match as any).away_score_regular ?? (match as any).away_score ?? match.away_score ?? 0);

  const homeOvertime = (match as any).home_score_overtime;
  const awayOvertime = (match as any).away_score_overtime;
  const homePenalties = (match as any).home_score_penalties;
  const awayPenalties = (match as any).away_score_penalties;

  // Normalize incident counts (may arrive as strings)
  const homeRedCards = Number((match as any).home_red_cards ?? 0);
  const awayRedCards = Number((match as any).away_red_cards ?? 0);
  const homeYellowCards = Number((match as any).home_yellow_cards ?? 0);
  const awayYellowCards = Number((match as any).away_yellow_cards ?? 0);
  const homeCorners = Number((match as any).home_corners ?? 0);
  const awayCorners = Number((match as any).away_corners ?? 0);

  const cardStyle: React.CSSProperties = {
    padding: '1rem',
    borderRadius: '8px',
    border: `1px solid ${isLive ? '#fca5a5' : isFinished ? '#e5e7eb' : '#e5e7eb'}`,
    backgroundColor: isLive ? '#fef2f2' : isFinished ? '#f9fafb' : 'white',
    boxShadow: isLive ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.2s',
    cursor: 'pointer',
  };

  const handleClick = () => {
    navigate(`/match/${match.id}/stats`);
  };

  return (
    <div style={cardStyle} onClick={handleClick}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLive && (
            <>
              {/* CRITICAL FIX: Halftime shows "DEVRE ARASI" instead of "CANLI" */}
              {status === MatchState.HALF_TIME ? (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                }}>
                  DEVRE ARASI
                </span>
              ) : (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  animation: 'pulse 2s infinite',
                }}>
                  CANLI
                </span>
              )}
              {/* Phase 4-4: Display minute_text from backend (includes HT/45+/90+/FT/etc.) */}
              {minuteText && minuteText !== "—" && (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                }}>
                  {minuteText}
                </span>
              )}
              {/* Phase 4-4: Stale badge (informational only) */}
              {isStale && (
                <span
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#fbbf24',
                    color: '#78350f',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={staleReason ? `Stale: ${staleReason}` : `Güncelleme gecikiyor (${ageSec}s)`}
                >
                  <span
                    className="animate-pulse flex h-2 w-2 rounded-full bg-red-400 opacity-75"
                  ></span>
                  ⚠️ Güncelleme gecikiyor
                </span>
              )}
            </>
          )}
          {isFinished && (
            <span style={{
              padding: '4px 8px',
              backgroundColor: '#6b7280',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              borderRadius: '4px',
            }}>
              BİTTİ
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {matchTime > 0 ? formatMatchTime(matchTime) : 'Tarih yok'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Favorite Toggle Button */}
          <button
            onClick={handleFavoriteClick}
            title={isMatchFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fef3c7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Star
              size={20}
              weight={isMatchFavorite ? 'fill' : 'regular'}
              color={isMatchFavorite ? '#f59e0b' : '#9ca3af'}
            />
          </button>

          {hasPrediction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                title="Yapay Zeka Tahmini Var"
                className="bg-blue-100 text-blue-600 p-1 rounded-md"
              >
                <Robot size={16} weight="fill" />
              </div>
              {aiResultBadge && (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: aiResultBadge.bg,
                  color: aiResultBadge.color,
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}>
                  {aiResultBadge.text}
                </span>
              )}
            </div>
          )}
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {getMatchStatusText(status)}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Home Team */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
        }}>
          {match.home_team?.logo_url ? (
            <img
              src={match.home_team.logo_url}
              alt={match.home_team?.name || 'Home Team'}
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
            }}></div>
          )}
          <span style={{
            fontWeight: '500',
            fontSize: '0.875rem',
            flex: 1,
          }}>
            {(() => {
              const name = (match as any).home_team_name || match.home_team?.name;
              if (name && name !== 'Unknown Team' && typeof name === 'string' && name.trim() !== '') {
                return name;
              }
              // TEMPORARY: Show ID to debug data flow
              return match.home_team_id || 'N/A';
            })()}
          </span>
        </div>

        {/* Score */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          margin: '0 16px',
        }}>
          {/* Main Score */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: isLive ? '#dc2626' : '#1f2937',
              }}>
                {homeScore}
              </span>
              {/* Show overtime/penalty scores if available */}
              {(() => {
                const overtime = homeOvertime;
                const penalties = homePenalties;
                if (overtime !== undefined && overtime !== null && Number(overtime) > 0) {
                  return (
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontWeight: 'normal',
                    }}>
                      ({overtime}{penalties !== undefined && penalties !== null && Number(penalties) > 0 ? ` (${penalties})` : ''})
                    </span>
                  );
                } else if (penalties !== undefined && penalties !== null && Number(penalties) > 0) {
                  return (
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontWeight: 'normal',
                    }}>
                      ({penalties})
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <span style={{ color: '#9ca3af' }}>-</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: isLive ? '#dc2626' : '#1f2937',
              }}>
                {awayScore}
              </span>
              {/* Show overtime/penalty scores if available */}
              {(() => {
                const overtime = awayOvertime;
                const penalties = awayPenalties;
                if (overtime !== undefined && overtime !== null && Number(overtime) > 0) {
                  return (
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontWeight: 'normal',
                    }}>
                      ({overtime}{penalties !== undefined && penalties !== null && Number(penalties) > 0 ? ` (${penalties})` : ''})
                    </span>
                  );
                } else if (penalties !== undefined && penalties !== null && Number(penalties) > 0) {
                  return (
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontWeight: 'normal',
                    }}>
                      ({penalties})
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Live Incidents Icons (Red Cards, Yellow Cards, Corners) */}
          {(() => {
            const homeRed = homeRedCards;
            const awayRed = awayRedCards;
            const homeYellow = homeYellowCards;
            const awayYellow = awayYellowCards;
            const homeCornersCount = homeCorners;
            const awayCornersCount = awayCorners;

            const hasIncidents = (homeRed && homeRed > 0) || (awayRed && awayRed > 0) ||
              (homeYellow && homeYellow > 0) || (awayYellow && awayYellow > 0) ||
              (homeCornersCount && homeCornersCount > 0) || (awayCornersCount && awayCornersCount > 0);

            if (!hasIncidents) return null;

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.75rem',
                color: '#6b7280',
              }}>
                {/* Home Team Incidents */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {homeRed > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }} title="Kırmızı Kart">
                      🔴 {homeRed}
                    </span>
                  )}
                  {homeYellow > 0 && (
                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }} title="Sarı Kart">
                      🟨 {homeYellow}
                    </span>
                  )}
                  {homeCornersCount > 0 && (
                    <span style={{ color: '#6b7280' }} title="Korner">
                      ⚽ {homeCornersCount}
                    </span>
                  )}
                </div>
                <span style={{ color: '#9ca3af' }}>|</span>
                {/* Away Team Incidents */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {awayRed > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }} title="Kırmızı Kart">
                      🔴 {awayRed}
                    </span>
                  )}
                  {awayYellow > 0 && (
                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }} title="Sarı Kart">
                      🟨 {awayYellow}
                    </span>
                  )}
                  {awayCornersCount > 0 && (
                    <span style={{ color: '#6b7280' }} title="Korner">
                      ⚽ {awayCornersCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Away Team */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
          justifyContent: 'flex-end',
        }}>
          <span style={{
            fontWeight: '500',
            fontSize: '0.875rem',
            flex: 1,
            textAlign: 'right',
          }}>
            {(() => {
              const name = (match as any).away_team_name || match.away_team?.name;
              if (name && name !== 'Unknown Team' && typeof name === 'string' && name.trim() !== '') {
                return name;
              }
              // TEMPORARY: Show ID to debug data flow
              return match.away_team_id || 'N/A';
            })()}
          </span>
          {match.away_team?.logo_url ? (
            <img
              src={match.away_team.logo_url}
              alt={match.away_team?.name || 'Away Team'}
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
            }}></div>
          )}
        </div>
      </div>
    </div >
  );
}
