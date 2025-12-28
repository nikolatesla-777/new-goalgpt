/**
 * Match Events Timeline Component (Premium Edition)
 * 
 * Re-imagined with a central axis and side-by-side layout.
 * Home team events are on the Left | Away team events are on the Right
 */

import { useMemo } from 'react';

const EVENT_TYPES = {
    GOAL: 1,
    CORNER: 2,
    YELLOW_CARD: 3,
    RED_CARD: 4,
    OFFSIDE: 5,
    FREE_KICK: 6,
    GOAL_KICK: 7,
    PENALTY: 8,
    SUBSTITUTION: 9,
    START: 10,
    END: 12,
    HALFTIME_SCORE: 13,
    CARD_UPGRADE: 15,
    PENALTY_MISSED: 16,
    OWN_GOAL: 17,
    VAR: 28,
} as const;

interface Incident {
    type: number;
    position: number;
    time: number;
    player_name?: string;
    assist1_name?: string;
    in_player_name?: string;
    out_player_name?: string;
    home_score?: number;
    away_score?: number;
    var_reason?: number;
    reason_type?: number;
}

interface MatchEventsTimelineProps {
    incidents: Incident[];
    homeTeamName?: string;
    awayTeamName?: string;
}

function getEventStyle(incident: Incident) {
    const type = incident.type;
    switch (type) {
        case EVENT_TYPES.GOAL:
        case EVENT_TYPES.PENALTY:
            return { icon: '⚽', color: '#10b981', label: 'GOL' };
        case EVENT_TYPES.OWN_GOAL:
            return { icon: '⚽', color: '#10b981', label: 'KENDİ KALESİNE GOL' };
        case EVENT_TYPES.YELLOW_CARD:
            return { icon: '🟨', color: '#fbbf24', label: 'SARI KART' };
        case EVENT_TYPES.RED_CARD:
            return { icon: '🟥', color: '#dc2626', label: 'KIRMIZI KART' };
        case EVENT_TYPES.CARD_UPGRADE:
            return { icon: '🟨🟥', color: '#dc2626', label: 'İKİNCİ SARI' };
        case EVENT_TYPES.SUBSTITUTION:
            return { icon: '🔄', color: '#3b82f6', label: 'DEĞİŞİKLİK' };
        case EVENT_TYPES.VAR:
            return { icon: '📺', color: '#6366f1', label: 'VAR' };
        case EVENT_TYPES.START:
            return { icon: '🏁', color: '#22c55e', label: 'MAÇ BAŞLADI' };
        case EVENT_TYPES.END:
            return { icon: '🏁', color: '#6b7280', label: 'MAÇ BİTTİ' };
        case EVENT_TYPES.HALFTIME_SCORE:
            return { icon: '⏸️', color: '#f59e0b', label: 'DEVRE ARASI' };
        case EVENT_TYPES.CORNER:
            return { icon: '🚩', color: '#8b5cf6', label: 'KORNER' };
        case EVENT_TYPES.OFFSIDE:
            return { icon: '🚫', color: '#6b7280', label: 'OFSAYT' };
        case EVENT_TYPES.FREE_KICK:
            return { icon: '⚡', color: '#0ea5e9', label: 'SERBEST VURUŞ' };
        case EVENT_TYPES.PENALTY_MISSED:
            return { icon: '❌', color: '#ef4444', label: 'PENALTI KAÇTI' };
        default:
            return { icon: '•', color: '#9ca3af', label: 'DİĞER' };
    }
}

