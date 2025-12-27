/**
 * Match Trend Chart Component
 * 
 * Displays offensive intensity trend visualization for home and away teams
 * Design: Minimal Flat UI/UX (Dark Theme)
 * Features:
 * - Home momentum (Top, Green)
 * - Away momentum (Bottom, Blue)
 * - Event overlays (Goals, Cards) on the timeline
 */

import { useMemo } from 'react';

// Types for Trend Data
interface TrendPoint {
    minute: number;
    home_value: number;
    away_value: number;
}

interface MatchTrendData {
    match_id?: string;
    first_half?: TrendPoint[];
    second_half?: TrendPoint[];
    overtime?: TrendPoint[];
}

// Types for Incidents (Events)
export interface Incident {
    type: number;      // 1:Goal, 2:Corner, 3:Yellow Card, 4:Red Card, etc.
    position: number;  // 1:Home, 2:Away
    time: number;      // Minute
    player_name?: string;
}

interface MatchTrendChartProps {
    data: MatchTrendData | null;
    incidents?: Incident[];
    homeTeamName?: string;
    awayTeamName?: string;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
}

export function MatchTrendChart({
    data,
    incidents = [],
    homeTeamName = 'Ev Sahibi',
    awayTeamName = 'Deplasman',
    homeTeamLogo,
    awayTeamLogo
}: MatchTrendChartProps) {

    // Process trend data
    const trendData = useMemo(() => {
        if (!data) return null;
        const raw = (data as any).results ?
            (Array.isArray((data as any).results) ? (data as any).results[0] : (data as any).results) :
            data;

        if (!raw || (!raw.first_half?.length && !raw.second_half?.length)) return null;
        return raw as MatchTrendData;
    }, [data]);

    if (!trendData) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-[#111214] rounded-lg border border-gray-800/50 text-gray-500">
                <span className="text-xl mb-2">📉</span>
                <span className="text-xs font-medium">Trend verisi mevcut değil</span>
            </div>
        );
    }

    // Combine points
    const allPoints = [
        ...(trendData.first_half || []),
        ...(trendData.second_half || []).map(p => ({ ...p })),
        ...(trendData.overtime || [])
    ];

    if (allPoints.length === 0) return null;

    // SCALING & CONSTANTS
    const dataMax = Math.max(...allPoints.map(p => Math.max(p.home_value, p.away_value)));
    const MAX_SCALE = Math.max(dataMax, 80);

    const CHART_HEIGHT = 200;
    const CHART_WIDTH = 1000;
    const PADDING_X = 40;
    const PADDING_Y = 12;
    const DRAW_HEIGHT = (CHART_HEIGHT - (PADDING_Y * 2)) / 2;
    const CENTER_Y = CHART_HEIGHT / 2;

    const maxMinute = Math.max(90, allPoints[allPoints.length - 1]?.minute || 90);
    const stepX = (CHART_WIDTH - (PADDING_X * 2)) / maxMinute;

    // Helper: Incident Icons
    const getEventIcon = (type: number) => {
        switch (type) {
            case 1: return '⚽'; // Goal
            case 2: return '🚩'; // Corner
            case 3: return '🟨'; // Yellow
            case 4: return '🟥'; // Red
            default: return null;
        }
    };

    const relevantIncidents = incidents.filter(i => [1, 2, 3, 4].includes(i.type));

    return (
        <div className="w-full bg-[#111214] rounded-lg border border-gray-800/50 overflow-hidden">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/30">
                {/* Home Team */}
                <div className="flex items-center gap-2 w-1/3 min-w-0">
                    {homeTeamLogo ? (
                        <div className="w-5 h-5 rounded-full bg-gray-800/50 p-0.5 flex-shrink-0">
                            <img src={homeTeamLogo} alt={homeTeamName} className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-800/50 flex-shrink-0" />
                    )}
                    <span className="text-white font-medium text-xs truncate">{homeTeamName}</span>
                </div>

                {/* Center Badge */}
                <div className="flex flex-col items-center justify-center w-1/3 flex-shrink-0">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Maç İvmesi</span>
                </div>

                {/* Away Team */}
                <div className="flex items-center justify-end gap-2 w-1/3 min-w-0">
                    <span className="text-white font-medium text-xs truncate text-right">{awayTeamName}</span>
                    {awayTeamLogo ? (
                        <div className="w-5 h-5 rounded-full bg-gray-800/50 p-0.5 flex-shrink-0">
                            <img src={awayTeamLogo} alt={awayTeamName} className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-800/50 flex-shrink-0" />
                    )}
                </div>
            </div>

            {/* Chart Container */}
            <div className="relative w-full overflow-hidden" style={{ minHeight: '220px' }}>
                {/* Scrollable Area */}
                <div className="overflow-x-auto w-full h-full no-scrollbar">
                    <div className="min-w-[800px] h-full p-3">
                        <svg
                            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                            preserveAspectRatio="none"
                            className="w-full h-full select-none"
                        >
                            <defs>
                                {/* Soft Flat Gradients */}
                                <linearGradient id="flatHome" x1="0" y1="1" x2="0" y2="0">
                                    <stop offset="0%" stopColor="#22c55e" stopOpacity="1.0" />
                                    <stop offset="100%" stopColor="#4ade80" stopOpacity="0.8" />
                                </linearGradient>
                                <linearGradient id="flatAway" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="1.0" />
                                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
                                </linearGradient>
                            </defs>

                            {/* Center Baseline */}
                            <line
                                x1={PADDING_X} y1={CENTER_Y}
                                x2={CHART_WIDTH - PADDING_X} y2={CENTER_Y}
                                stroke="#27272a" strokeWidth="0.5"
                            />

                            {/* HT Line */}
                            <line
                                x1={PADDING_X + 45 * stepX} y1={PADDING_Y}
                                x2={PADDING_X + 45 * stepX} y2={CHART_HEIGHT - PADDING_Y - 15}
                                stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2 2"
                            />
                            <text x={PADDING_X + 45 * stepX} y={PADDING_Y - 3} textAnchor="middle" fill="#52525b" fontSize="9" fontWeight="500">HT</text>

                            {/* BARS */}
                            {allPoints.map((p, i) => {
                                const x = PADDING_X + p.minute * stepX;
                                const homeH = Math.max(0, Math.min((p.home_value / MAX_SCALE) * DRAW_HEIGHT, DRAW_HEIGHT));
                                const awayH = Math.max(0, Math.min((p.away_value / MAX_SCALE) * DRAW_HEIGHT, DRAW_HEIGHT));
                                const barW = Math.max(stepX * 0.65, 2.5); // Thinner, more minimal bars

                                return (
                                    <g key={i}>
                                        {/* Home Bar */}
                                        {homeH > 0 && (
                                            <rect
                                                x={x - barW / 2}
                                                y={CENTER_Y - homeH}
                                                width={barW}
                                                height={homeH}
                                                fill="url(#flatHome)"
                                                rx="1"
                                            />
                                        )}
                                        {/* Away Bar */}
                                        {awayH > 0 && (
                                            <rect
                                                x={x - barW / 2}
                                                y={CENTER_Y}
                                                width={barW}
                                                height={awayH}
                                                fill="url(#flatAway)"
                                                rx="1"
                                            />
                                        )}
                                    </g>
                                );
                            })}

                            {/* EVENTS OVERLAY */}
                            {relevantIncidents.map((ev, idx) => {
                                const minute = Math.min(ev.time, maxMinute);
                                const icon = getEventIcon(ev.type);
                                if (!icon) return null;

                                const x = PADDING_X + minute * stepX;
                                const isHome = ev.position === 1;

                                const y = isHome ? PADDING_Y + 8 : CHART_HEIGHT - PADDING_Y - 20;

                                return (
                                    <g key={`ev-${idx}`}>
                                        <line
                                            x1={x} y1={CENTER_Y}
                                            x2={x} y2={isHome ? y + 10 : y - 10}
                                            stroke={isHome ? '#22c55e' : '#3b82f6'}
                                            strokeWidth="1"
                                            strokeOpacity="0.3"
                                            strokeDasharray="2 2"
                                        />
                                        <circle
                                            cx={x} cy={y} r="7"
                                            fill="#18181b"
                                            stroke={isHome ? '#22c55e' : '#3b82f6'} strokeWidth="1"
                                        />
                                        <text
                                            x={x} y={y} dy="2.5"
                                            textAnchor="middle"
                                            fontSize="9"
                                        >
                                            {icon}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* TIMELINE LABELS */}
                            {[0, 15, 30, 45, 60, 75, 90].map(m => (
                                <text
                                    key={m}
                                    x={PADDING_X + m * stepX}
                                    y={CHART_HEIGHT - 3}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill="#52525b"
                                    fontWeight="400"
                                >
                                    {m}'
                                </text>
                            ))}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Flat Footer Legend */}
            <div className="flex items-center justify-center gap-6 py-2 bg-gray-900/30 border-t border-gray-800/30">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm bg-green-500"></div>
                    <span className="text-[10px] text-gray-400">Ev Sahibi</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm bg-blue-500"></div>
                    <span className="text-[10px] text-gray-400">Deplasman</span>
                </div>
                <div className="w-px h-2.5 bg-gray-800/50"></div>
                <div className="flex items-center gap-2.5 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">⚽</span>
                    <span className="flex items-center gap-1">🚩</span>
                    <span className="flex items-center gap-1">🟨</span>
                </div>
            </div>
        </div>
    );
}
