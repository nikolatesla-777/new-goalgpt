/**
 * Premium Match Trend Chart Component (Bar Chart / Equalizer Style)
 * 
 * Displays offensive intensity "Pressure" trend visualization using a Mirror Bar Chart.
 * Features:
 * - Individual Bars for each minute (Equalizer look)
 * - Vertical SVG Gradients for visual depth
 * - Interactive Cursor & Tooltip
 * - Match Event Overlays (Goals, Cards)
 */

import { useMemo, useState, useRef, useEffect } from 'react';

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
    const padding = { top: 40, bottom: 40, left: 10, right: 10 };
    const plotHeight = height - padding.top - padding.bottom;
    const centerY = padding.top + plotHeight / 2;
    // X Scale: 0 to 90+ minutes
    const maxMinute = Math.max(90, trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].minute : 90);
    const pixelsPerMinute = (chartWidth - padding.left - padding.right) / maxMinute;

    // Bar dimensions
    const barWidth = Math.max(2, pixelsPerMinute * 0.7); // 70% of minute width, min 2px

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

    // Filter Important Events
    const significantEvents = useMemo(() => {
        // Filter goals and red cards
        return incidents.filter(inc => {
            // Check both potentially property structures
            const type = inc.type || inc.incident_type;
            // 1: Goal, 3: Yellow, 4: Red, 8: Pen Goal, etc.
            // Adjust based on your API types
            return [1, 4, 8, 9, 3].includes(type);
        }).map(inc => ({
            ...inc,
            x: padding.left + (inc.minute || 0) * pixelsPerMinute,
            team: inc.position === 1 ? 'home' : 'away', // 1=Home, 2=Away usually
            typeId: inc.type || inc.incident_type
        }));
    }, [incidents, pixelsPerMinute, padding.left]);

    // Handle Mouse Move
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - padding.left;
        const minute = Math.min(Math.max(0, Math.round(x / pixelsPerMinute)), maxMinute);

        setHoveredMinute(minute);
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
                    {/* Vertical Gradients for Bars */}
                    <linearGradient id="gradHomeBar" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="gradAwayBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
                    </linearGradient>

                    {/* Glow Filter */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Center Axis */}
                <line
                    x1={padding.left}
                    y1={centerY}
                    x2={chartWidth - padding.right}
                    y2={centerY}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                />

                {/* Render Bars */}
                {trendPoints.map((point) => {
                    const x = padding.left + point.minute * pixelsPerMinute - (barWidth / 2); // Center on minute tick
                    const homeHeight = scaleY(point.home_value);
                    const awayHeight = scaleY(Math.abs(point.away_value));

                    // Highlight hovered bar
                    const isHovered = hoveredMinute === point.minute;
                    const opacity = hoveredMinute !== null && !isHovered ? 0.4 : 0.9;
                    const filter = isHovered ? 'url(#glow)' : undefined;

                    return (
                        <g key={point.minute} opacity={opacity}>
                            {/* Home Bar (Upwards) */}
                            {homeHeight > 1 && (
                                <rect
                                    x={x}
                                    y={centerY - homeHeight}
                                    width={barWidth}
                                    height={homeHeight}
                                    fill="url(#gradHomeBar)"
                                    rx={2}
                                    filter={filter}
                                />
                            )}

                            {/* Away Bar (Downwards) */}
                            {awayHeight > 1 && (
                                <rect
                                    x={x}
                                    y={centerY}
                                    width={barWidth}
                                    height={awayHeight}
                                    fill="url(#gradAwayBar)"
                                    rx={2}
                                    filter={filter}
                                />
                            )}
                        </g>
                    );
                })}

                {/* Time Markers (X Axis) */}
                {[0, 15, 30, 45, 60, 75, 90].map(min => (
                    <g key={min} transform={`translate(${padding.left + min * pixelsPerMinute}, ${height - 15})`}>
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

                {/* Current Minute Line (if live) */}
                {currentMinute && currentMinute <= maxMinute && (
                    <line
                        x1={padding.left + currentMinute * pixelsPerMinute}
                        y1={padding.top}
                        x2={padding.left + currentMinute * pixelsPerMinute}
                        y2={height - padding.bottom}
                        stroke="#ef4444"
                        strokeWidth="1"
                        strokeDasharray="4 2"
                        opacity="0.6"
                    />
                )}
            </svg>

            {/* Tooltip */}
            {hoveredMinute !== null && hoveredData && (
                <div
                    className="absolute z-20 pointer-events-none bg-slate-800/95 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-xl transform -translate-x-1/2 -translate-y-full"
                    style={{
                        left: padding.left + hoveredMinute * pixelsPerMinute,
                        top: centerY - 40, // Float above center line
                        minWidth: '140px'
                    }}
                >
                    {/* Triangle Arrow */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-slate-800 rotate-45 border-r border-b border-slate-700"></div>

                    <div className="text-center text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 flex justify-between">
                        <span>Dakika {hoveredMinute}'</span>
                        {/* Show if it's a Goal/Card minute? Optional */}
                    </div>
                    <div className="flex justify-between items-center gap-4 relative z-10">
                        <div className="text-center">
                            <div className="text-emerald-400 font-bold text-xl drop-shadow-sm">{hoveredData.home_value.toFixed(1)}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">EV</div>
                        </div>
                        <div className="w-px h-8 bg-gray-700"></div>
                        <div className="text-center">
                            <div className="text-blue-400 font-bold text-xl drop-shadow-sm">{Math.abs(hoveredData.away_value).toFixed(1)}</div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">DEP</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
