/**
 * Match Trend Chart Component
 * 
 * Displays offensive intensity trend visualization for home and away teams
 * Based on /match/trend/detail endpoint data
 */

interface TrendPoint {
    minute: number;
    home_value: number;  // Positive for home
    away_value: number;  // Negative for away
}

interface MatchTrendData {
    match_id?: string;
    first_half?: TrendPoint[];
    second_half?: TrendPoint[];
    overtime?: TrendPoint[];
}

interface MatchTrendChartProps {
    data: MatchTrendData | null;
    homeTeamName?: string;
    awayTeamName?: string;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
}

export function MatchTrendChart({ data, homeTeamName = 'Ev Sahibi', awayTeamName = 'Deplasman', homeTeamLogo, awayTeamLogo }: MatchTrendChartProps) {
    // Handle API response format: data can be MatchTrendData directly or wrapped in results
    let trendData: MatchTrendData | null = null;
    if (data) {
        // If data has results property (API response wrapper)
        if ((data as any).results) {
            const results = (data as any).results;
            // results can be single object or array
            const extracted = Array.isArray(results) ? results[0] : results;
            // Only use if it has actual data (not empty object)
            if (extracted && (
                (extracted.first_half && extracted.first_half.length > 0) || 
                (extracted.second_half && extracted.second_half.length > 0) || 
                (extracted.overtime && extracted.overtime.length > 0)
            )) {
                trendData = extracted;
            }
        } else {
            // Direct MatchTrendData - check if it has data
            const direct = data as MatchTrendData;
            if (direct && (
                (direct.first_half && direct.first_half.length > 0) || 
                (direct.second_half && direct.second_half.length > 0) || 
                (direct.overtime && direct.overtime.length > 0)
            )) {
                trendData = direct;
            }
        }
    }

    if (!trendData || (!trendData.first_half?.length && !trendData.second_half?.length)) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
            }}>
                Trend verisi bulunamadı
            </div>
        );
    }

    // Combine all halves
    const firstHalf = trendData.first_half || [];
    const secondHalf = trendData.second_half || [];
    const overtime = trendData.overtime || [];
    
    // Combine all points with half indicators
    const allPoints: (TrendPoint & { half: 'first' | 'second' | 'overtime' })[] = [
        ...firstHalf.map(p => ({ ...p, half: 'first' as const })),
        ...secondHalf.map(p => ({ ...p, half: 'second' as const })),
        ...overtime.map(p => ({ ...p, half: 'overtime' as const }))
    ];

    if (allPoints.length === 0) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6b7280',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
            }}>
                Trend verisi bulunamadı
            </div>
        );
    }

    // Find max absolute values for scaling
    const maxHomeValue = Math.max(...allPoints.map(p => Math.abs(p.home_value || 0)), 1);
    const maxAwayValue = Math.max(...allPoints.map(p => Math.abs(p.away_value || 0)), 1);
    const maxValue = Math.max(maxHomeValue, maxAwayValue, 50); // Minimum scale of 50

    // Chart dimensions
    const chartWidth = 1000;
    const chartHeight = 400;
    const logoAreaWidth = 140;
    const padding = { top: 20, right: 20, bottom: 60, left: 20 };
    const plotWidth = chartWidth - padding.left - padding.right - logoAreaWidth;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const centerY = padding.top + plotHeight / 2;
    const plotStartX = padding.left + logoAreaWidth;

    // Scale factors - Bar chart: each minute gets a bar
    const barWidth = plotWidth / Math.max(allPoints.length, 1);
    const scaleY = plotHeight / 2 / maxValue;

    const maxMinute = allPoints[allPoints.length - 1]?.minute || 90;

    // Find HT position (after first half ends)
    const htIndex = firstHalf.length > 0 ? firstHalf.length : 0;
    const htPosition = htIndex * barWidth;

    return (
        <div style={{
            backgroundColor: '#1f2937',
            borderRadius: '12px',
            padding: '0',
            overflowX: 'auto'
        }}>
            <div style={{ position: 'relative', width: chartWidth, height: chartHeight }}>
                {/* Logo Area - Left Side */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: logoAreaWidth,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px 12px'
                }}>
                    {/* Home Team Logo & Name */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        {homeTeamLogo && (
                            <img
                                src={homeTeamLogo}
                                alt={homeTeamName}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    objectFit: 'contain'
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        )}
                        <div style={{
                            color: '#10b981',
                            fontSize: '12px',
                            fontWeight: '600',
                            textAlign: 'center',
                            lineHeight: '1.2'
                        }}>
                            {homeTeamName}
                        </div>
                    </div>

                    {/* Away Team Logo & Name */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        {awayTeamLogo && (
                            <img
                                src={awayTeamLogo}
                                alt={awayTeamName}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    objectFit: 'contain'
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        )}
                        <div style={{
                            color: '#8b5cf6',
                            fontSize: '12px',
                            fontWeight: '600',
                            textAlign: 'center',
                            lineHeight: '1.2'
                        }}>
                            {awayTeamName}
                        </div>
                    </div>
                </div>

                {/* Chart SVG */}
                <svg
                    width={chartWidth}
                    height={chartHeight}
                    style={{ display: 'block' }}
                >
                    {/* Home team background (top half) */}
                    <rect
                        x={plotStartX}
                        y={padding.top}
                        width={plotWidth}
                        height={plotHeight / 2}
                        fill="rgba(16, 185, 129, 0.1)"
                    />

                    {/* Away team background (bottom half) */}
                    <rect
                        x={plotStartX}
                        y={centerY}
                        width={plotWidth}
                        height={plotHeight / 2}
                        fill="rgba(139, 92, 246, 0.1)"
                    />

                    {/* Center line (neutral line) */}
                    <line
                        x1={plotStartX}
                        y1={centerY}
                        x2={plotStartX + plotWidth}
                        y2={centerY}
                        stroke="rgba(255, 255, 255, 0.2)"
                        strokeWidth="1"
                    />

                    {/* HT marker (vertical line) */}
                    {htPosition > 0 && (
                        <line
                            x1={plotStartX + htPosition}
                            y1={padding.top}
                            x2={plotStartX + htPosition}
                            y2={padding.top + plotHeight}
                            stroke="rgba(255, 255, 255, 0.3)"
                            strokeWidth="2"
                        />
                    )}

                    {/* Bars for each minute */}
                    {allPoints.map((point, index) => {
                        const barSpacing = 2; // Space between bars
                        const actualBarWidth = barWidth - barSpacing;
                        const x = plotStartX + index * barWidth + barSpacing / 2;
                        const homeBarHeight = (point.home_value || 0) * scaleY;
                        const awayBarHeight = (point.away_value || 0) * scaleY;
                        
                        return (
                            <g key={index}>
                                {/* Home team bar (upward, green) */}
                                {homeBarHeight > 0 && (
                                    <rect
                                        x={x}
                                        y={centerY - homeBarHeight}
                                        width={actualBarWidth}
                                        height={homeBarHeight}
                                        fill="#10b981"
                                        rx="1"
                                    />
                                )}
                                
                                {/* Away team bar (downward, purple) */}
                                {awayBarHeight > 0 && (
                                    <rect
                                        x={x}
                                        y={centerY}
                                        width={actualBarWidth}
                                        height={awayBarHeight}
                                        fill="#8b5cf6"
                                        rx="1"
                                    />
                                )}
                            </g>
                        );
                    })}

                    {/* Time markers on bottom */}
                    {[0, 15, 30, 45, 60, 75, 90].filter(m => m <= maxMinute).map((minute) => {
                        const point = allPoints.find(p => p.minute === minute);
                        if (!point) return null;
                        const index = allPoints.indexOf(point);
                        const x = plotStartX + index * barWidth + barWidth / 2;
                        const label = minute === 45 ? 'HT' : minute === 90 ? 'FT' : `${minute}'`;
                        
                        return (
                            <g key={minute}>
                                <line
                                    x1={x}
                                    y1={padding.top + plotHeight}
                                    x2={x}
                                    y2={padding.top + plotHeight + 5}
                                    stroke="rgba(255, 255, 255, 0.4)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={x}
                                    y={padding.top + plotHeight + 20}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fill="rgba(255, 255, 255, 0.7)"
                                >
                                    {label}
                                </text>
                            </g>
                        );
                    })}

                    {/* HT label */}
                    {htPosition > 0 && (
                        <text
                            x={plotStartX + htPosition}
                            y={padding.top - 5}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="600"
                            fill="rgba(255, 255, 255, 0.7)"
                        >
                            HT
                        </text>
                    )}

                    {/* FT label */}
                    <text
                        x={plotStartX + plotWidth}
                        y={padding.top - 5}
                        textAnchor="end"
                        fontSize="11"
                        fontWeight="600"
                        fill="rgba(255, 255, 255, 0.7)"
                    >
                        FT
                    </text>
                </svg>
            </div>
        </div>
    );
}

