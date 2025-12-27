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
    currentMinute?: number | null; // Current match minute to limit trend data display
}

export function MatchTrendChart({ data, homeTeamName = 'Ev Sahibi', awayTeamName = 'Deplasman', currentMinute }: MatchTrendChartProps) {
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
    let allPoints: (TrendPoint & { half: 'first' | 'second' | 'overtime' })[] = [
        ...firstHalf.map(p => ({ ...p, half: 'first' as const })),
        ...secondHalf.map(p => ({ ...p, half: 'second' as const })),
        ...overtime.map(p => ({ ...p, half: 'overtime' as const }))
    ];

    // Filter trend data to current match minute if available
    // This ensures the graph only shows data up to the actual match minute
    if (currentMinute !== null && currentMinute !== undefined && currentMinute > 0) {
        allPoints = allPoints.filter(point => point.minute <= currentMinute);
    }

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
    const chartHeight = 300;
    const padding = { top: 60, right: 40, bottom: 60, left: 40 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const centerY = padding.top + plotHeight / 2;

    // Scale factors
    const scaleX = plotWidth / Math.max(allPoints.length - 1, 1);
    const scaleY = plotHeight / 2 / maxValue;

    const maxMinute = allPoints[allPoints.length - 1]?.minute || 90;
    
    // Add markers for key minutes
    const markerMinutes = [0, 15, 30, 45, 60, 75, 90];
    if (maxMinute > 90) markerMinutes.push(105, 120);
    markerMinutes.push(maxMinute);

    // Find HT position (after first half ends)
    const htPosition = firstHalf.length > 0 ? (firstHalf.length - 1) * scaleX : 0;
    const ftPosition = plotWidth;

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            overflowX: 'auto'
        }}>
            <h3 style={{
                margin: '0 0 24px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                textAlign: 'center'
            }}>
                Ofansif Trend
            </h3>

            <svg
                width={chartWidth}
                height={chartHeight}
                style={{ display: 'block', margin: '0 auto' }}
            >
                {/* Background */}
                <rect
                    x={padding.left}
                    y={padding.top}
                    width={plotWidth}
                    height={plotHeight}
                    fill="#f9fafb"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                />

                {/* Center line (neutral line) */}
                <line
                    x1={padding.left}
                    y1={centerY}
                    x2={padding.left + plotWidth}
                    y2={centerY}
                    stroke="#d1d5db"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                />

                {/* HT marker */}
                {htPosition > 0 && (
                    <line
                        x1={padding.left + htPosition}
                        y1={padding.top}
                        x2={padding.left + htPosition}
                        y2={padding.top + plotHeight}
                        stroke="#9ca3af"
                        strokeWidth="2"
                    />
                )}

                {/* FT marker */}
                <line
                    x1={padding.left + ftPosition}
                    y1={padding.top}
                    x2={padding.left + ftPosition}
                    y2={padding.top + plotHeight}
                    stroke="#9ca3af"
                    strokeWidth="2"
                />

                {/* Time markers on bottom */}
                {markerMinutes.filter((m, i, arr) => arr.indexOf(m) === i).map((minute) => {
                    const point = allPoints.find(p => p.minute === minute);
                    if (!point) return null;
                    const index = allPoints.indexOf(point);
                    const x = padding.left + index * scaleX;
                    const label = minute === 45 ? 'HT' : minute === 90 ? 'FT' : minute === maxMinute ? `${minute}'` : `${minute}'`;
                    
                    return (
                        <g key={minute}>
                            <line
                                x1={x}
                                y1={padding.top + plotHeight}
                                x2={x}
                                y2={padding.top + plotHeight + 5}
                                stroke="#6b7280"
                                strokeWidth="1"
                            />
                            <text
                                x={x}
                                y={padding.top + plotHeight + 20}
                                textAnchor="middle"
                                fontSize="12"
                                fill="#6b7280"
                            >
                                {label}
                            </text>
                        </g>
                    );
                })}

                {/* Home team area (top, blue) */}
                <g>
                    {/* Area fill */}
                    <path
                        d={`M ${padding.left} ${centerY} ${allPoints.map((point, index) => {
                            const x = padding.left + index * scaleX;
                            const y = centerY - (point.home_value || 0) * scaleY;
                            return `L ${x} ${y}`;
                        }).join(' ')} L ${padding.left + (allPoints.length - 1) * scaleX} ${centerY} Z`}
                        fill="#3b82f6"
                        fillOpacity="0.2"
                    />
                    {/* Line */}
                    <polyline
                        points={allPoints.map((point, index) => {
                            const x = padding.left + index * scaleX;
                            const y = centerY - (point.home_value || 0) * scaleY;
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                    />
                </g>

                {/* Away team area (bottom, orange) */}
                <g>
                    {/* Area fill */}
                    <path
                        d={`M ${padding.left} ${centerY} ${allPoints.map((point, index) => {
                            const x = padding.left + index * scaleX;
                            const y = centerY + (point.away_value || 0) * scaleY; // away_value is positive, add to go down from center
                            return `L ${x} ${y}`;
                        }).join(' ')} L ${padding.left + (allPoints.length - 1) * scaleX} ${centerY} Z`}
                        fill="#f97316"
                        fillOpacity="0.2"
                    />
                    {/* Line */}
                    <polyline
                        points={allPoints.map((point, index) => {
                            const x = padding.left + index * scaleX;
                            const y = centerY + (point.away_value || 0) * scaleY; // away_value is positive, add to go down from center
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="3"
                    />
                </g>

                {/* Team labels */}
                <text
                    x={padding.left - 10}
                    y={padding.top + 20}
                    textAnchor="end"
                    fontSize="14"
                    fontWeight="600"
                    fill="#3b82f6"
                >
                    {homeTeamName}
                </text>
                <text
                    x={padding.left - 10}
                    y={padding.top + plotHeight - 10}
                    textAnchor="end"
                    fontSize="14"
                    fontWeight="600"
                    fill="#f97316"
                >
                    {awayTeamName}
                </text>

                {/* HT and FT labels */}
                {htPosition > 0 && (
                    <text
                        x={padding.left + htPosition}
                        y={padding.top - 10}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="600"
                        fill="#6b7280"
                    >
                        HT
                    </text>
                )}
                <text
                    x={padding.left + ftPosition}
                    y={padding.top - 10}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="#6b7280"
                >
                    FT
                </text>
            </svg>

            {/* Legend */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                marginTop: '16px',
                fontSize: '14px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '4px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
                    <span style={{ color: '#6b7280' }}>{homeTeamName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '4px', backgroundColor: '#f97316', borderRadius: '2px' }}></div>
                    <span style={{ color: '#6b7280' }}>{awayTeamName}</span>
                </div>
            </div>
        </div>
    );
}

