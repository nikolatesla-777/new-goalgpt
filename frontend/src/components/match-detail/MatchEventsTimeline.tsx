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
    START: 10,               // 1. yarı başladı
    MIDFIELD: 11,            // 2. yarı başladı (from TheSports API)
    END: 12,                 // Maç bitti
    HALFTIME_SCORE: 13,      // Devre skoru
    CARD_UPGRADE: 15,        // İkinci sarı -> Kırmızı
    PENALTY_MISSED: 16,
    OWN_GOAL: 17,
    INJURY_TIME: 19,         // Uzatma süresi
    OVERTIME_OVER: 26,       // Uzatma bitti
    PENALTY_KICK_ENDED: 27,  // Penaltı atışları bitti
    VAR: 28,
    PENALTY_SHOOTOUT: 29,    // Penaltı atışı (seri)
    PENALTY_MISSED_SHOOTOUT: 30, // Penaltı kaçtı (seri)
    SHOT_ON_POST: 34,        // Direkten dönen
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
    add_time?: number; // Injury time duration (e.g., +2 minutes)
}

interface MatchEventsTimelineProps {
    incidents: Incident[];
    homeTeamName?: string;
    awayTeamName?: string;
    matchStatusId?: number; // 1=NOT_STARTED, 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5+=OVERTIME/END
}

function getEventStyle(incident: Incident, matchStatusId?: number) {
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
        case EVENT_TYPES.MIDFIELD:
            // Type 11 at 45-47' = halftime/2nd half marker
            // If match is at HALF_TIME (status=3), show "İLK YARI BİTTİ"
            // If match is at SECOND_HALF or later (status>=4), show "2. YARI BAŞLADI"
            if (matchStatusId === 3) {
                return { icon: '⏸️', color: '#f59e0b', label: 'İLK YARI BİTTİ' };
            }
            return { icon: '▶️', color: '#22c55e', label: '2. YARI BAŞLADI' };
        case EVENT_TYPES.END:
            return { icon: '🏁', color: '#6b7280', label: 'MAÇ BİTTİ' };
        case EVENT_TYPES.HALFTIME_SCORE:
            return { icon: '⏸️', color: '#f59e0b', label: 'DEVRE ARASI' };
        case EVENT_TYPES.INJURY_TIME:
            return { icon: '⏱️', color: '#f59e0b', label: 'UZATMA SÜRESİ' };
        case EVENT_TYPES.OVERTIME_OVER:
            return { icon: '🏁', color: '#6b7280', label: 'UZATMA BİTTİ' };
        case EVENT_TYPES.PENALTY_KICK_ENDED:
            return { icon: '🏁', color: '#6b7280', label: 'PENALTİLAR BİTTİ' };
        case EVENT_TYPES.PENALTY_SHOOTOUT:
            return { icon: '⚽', color: '#10b981', label: 'PENALTİ GOL' };
        case EVENT_TYPES.PENALTY_MISSED_SHOOTOUT:
            return { icon: '❌', color: '#ef4444', label: 'PENALTİ KAÇTI' };
        case EVENT_TYPES.SHOT_ON_POST:
            return { icon: '🥅', color: '#f59e0b', label: 'DİREKTEN DÖNEN' };
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

function getEventText(incident: Incident, label: string, matchStatusId?: number): string {
    switch (incident.type) {
        case EVENT_TYPES.SUBSTITUTION:
            return incident.in_player_name || 'Giren Oyuncu';
        case EVENT_TYPES.START:
            return 'Maç Başladı';
        case EVENT_TYPES.MIDFIELD:
            // If match is at HALF_TIME (status=3), show "İlk Yarı Bitti"
            // If match is at SECOND_HALF or later (status>=4), show "2. Yarı Başladı"
            if (matchStatusId === 3) {
                return 'İlk Yarı Bitti';
            }
            return '2. Yarı Başladı';
        case EVENT_TYPES.END:
            return 'Maç Bitti';
        case EVENT_TYPES.HALFTIME_SCORE:
            return `Devre Skoru: ${incident.home_score ?? 0} - ${incident.away_score ?? 0}`;
        case EVENT_TYPES.INJURY_TIME:
            return incident.add_time ? `+${incident.add_time} Dakika Uzatma` : 'Uzatma Süresi Verildi';
        case EVENT_TYPES.OVERTIME_OVER:
            return 'Uzatma Devresi Bitti';
        case EVENT_TYPES.PENALTY_KICK_ENDED:
            return 'Penaltı Atışları Bitti';
        case EVENT_TYPES.PENALTY_SHOOTOUT:
        case EVENT_TYPES.PENALTY_MISSED_SHOOTOUT:
            return incident.player_name || 'Penaltı Atışı';
        case EVENT_TYPES.SHOT_ON_POST:
            return incident.player_name || 'Direkten Dönen';
        default:
            return incident.player_name || label;
    }
}

export function MatchEventsTimeline({ incidents, matchStatusId }: MatchEventsTimelineProps) {
    // Match has started if status_id >= 2 (FIRST_HALF, HALF_TIME, SECOND_HALF, OVERTIME, END, etc.)
    const matchHasStarted = (matchStatusId ?? 0) >= 2;
    
    const sortedIncidents = useMemo(() => {
        if (!incidents || !Array.isArray(incidents)) return [];
        return [...incidents]
            .filter(inc => {
                if (!inc || typeof inc.time !== 'number') return false;
                // Filter out MIDFIELD (type 11) ONLY if it's not at halftime (45-47')
                // At 45-47' it means "2nd half started", at other times it's restart after goal
                if (inc.type === EVENT_TYPES.MIDFIELD && (inc.time < 45 || inc.time > 47)) return false;
                // Filter out START (type 10) events - we show "BAŞLADI" marker at the bottom
                if (inc.type === EVENT_TYPES.START) return false;
                return true;
            })
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
                {matchHasStarted ? (
                    <>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚽</div>
                        <div style={{ color: '#1f2937', fontSize: '16px', fontWeight: 600 }}>Maç devam ediyor</div>
                        <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '8px' }}>Henüz önemli bir olay gerçekleşmedi.</div>
                        
                        {/* KICK OFF MARKER */}
                        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{
                                backgroundColor: '#22c55e',
                                color: '#fff',
                                padding: '10px 28px',
                                borderRadius: '50px',
                                fontSize: '13px',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)'
                            }}>
                                🏁 MAÇ BAŞLADI
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
                        <div style={{ color: '#1f2937', fontSize: '16px', fontWeight: 600 }}>Henüz etkinlik yok</div>
                        <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '8px' }}>Bu maç için etkinlik verisi henüz oluşmamış olabilir.</div>
                    </>
                )}
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
                    <EventTimelineRow key={idx} incident={incident} matchStatusId={matchStatusId} />
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

function EventTimelineRow({ incident, matchStatusId }: { incident: Incident; matchStatusId?: number }) {
    const isHome = incident.position === 1;
    const isNeutral = incident.position === 0;
    const { icon, color, label } = getEventStyle(incident, matchStatusId);
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
                    {getEventText(incident, label, matchStatusId)}
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
