/**
 * Premium Match Trend Chart Component
 * 
 * Displays offensive intensity "Pressure" trend visualization using a Mirror Area Chart.
 * Features:
 * - Smooth Bezier Curve interpolation
 * - SVG Gradients for visual depth
 * - Interactive Cursor & Tooltip
 * - Match Event Overlays (Goals, Cards)
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { SoccerBall } from '@phosphor-icons/react';

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

interface MatchTrendChartProps {
    data: MatchTrendData | null;
    incidents?: any[]; // Goal, Card, etc.
    homeTeamName?: string;
    awayTeamName?: string;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
    currentMinute?: number | null;
}

// Helper: Catmull-Rom to Cubic Bezier conversion for smooth curves
// Calculates control points for a smooth path through points
const getControlPoints = (p0: number[], p1: number[], p2: number[], t: number = 0.2) => {
    const d1 = Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2));
    const d2 = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
    const fa = t * d1 / (d1 + d2);
    const fb = t * d2 / (d1 + d2);
    const p1x = p1[0] - fa * (p2[0] - p0[0]);
    const p1y = p1[1] - fa * (p2[1] - p0[1]);
    const p2x = p1[0] + fb * (p2[0] - p0[0]);
    const p2y = p1[1] + fb * (p2[1] - p0[1]);
    return [p1x, p1y, p2x, p2y];
};

export function MatchTrendChart({
    data,
    incidents = [],
    homeTeamName = 'Ev Sahibi',
    awayTeamName = 'Deplasman',
    homeTeamLogo,
    awayTeamLogo,
    currentMinute = null
}: MatchTrendChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [chartWidth, setChartWidth] = useState(1000); // Default, updates on mount

    // Extract trend data
    const trendPoints = useMemo(() => {
        if (!data) return [];
        let rawData: MatchTrendData | null = null;

        // Handle API wrapper
        if ((data as any).results) {
            const results = (data as any).results;
            rawData = Array.isArray(results) ? results[0] : results;
        } else {
            rawData = data;
        }

        if (!rawData) return [];

        const firstHalf = (rawData.first_half || []).map(p => ({ ...p, half: 1 }));
        const secondHalf = (rawData.second_half || []).map(p => ({ ...p, half: 2 }));
        const overtime = (rawData.overtime || []).map(p => ({ ...p, half: 3 }));

        // Filter out extreme outliers or bad data
        const all = [...firstHalf, ...secondHalf, ...overtime].filter(p =>
            p.minute <= (currentMinute || 120) && (p.home_value !== undefined && p.away_value !== undefined)
        );

        // Sort by minute
        return all.sort((a, b) => a.minute - b.minute);
    }, [data, currentMinute]);

    // Update chart width on resize
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setChartWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Dimensions
    const height = 280;
    const padding = { top: 40, bottom: 40, left: 0, right: 0 };
    const plotHeight = height - padding.top - padding.bottom;
    const centerY = padding.top + plotHeight / 2;
    // X Scale: 0 to 90+ minutes
    const maxMinute = Math.max(90, trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].minute : 90);
    const pixelsPerMinute = chartWidth / maxMinute;

    // Y Scale: Normalize based on max pressure value
    const maxPressure = useMemo(() => {
        const max = Math.max(
            ...trendPoints.map(p => Math.abs(p.home_value)),
            ...trendPoints.map(p => Math.abs(p.away_value)),
            40 // Min scale
        );
        return max * 1.2; // Add headroom
    }, [trendPoints]);

    const scaleY = (val: number) => {
        return (val / maxPressure) * (plotHeight / 2);
    };

    // Generate Path Data for SVG
    const generateAreaPath = (team: 'home' | 'away') => {
        if (trendPoints.length === 0) return '';

        const points: [number, number][] = trendPoints.map(p => {
            const x = p.minute * pixelsPerMinute;
            const val = team === 'home' ? p.home_value : p.away_value;
            // Home goes UP (negative Y relative to center), Away goes DOWN (positive Y relative to center)
            const yOffset = scaleY(val);
            const y = team === 'home' ? centerY - yOffset : centerY + yOffset;
            return [x, y];
        });

        // Start at center Y
        let d = `M ${points[0][0]} ${centerY}`;

        // Curve to first point
        d += ` L ${points[0][0]} ${points[0][1]}`;

        // Smooth curves between points
        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];

            // Simple smoothing: use midpoint control points for now or catmull-rom
            const midX = (current[0] + next[0]) / 2;
            d += ` C ${midX} ${current[1]}, ${midX} ${next[1]}, ${next[0]} ${next[1]}`;
        }

        // Close path to center Y at end X
        const lastX = points[points.length - 1][0];
        d += ` L ${lastX} ${centerY}`;

        // Close back to start (optional, but good for fill)
        d += ` L ${points[0][0]} ${centerY} Z`;

        return d;
    };

    // Generate Line Path (stroke only)
    const generateLinePath = (team: 'home' | 'away') => {
        if (trendPoints.length === 0) return '';
        const points: [number, number][] = trendPoints.map(p => {
            const x = p.minute * pixelsPerMinute;
            const val = team === 'home' ? p.home_value : p.away_value;
            const yOffset = scaleY(val);
            const y = team === 'home' ? centerY - yOffset : centerY + yOffset;
            return [x, y];
        });

        let d = `M ${points[0][0]} ${points[0][1]}`;

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const midX = (current[0] + next[0]) / 2;
            d += ` C ${midX} ${current[1]}, ${midX} ${next[1]}, ${next[0]} ${next[1]}`;
        }
        return d;
    };

    // Filter Important Events
    const significantEvents = useMemo(() => {
        // Filter goals and red cards
        return incidents.filter(inc => {
            const type = inc.type || inc.incident_type;
            // 1: Goal, 3: Yellow, 4: Red, 8: Pen Goal, etc.
            // Adjust based on your API types
            return [1, 4, 8, 9, 3].includes(type);
        }).map(inc => ({
            ...inc,
            x: (inc.minute || 0) * pixelsPerMinute,
            team: inc.position === 1 ? 'home' : 'away', // 1=Home, 2=Away usually
            typeId: inc.type || inc.incident_type
        }));
    }, [incidents, pixelsPerMinute]);

    // Handle Mouse Move
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const minute = Math.min(Math.max(0, Math.round(x / pixelsPerMinute)), maxMinute);

        setHoveredMinute(minute);
        setTooltipPos({ x, y: e.clientY - rect.top });
    };

    const handleMouseLeave = () => {
        setHoveredMinute(null);
    };

    // Get value for hovered minute
    const hoveredData = useMemo(() => {
        if (hoveredMinute === null) return null;
        return trendPoints.find(p => p.minute === hoveredMinute) || null;
    }, [hoveredMinute, trendPoints]);

    if (trendPoints.length === 0) {
        return (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100 text-gray-400">
                <p>Veri yok</p>
            </div>
        );
    }

    return (
        <div
            className="w-full bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 relative select-none"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ height: height }}
        >
            {/* Header: Logos & Titles */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
                {/* Home Team */}
                <div className="flex items-center gap-3">
                    {homeTeamLogo && (
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-20 rounded-full"></div>
                            <img src={homeTeamLogo} alt={homeTeamName} className="w-10 h-10 object-contain relative z-10" />
                        </div>
                    )}
                    <div>
                        <div className="text-xs text-emerald-400 font-bold tracking-wider uppercase">Ev Sahibi</div>
                        <div className="text-sm text-white font-bold opacity-90">{homeTeamName}</div>
                    </div>
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-3 flex-row-reverse text-right">
                    {awayTeamLogo && (
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 rounded-full"></div>
                            <img src={awayTeamLogo} alt={awayTeamName} className="w-10 h-10 object-contain relative z-10" />
                        </div>
                    )}
                    <div>
                        <div className="text-xs text-blue-400 font-bold tracking-wider uppercase">Deplasman</div>
                        <div className="text-sm text-white font-bold opacity-90">{awayTeamName}</div>
                    </div>
                </div>
            </div>

            {/* SVG Chart */}
            <svg width="100%" height="100%" className="block">
                <defs>
                    <linearGradient id="gradHome" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
                        <stop offset="100%" stopColor="rgba(16, 185, 129, 0.4)" />
                    </linearGradient>
                    <linearGradient id="gradAway" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59, 130, 246, 0.1)" />
                        <stop offset="100%" stopColor="rgba(59, 130, 246, 0.4)" />
                    </linearGradient>
                    {/* Glow Filter */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Center Axis */}
                <line x1="0" y1={centerY} x2="100%" y2={centerY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />

                {/* --- HOME TEAM (Top) --- */}
                <path
                    d={generateAreaPath('home')}
                    fill="url(#gradHome)"
                />
                <path
                    d={generateLinePath('home')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    filter="url(#glow)"
                    className="drop-shadow-lg"
                />

                {/* --- AWAY TEAM (Bottom) --- */}
                <path
                    d={generateAreaPath('away')}
                    fill="url(#gradAway)"
                />
                <path
                    d={generateLinePath('away')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    filter="url(#glow)"
                />

                {/* Time Markers (X Axis) */}
                {[0, 15, 30, 45, 60, 75, 90].map(min => (
                    <g key={min} transform={`translate(${min * pixelsPerMinute}, ${height - 15})`}>
                        <text fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="500">{min}'</text>
                    </g>
                ))}

                {/* Significant Events Markers */}
                {significantEvents.map((ev, idx) => {
                    // Position Y: Fixed offset from center based on home/away
                    // Home events above center, Away events below
                    const yPos = ev.team === 'home' ? centerY - 20 : centerY + 20;
                    const color = ev.team === 'home' ? '#10b981' : '#3b82f6';

                    return (
                        <g key={idx}>
                            {/* Vertical Line to Event */}
                            <line
                                x1={ev.x} y1={centerY} x2={ev.x} y2={yPos}
                                stroke={color}
                                strokeWidth="1"
                                strokeOpacity="0.5"
                                strokeDasharray="2 2"
                            />
                            {/* Icon Circle */}
                            <circle cx={ev.x} cy={yPos} r="8" fill="#1e293b" stroke={color} strokeWidth="1.5" />

                            {/* Icon Content */}
                            {/* Goal */}
                            {(ev.typeId === 1 || ev.typeId === 8) && (
                                <text x={ev.x} y={yPos} dy="3" textAnchor="middle" fontSize="10">⚽</text>
                            )}
                            {/* Red Card */}
                            {ev.typeId === 4 && (
                                <rect x={ev.x - 3} y={yPos - 4} width="6" height="8" fill="#ef4444" rx="1" />
                            )}
                            {/* Yellow Card */}
                            {ev.typeId === 3 && (
                                <rect x={ev.x - 3} y={yPos - 4} width="6" height="8" fill="#eab308" rx="1" />
                            )}
                        </g>
                    );
                })}

                {/* Interactive Cursor Line */}
                {hoveredMinute !== null && (
                    <line
                        x1={hoveredMinute * pixelsPerMinute}
                        y1={padding.top}
                        x2={hoveredMinute * pixelsPerMinute}
                        y2={height - padding.bottom}
                        stroke="white"
                        strokeWidth="1"
                        strokeOpacity="0.5"
                    />
                )}
            </svg>

            {/* Tooltip */}
            {hoveredMinute !== null && hoveredData && (
                <div
                    className="absolute z-20 pointer-events-none bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-xl transform -translate-x-1/2 -translate-y-full"
                    style={{
                        left: hoveredMinute * pixelsPerMinute,
                        top: centerY - 40, // Float above center line
                        minWidth: '140px'
                    }}
                >
                    <div className="text-center text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1">
                        Dakika {hoveredMinute}'
                    </div>
                    <div className="flex justify-between items-center gap-4">
                        <div className="text-center">
                            <div className="text-emerald-400 font-bold text-lg">{hoveredData.home_value}</div>
                            <div className="text-[10px] text-gray-500 uppercase">Ev Basıncı</div>
                        </div>
                        <div className="w-px h-8 bg-gray-700"></div>
                        <div className="text-center">
                            <div className="text-blue-400 font-bold text-lg">{Math.abs(hoveredData.away_value)}</div>
                            <div className="text-[10px] text-gray-500 uppercase">Dep Basıncı</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
