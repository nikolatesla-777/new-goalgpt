/**
 * Match Events Timeline Component (Premium Edition)
 * 
 * Re-imagined with a central axis and side-by-side layout.
 * Home team events are on the Left | Away team events are on the Right
 */

import { useMemo } from 'react';
import {
    SoccerBall,
    Cards,
    ArrowsLeftRight,
    Flag,
    HandPalm,
    Timer,
    PlayCircle,
    MonitorPlay,
    XCircle,
    Prohibit,
    Lightning
} from '@phosphor-icons/react';

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

// Get event styling and icon component
function getEventStyle(incident: Incident) {
    const type = incident.type;
    switch (type) {
        case EVENT_TYPES.GOAL:
        case EVENT_TYPES.PENALTY:
            return {
                Icon: SoccerBall,
                colorClass: 'text-emerald-500',
                bgClass: 'bg-emerald-50',
                borderClass: 'border-emerald-100',
                label: 'GOL'
            };
        case EVENT_TYPES.OWN_GOAL:
            return {
                Icon: SoccerBall,
                colorClass: 'text-red-500',
                bgClass: 'bg-red-50',
                borderClass: 'border-red-100',
                label: 'KENDİ KALESİNE'
            };
        case EVENT_TYPES.YELLOW_CARD:
            return {
                Icon: Cards,
                colorClass: 'text-yellow-500',
                bgClass: 'bg-yellow-50',
                borderClass: 'border-yellow-100',
                label: 'SARI KART',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.RED_CARD:
            return {
                Icon: Cards,
                colorClass: 'text-red-600',
                bgClass: 'bg-red-50',
                borderClass: 'border-red-100',
                label: 'KIRMIZI KART',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.CARD_UPGRADE:
            return {
                Icon: Cards,
                colorClass: 'text-red-600',
                bgClass: 'bg-red-50',
                borderClass: 'border-red-100',
                label: 'İKİNCİ SARI',
                iconWeight: 'duotone'
            };
        case EVENT_TYPES.SUBSTITUTION:
            return {
                Icon: ArrowsLeftRight,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50',
                borderClass: 'border-blue-100',
                label: 'DEĞİŞİKLİK'
            };
        case EVENT_TYPES.VAR:
            return {
                Icon: MonitorPlay,
                colorClass: 'text-indigo-500',
                bgClass: 'bg-indigo-50',
                borderClass: 'border-indigo-100',
                label: 'VAR'
            };
        case EVENT_TYPES.START:
            return {
                Icon: PlayCircle,
                colorClass: 'text-green-600',
                bgClass: 'bg-green-50',
                borderClass: 'border-green-100',
                label: 'MAÇ BAŞLADI',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.MIDFIELD:
            return {
                Icon: PlayCircle,
                colorClass: 'text-blue-600',
                bgClass: 'bg-blue-50',
                borderClass: 'border-blue-100',
                label: '2. YARI BAŞLADI',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.END:
            return {
                Icon: Flag,
                colorClass: 'text-gray-800',
                bgClass: 'bg-gray-100',
                borderClass: 'border-gray-200',
                label: 'MAÇ BİTTİ',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.HALFTIME_SCORE:
            return {
                Icon: Timer,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50',
                borderClass: 'border-amber-100',
                label: 'DEVRE ARASI'
            };
        case EVENT_TYPES.INJURY_TIME:
            return {
                Icon: Timer,
                colorClass: 'text-amber-600',
                bgClass: 'bg-amber-50',
                borderClass: 'border-amber-100',
                label: 'UZATMA SÜRESİ'
            };
        case EVENT_TYPES.PENALTY_SHOOTOUT:
            return {
                Icon: SoccerBall,
                colorClass: 'text-emerald-600',
                bgClass: 'bg-emerald-50',
                borderClass: 'border-emerald-100',
                label: 'PENALTI GOL'
            };
        case EVENT_TYPES.PENALTY_MISSED_SHOOTOUT:
        case EVENT_TYPES.PENALTY_MISSED:
            return {
                Icon: XCircle,
                colorClass: 'text-red-500',
                bgClass: 'bg-red-50',
                borderClass: 'border-red-100',
                label: 'PENALTI KAÇTI'
            };
        case EVENT_TYPES.SHOT_ON_POST:
            return {
                Icon: Prohibit,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50',
                borderClass: 'border-amber-100',
                label: 'DİREKTEN DÖNEN'
            };
        case EVENT_TYPES.CORNER:
            return {
                Icon: Flag,
                colorClass: 'text-violet-500',
                bgClass: 'bg-violet-50',
                borderClass: 'border-violet-100',
                label: 'KORNER',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.OFFSIDE:
            return {
                Icon: HandPalm,
                colorClass: 'text-gray-500',
                bgClass: 'bg-gray-50',
                borderClass: 'border-gray-100',
                label: 'OFSAYT',
                iconWeight: 'fill'
            };
        case EVENT_TYPES.FREE_KICK:
            return {
                Icon: Lightning,
                colorClass: 'text-sky-500',
                bgClass: 'bg-sky-50',
                borderClass: 'border-sky-100',
                label: 'SERBEST VURUŞ',
                iconWeight: 'fill'
            };
        default:
            return {
                Icon: Prohibit,
                colorClass: 'text-gray-400',
                bgClass: 'bg-gray-50',
                borderClass: 'border-gray-100',
                label: 'DİĞER'
            };
    }
}

function getEventText(incident: Incident, label: string): string {
    switch (incident.type) {
        case EVENT_TYPES.SUBSTITUTION:
            return incident.in_player_name || 'Giren Oyuncu';
        case EVENT_TYPES.START:
            return 'Maç Başladı';
        case EVENT_TYPES.MIDFIELD:
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
    // Match has started if status_id >= 2
    const matchHasStarted = (matchStatusId ?? 0) >= 2;

    // Process and sort incidents
    const sortedIncidents = useMemo(() => {
        if (!incidents || !Array.isArray(incidents)) return [];
        return [...incidents]
            .filter(inc => {
                if (!inc || typeof inc.time !== 'number') return false;
                // Filter Midfield/Start logic
                if (inc.type === EVENT_TYPES.MIDFIELD && (inc.time < 45 || inc.time > 47)) return false;
                if (inc.type === EVENT_TYPES.START) return false;
                return true;
            })
            .sort((a, b) => b.time - a.time);
    }, [incidents]);

    if (sortedIncidents.length === 0) {
        return (
            <div className="text-center py-16 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                {matchHasStarted ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center animate-pulse">
                            <SoccerBall size={48} weight="duotone" className="text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Maç Devam Ediyor</h3>
                            <p className="text-sm text-gray-500 mt-1">Henüz önemli bir olay gerçekleşmedi.</p>
                        </div>

                        <div className="mt-6 px-6 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold tracking-wider shadow-lg shadow-emerald-200 flex items-center gap-2">
                            <PlayCircle size={16} weight="fill" />
                            MAÇ BAŞLADI
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                            <Prohibit size={48} weight="duotone" className="text-gray-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Henüz Etkinlik Yok</h3>
                            <p className="text-sm text-gray-500 mt-1">Bu maç için etkinlik verisi henüz oluşmamış olabilir.</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-4xl mx-auto py-12 px-4 md:px-0 font-sans">
            {/* CENTRAL AXIS */}
            <div className="absolute left-1/2 top-4 bottom-20 w-0.5 bg-gray-100 -translate-x-1/2 rounded-full z-0 hidden md:block"></div>

            {/* EVENT ROWS */}
            <div className="flex flex-col gap-8 md:gap-12 relative z-10">
                {sortedIncidents.map((incident, idx) => (
                    <EventTimelineRow key={idx} incident={incident} />
                ))}
            </div>

            {/* KICK OFF MARKER */}
            <div className="mt-16 flex justify-center relative z-20">
                <div className="bg-gray-800 text-white px-6 py-2 rounded-full text-xs font-bold tracking-wider shadow-xl flex items-center gap-2">
                    <PlayCircle size={16} weight="fill" className="text-green-400" />
                    MAÇ BAŞLADI
                </div>
            </div>
        </div>
    );
}

function EventTimelineRow({ incident }: { incident: Incident }) {
    const isHome = incident.position === 1; // 1 = Home
    const isNeutral = incident.position === 0;
    const { Icon, colorClass, bgClass, borderClass, label, iconWeight } = getEventStyle(incident);
    const showScore = incident.type === EVENT_TYPES.GOAL || incident.type === EVENT_TYPES.OWN_GOAL || incident.type === EVENT_TYPES.PENALTY;

    // determine alignment classes based on side
    const isRightSide = !isHome && !isNeutral; // Away team is right

    return (
        <div className={`flex w-full items-center ${isRightSide ? 'flex-row-reverse md:flex-row-reverse' : 'flex-row md:flex-row'}`}>

            {/* CONTENT SIDE */}
            <div className={`
                flex-1 flex flex-col gap-1 
                ${isRightSide ? 'items-start md:items-start text-left md:text-left pl-3 md:pl-10' : 'items-end md:items-end text-right md:text-right pr-3 md:pr-10'}
            `}>
                {/* Label Badge */}
                <div className={`
                    text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded
                    ${bgClass} ${colorClass} bg-opacity-50
                `}>
                    {label}
                </div>

                {/* Player Name / Main Text */}
                <div className="text-sm md:text-base font-bold text-gray-800 leading-tight">
                    {getEventText(incident, label)}
                </div>

                {/* Sub-info (Assist, Substitution, etc.) */}
                {incident.type === EVENT_TYPES.SUBSTITUTION ? (
                    <div className={`text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 ${isRightSide ? '' : 'justify-end'}`}>
                        <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                            <span className="text-red-500 text-[8px]">⬇</span>
                        </div>
                        {incident.out_player_name || 'Çıkan Oyuncu'}
                    </div>
                ) : incident.assist1_name ? (
                    <div className="text-xs text-gray-400 font-medium">
                        asist: <span className="text-gray-600 font-semibold">{incident.assist1_name}</span>
                    </div>
                ) : null}

                {/* Score Badge if Goal */}
                {showScore && incident.home_score !== undefined && (
                    <div className={`mt-1.5 ${isRightSide ? 'self-start' : 'self-end'}`}>
                        <div className="bg-gray-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md tracking-wider font-mono">
                            {incident.home_score} - {incident.away_score}
                        </div>
                    </div>
                )}
            </div>

            {/* CENTER AXIS ICON */}
            <div className="relative z-10 shrink-0 flex items-center justify-center w-12 md:w-16">
                {/* Minute Marker */}
                <div className="absolute -top-6 md:-top-7 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-black text-gray-300">
                    {incident.time}'
                </div>

                {/* Icon Circle */}
                <div className={`
                    w-10 h-10 md:w-12 md:h-12 rounded-full border-4 ${bgClass} ${borderClass}
                    flex items-center justify-center shadow-sm transition-transform hover:scale-110 duration-200 cursor-default
                `}>
                    <Icon
                        size={20}
                        weight={iconWeight as any || 'duotone'}
                        className={colorClass}
                    />
                </div>
            </div>

            {/* SPACER FOR OTHER SIDE (Desktop Only) */}
            <div className="flex-1 hidden md:block"></div>
        </div>
    );
}