export function MatchEventsTimeline({ incidents }: MatchEventsTimelineProps) {
    const sortedIncidents = useMemo(() => {
        if (!incidents || !Array.isArray(incidents)) return [];
        return [...incidents]
            .filter(inc => inc && typeof inc.time === 'number')
            .sort((a, b) => b.time - a.time);
    }, [incidents]);

    if (sortedIncidents.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
                <div style={{ color: '#1f2937', fontSize: '16px', fontWeight: 600 }}>Henüz etkinlik yok</div>
                <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '8px' }}>Bu maç için etkinlik verisi henüz oluşmamış olabilir.</div>
                
                {/* KICK OFF MARKER - Always show when match has started */}
                <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        color: '#fff',
                        padding: '8px 24px',
                        borderRadius: '50px',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}>
                        🏁 BAŞLADI
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '900px',
            margin: '20px auto',
            padding: '60px 0',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
            fontFamily: '"Inter", sans-serif'
        }}>
            {/* CENTRAL AXIS */}
            <div style={{
                position: 'absolute',
                left: '50%',
                top: '40px',
                bottom: '80px',
                width: '4px',
                backgroundColor: '#f8fafc',
                backgroundImage: 'linear-gradient(to bottom, #f1f5f9 0%, #f1f5f9 100%)',
                transform: 'translateX(-50%)',
                borderRadius: '2px',
                zIndex: 1
            }}></div>

            {/* EVENT ROWS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', position: 'relative', zIndex: 2 }}>
                {sortedIncidents.map((incident, idx) => (
                    <EventTimelineRow key={idx} incident={incident} />
                ))}
            </div>

            {/* KICK OFF MARKER */}
            <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                <div style={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    padding: '8px 24px',
                    borderRadius: '50px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                }}>
                    🏁 BAŞLADI
                </div>
            </div>
        </div>
    );
}

function EventTimelineRow({ incident }: { incident: Incident }) {
    const isHome = incident.position === 1;
    const isNeutral = incident.position === 0;
    const { icon, color, label } = getEventStyle(incident);
    const showScore = incident.type === EVENT_TYPES.GOAL || incident.type === EVENT_TYPES.OWN_GOAL || incident.type === EVENT_TYPES.PENALTY;

    return (
        <div style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            flexDirection: (isHome || isNeutral) ? 'row' : 'row-reverse'
        }}>
            {/* CONTENT SIDE */}
            <div style={{
                width: '50%',
                padding: (isHome || isNeutral) ? '0 40px 0 20px' : '0 20px 0 40px',
                textAlign: (isHome || isNeutral) ? 'right' : 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: color,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                }}>
                    {label}
                </div>

                <div style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#1e293b'
                }}>
                    {incident.type === EVENT_TYPES.SUBSTITUTION
                        ? (incident.in_player_name || 'Giren Oyuncu')
                        : incident.type === EVENT_TYPES.START
                            ? 'Maç Başladı'
                            : incident.type === EVENT_TYPES.END
                                ? 'Maç Bitti'
                                : incident.type === EVENT_TYPES.HALFTIME_SCORE
                                    ? `Devre Skoru: ${incident.home_score ?? 0} - ${incident.away_score ?? 0}`
                                    : (incident.player_name || label)
                    }
                </div>

                {incident.type === EVENT_TYPES.SUBSTITUTION ? (
                    <div style={{
                        fontSize: '13px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: (isHome || isNeutral) ? 'flex-end' : 'flex-start',
                        gap: '6px'
                    }}>
                        <span style={{ color: '#ef4444' }}>↓</span> {incident.out_player_name || 'Çıkan Oyuncu'}
                    </div>
                ) : incident.assist1_name ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        asist: <span style={{ fontWeight: 600 }}>{incident.assist1_name}</span>
                    </div>
                ) : null}

                {showScore && incident.home_score !== undefined && (
                    <div style={{
                        marginTop: '6px',
                        display: 'flex',
                        justifyContent: (isHome || isNeutral) ? 'flex-end' : 'flex-start'
                    }}>
                        <div style={{
                            backgroundColor: '#1e293b',
                            color: '#fff',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 800,
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}>
                            {incident.home_score} - {incident.away_score}
                        </div>
                    </div>
                )}
            </div>

            {/* CENTER AXIS ICON */}
            <div style={{
                position: 'relative',
                width: '1px',
                height: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5
            }}>
                {/* MINUTE BADGE */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '-35px',
                    transform: 'translateX(-50%)',
                    fontSize: '12px',
                    fontWeight: 900,
                    color: '#cbd5e1',
                    whiteSpace: 'nowrap'
                }}>
                    {incident.time}'
                </div>

                {/* ICON CONTAINER */}
                <div style={{
                    width: '44px',
                    height: '44px',
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'translateX(-50%)',
                    zIndex: 10
                }}>
                    <span style={{ fontSize: '24px' }}>{icon}</span>
                </div>
            </div>

            {/* SPACER FOR OTHER SIDE */}
            <div style={{ width: '50%' }}></div>
        </div>
    );
}
