/**
 * Premium Match Trend Chart Component (Bar Chart / Equalizer Style)
 * 
 * Displays offensive intensity "Pressure" trend visualization using a Mirror Bar Chart.
 * Features:
 * - Individual Bars for each minute (Equalizer look)
 * - Vertical SVG Gradients for visual depth
 * - Interactive Cursor & Tooltip
 * - Match Event Overlays (Goals, Cards)
 * - Responsive SVG (viewBox scaling)
 */

import { useMemo, useState, useRef } from 'react';

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

    // Logical Dimensions for SVG Coordinate System
    const LOGICAL_WIDTH = 1000;
    const HEIGHT = 280;
    const PADDING = { top: 40, bottom: 40, left: 20, right: 20 };
    const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
    const CENTER_Y = PADDING.top + PLOT_HEIGHT / 2;

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

    // X Scale: Always Map 0..MaxMinute to LOGICAL_WIDTH
    // If Overtime exists (minute > 95), scale extends. Otherwise defaults to 90.
    const maxMinute = useMemo(() => {
        const lastDataMinute = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].minute : 0;
        // If current minute > 90, we might need to extend
        const effectiveMax = Math.max(90, lastDataMinute, currentMinute || 0);
        // Add a buffer if we are close to the edge? No, strict fit requested.
        return effectiveMax;
    }, [trendPoints, currentMinute]);

    const pixelsPerMinute = (LOGICAL_WIDTH - PADDING.left - PADDING.right) / maxMinute;

    // Bar dimensions - slightly thicker for better "Equalizer" look in 1000px width
    const barWidth = Math.max(4, pixelsPerMinute * 0.6);

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
        return (val / maxPressure) * (PLOT_HEIGHT / 2);
    };

    // Filter Important Events
    const significantEvents = useMemo(() => {
        return incidents.filter(inc => {
            const type = inc.type || inc.incident_type;
            // 1: Goal, 3: Yellow, 4: Red, 8: Pen Goal, etc.
            return [1, 4, 8, 9, 3].includes(type);
        }).map(inc => ({
            ...inc,
            x: PADDING.left + (inc.minute || 0) * pixelsPerMinute,
            team: inc.position === 1 ? 'home' : 'away',
            typeId: inc.type || inc.incident_type
        }));
    }, [incidents, pixelsPerMinute, PADDING.left]);

    // Handle Mouse Move - use getBoundingClientRect to map DOM pixels to SVG coordinates
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        // 1. Get mouse X relative to container (DOM pixels)
        const domX = e.clientX - rect.left;

        // 2. Scale DOM X to SVG Logical Coordinate X
        const scaleFactor = LOGICAL_WIDTH / rect.width;
        const svgX = domX * scaleFactor;

        // 3. Subtract padding to get 'plot X'
        const plotX = svgX - PADDING.left;

        // 4. Convert plot X to minute
        const minute = Math.min(Math.max(0, Math.round(plotX / pixelsPerMinute)), maxMinute);

        setHoveredMinute(minute);
    };

    const handleMouseLeave = () => {
        setHoveredMinute(null);
    };

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
            style={{
                // Aspect ratio trick or just let SVG control height?
                // SVG viewBox preserves aspect ratio.
                position: 'relative'
            }}
        >
            {/* Header: Logos & Titles - Absolute positioned over SVG */}
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

            {/* SVG Chart with viewBox for responsiveness */}
            <svg
                viewBox={`0 0 ${LOGICAL_WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none" // Stretch to fill width
                className="block w-full h-full"
                style={{ maxHeight: '280px' }} // Constrain huge height on mobile, but let width flow
            >
                <defs>
                    <linearGradient id="gradHomeBar" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="gradAwayBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Center Axis */}
                <line
                    x1={PADDING.left}
                    y1={CENTER_Y}
                    x2={LOGICAL_WIDTH - PADDING.right}
                    y2={CENTER_Y}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                />

                {/* Render Bars */}
                {trendPoints.map((point) => {
                    const x = PADDING.left + point.minute * pixelsPerMinute - (barWidth / 2);
                    const homeHeight = scaleY(point.home_value);
                    const awayHeight = scaleY(Math.abs(point.away_value));

                    const isHovered = hoveredMinute === point.minute;
                    const opacity = hoveredMinute !== null && !isHovered ? 0.4 : 0.9;
                    const filter = isHovered ? 'url(#glow)' : undefined;

                    return (
                        <g key={point.minute} opacity={opacity}>
                            {homeHeight > 1 && (
                                <rect
                                    x={x}
                                    y={CENTER_Y - homeHeight}
                                    width={barWidth}
                                    height={homeHeight}
                                    fill="url(#gradHomeBar)"
                                    rx={2}
                                    filter={filter}
                                />
                            )}
                            {awayHeight > 1 && (
                                <rect
                                    x={x}
                                    y={CENTER_Y}
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

                {/* Time Markers - Simplified 0 - 45 - 90 */}
                {[0, 45, 90].map(min => {
                    // Only show if within logical bounds (e.g. 90 tick might be weird if max is 120, but usually fine)
                    if (min > maxMinute) return null;
                    return (
                        <g key={min} transform={`translate(${PADDING.left + min * pixelsPerMinute}, ${HEIGHT - 10})`}>
                            <text
                                fill="#94a3b8"
                                fontSize="12"
                                fontWeight="bold"
                                textAnchor="middle"
                            >
                                {min}'
                            </text>
                            {/* Little tick mark */}
                            <line y1={-5} y2={-15} stroke="#334155" strokeWidth="1" />
                        </g>
                    );
                })}

                {/* Events */}
                {significantEvents.map((ev, idx) => {
                    const yPos = ev.team === 'home' ? CENTER_Y - 30 : CENTER_Y + 30; // moved further out
                    const color = ev.team === 'home' ? '#10b981' : '#3b82f6';
                    return (
                        <g key={idx}>
                            <line
                                x1={ev.x} y1={CENTER_Y} x2={ev.x} y2={yPos}
                                stroke={color}
                                strokeWidth="1"
                                strokeOpacity="0.6"
                                strokeDasharray="3 3"
                            />
                            <circle cx={ev.x} cy={yPos} r="10" fill="#0f172a" stroke={color} strokeWidth="1.5" />
                            {(ev.typeId === 1 || ev.typeId === 8) && (
                                <text x={ev.x} y={yPos} dy="3" textAnchor="middle" fontSize="12">⚽</text>
                            )}
                            {ev.typeId === 4 && (
                                <rect x={ev.x - 3} y={yPos - 4} width="6" height="8" fill="#ef4444" rx="1" />
                            )}
                            {ev.typeId === 3 && (
                                <rect x={ev.x - 3} y={yPos - 4} width="6" height="8" fill="#eab308" rx="1" />
                            )}
                        </g>
                    );
                })}

                {/* Current Minute Line */}
                {currentMinute && currentMinute <= maxMinute && (
                    <g>
                        <line
                            x1={PADDING.left + currentMinute * pixelsPerMinute}
                            y1={PADDING.top}
                            x2={PADDING.left + currentMinute * pixelsPerMinute}
                            y2={HEIGHT - PADDING.bottom}
                            stroke="#ef4444"
                            strokeWidth="1.5"
                            strokeDasharray="4 2"
                            opacity="0.8"
                        />
                        {/* Current Time Badge at bottom */}
                        {/* <rect 
                            x={PADDING.left + currentMinute * pixelsPerMinute - 12} 
                            y={HEIGHT - 25} 
                            width="24" 
                            height="16" 
                            rx="4" 
                            fill="#ef4444" 
                        />
                        <text 
                            x={PADDING.left + currentMinute * pixelsPerMinute} 
                            y={HEIGHT - 13} 
                            textAnchor="middle" 
                            fill="white" 
                            fontSize="10" 
                            fontWeight="bold"
                        >
                            {currentMinute}'
                        </text> */}
                    </g>
                )}
            </svg>

            {/* Tooltip */}
            {hoveredMinute !== null && hoveredData && (
                <div
                    className="absolute z-30 pointer-events-none"
                    style={{
                        left: `${(PADDING.left + hoveredMinute * pixelsPerMinute) / LOGICAL_WIDTH * 100}%`, // Percent positioning
                        top: '50%', // Centered Y roughly, or specific calculation
                        transform: 'translate(-50%, -100%) translateY(-20px)'
                    }}
                >
                    <div className="bg-slate-800/95 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-xl min-w-[140px]">
                        {/* Triangle Arrow */}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-slate-800 rotate-45 border-r border-b border-slate-700"></div>

                        <div className="text-center text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1">
                            Dakika {hoveredMinute}'
                        </div>
                        <div className="flex justify-between items-center gap-4">
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
                </div>
            )}
        </div>
    );
}
