/**
 * Trend Tab
 *
 * Shows minute-by-minute offensive intensity trends (TheSports Trend API)
 * - Home team = positive values (blue bars up)
 * - Away team = negative values (red bars down)
 * - Chart shows attacking pressure per minute
 */

import { useMatchDetail } from '../MatchDetailContext';
import { useMemo } from 'react';

// Types for trend API data
interface TrendDataPoint {
  minute: number;
  home_value: number;
  away_value: number;
}

interface TrendApiData {
  first_half?: TrendDataPoint[] | number[];
  second_half?: TrendDataPoint[] | number[];
  overtime?: TrendDataPoint[] | number[];
  match_id?: string;
}

export function TrendTab() {
  const { trend, trendLoading, match, incidents } = useMatchDetail();

  // Parse trend data into displayable format
  const parsedTrend = useMemo(() => {
    if (!trend || trend.length === 0) return null;

    // Check if it's new format (TrendApiData with first_half/second_half)
    const trendObj = Array.isArray(trend) ? trend[0] : trend;

    if (trendObj && (trendObj.first_half || trendObj.second_half)) {
      // New format: { first_half: number[] | TrendDataPoint[], second_half: number[] | TrendDataPoint[] }
      const apiData = trendObj as TrendApiData;
      const allPoints: { minute: number; value: number }[] = [];

      // Process first half (minutes 1-45+)
      if (apiData.first_half && Array.isArray(apiData.first_half)) {
        apiData.first_half.forEach((item, idx) => {
          if (typeof item === 'number') {
            allPoints.push({ minute: idx + 1, value: item });
          } else if (item && typeof item === 'object') {
            // TrendDataPoint format
            const value = (item.home_value || 0) - (item.away_value || 0);
            allPoints.push({ minute: item.minute || (idx + 1), value });
          }
        });
      }

      // Process second half (minutes 46-90+)
      if (apiData.second_half && Array.isArray(apiData.second_half)) {
        apiData.second_half.forEach((item, idx) => {
          if (typeof item === 'number') {
            allPoints.push({ minute: idx + 46, value: item });
          } else if (item && typeof item === 'object') {
            const value = (item.home_value || 0) - (item.away_value || 0);
            allPoints.push({ minute: item.minute || (idx + 46), value });
          }
        });
      }

      // Process overtime if exists
      if (apiData.overtime && Array.isArray(apiData.overtime)) {
        apiData.overtime.forEach((item, idx) => {
          if (typeof item === 'number') {
            allPoints.push({ minute: idx + 91, value: item });
          } else if (item && typeof item === 'object') {
            const value = (item.home_value || 0) - (item.away_value || 0);
            allPoints.push({ minute: item.minute || (idx + 91), value });
          }
        });
      }

      return allPoints;
    }

    // Legacy format: array of TrendPoint with attacks/possession
    if (Array.isArray(trend) && trend.length > 0 && trend[0].home_attacks !== undefined) {
      return trend.map((t: any, idx: number) => ({
        minute: t.minute || idx + 1,
        value: ((t.home_attacks || 0) + (t.home_dangerous_attacks || 0)) -
               ((t.away_attacks || 0) + (t.away_dangerous_attacks || 0))
      }));
    }

    return null;
  }, [trend]);

  // Get goal events for markers
  const goalEvents = useMemo(() => {
    if (!incidents || !Array.isArray(incidents)) return [];
    return incidents
      .filter((inc: any) => inc.incident_type === 'goal' || inc.type === 1)
      .map((inc: any) => ({
        minute: inc.minute,
        team: inc.team,
        addedTime: inc.added_time
      }));
  }, [incidents]);

  // Get card events for markers
  const cardEvents = useMemo(() => {
    if (!incidents || !Array.isArray(incidents)) return [];
    return incidents
      .filter((inc: any) =>
        inc.incident_type === 'yellow_card' || inc.incident_type === 'red_card' ||
        inc.type === 3 || inc.type === 4
      )
      .map((inc: any) => ({
        minute: inc.minute,
        team: inc.team,
        isRed: inc.incident_type === 'red_card' || inc.type === 4
      }));
  }, [incidents]);

  if (trendLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Trend verisi yukleniyor...
      </div>
    );
  }

  if (!parsedTrend || parsedTrend.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: '#1a2634',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px', color: '#e5e7eb' }}>
          Trend Verisi Bulunamadi
        </div>
        <div style={{ fontSize: '14px', color: '#9ca3af' }}>
          {match?.status_id === 1
            ? 'Mac basladiktan sonra dakika dakika veriler gosterilecek.'
            : 'Bu mac icin trend verisi henuz mevcut degil.'}
        </div>
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...parsedTrend.map(p => Math.abs(p.value)),
    1
  );

  // Bar chart dimensions
  const chartHeight = 120;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Main Trend Chart - Dark theme like screenshot */}
      <div style={{
        backgroundColor: '#1a2634',
        borderRadius: '12px',
        padding: '16px',
        overflow: 'hidden'
      }}>
        {/* Team labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '13px'
        }}>
          <div style={{ color: '#22d3ee', fontWeight: '600' }}>
            {match?.home_team?.name || 'Ev Sahibi'}
          </div>
          <div style={{ color: '#f59e0b', fontWeight: '600' }}>
            {match?.away_team?.name || 'Deplasman'}
          </div>
        </div>

        {/* Chart area */}
        <div style={{
          position: 'relative',
          height: `${chartHeight * 2 + 20}px`,
          backgroundColor: '#0f1923',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Center line (HT marker) */}
          <div style={{
            position: 'absolute',
            top: chartHeight,
            left: 0,
            right: 0,
            height: '1px',
            backgroundColor: '#374151'
          }} />

          {/* Half-time marker */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: '1px',
            backgroundColor: '#4b5563',
            zIndex: 5
          }}>
            <div style={{
              position: 'absolute',
              top: chartHeight - 10,
              left: '-10px',
              backgroundColor: '#374151',
              color: '#9ca3af',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '500'
            }}>HT</div>
          </div>

          {/* FT marker */}
          <div style={{
            position: 'absolute',
            top: chartHeight - 10,
            right: '4px',
            backgroundColor: '#374151',
            color: '#9ca3af',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '500',
            zIndex: 5
          }}>FT</div>

          {/* Bars */}
          <svg
            viewBox={`0 0 ${parsedTrend.length} ${chartHeight * 2}`}
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
            {parsedTrend.map((point, idx) => {
              const normalizedValue = (point.value / maxValue) * chartHeight;
              const isPositive = point.value >= 0;

              return (
                <rect
                  key={idx}
                  x={idx}
                  y={isPositive ? chartHeight - normalizedValue : chartHeight}
                  width={0.8}
                  height={Math.abs(normalizedValue)}
                  fill={isPositive ? '#22d3ee' : '#f59e0b'}
                  opacity={0.9}
                />
              );
            })}
          </svg>

          {/* Goal markers */}
          {goalEvents.map((goal, idx) => {
            const xPos = (goal.minute / 90) * 100;
            const isHome = goal.team === 'home';
            return (
              <div
                key={`goal-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${Math.min(xPos, 98)}%`,
                  top: isHome ? '10px' : 'auto',
                  bottom: isHome ? 'auto' : '10px',
                  transform: 'translateX(-50%)',
                  zIndex: 10
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: isHome ? '#22d3ee' : '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px'
                }}>⚽</div>
              </div>
            );
          })}

          {/* Card markers */}
          {cardEvents.map((card, idx) => {
            const xPos = (card.minute / 90) * 100;
            const isHome = card.team === 'home';
            return (
              <div
                key={`card-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${Math.min(xPos, 98)}%`,
                  top: isHome ? '30px' : 'auto',
                  bottom: isHome ? 'auto' : '30px',
                  transform: 'translateX(-50%)',
                  zIndex: 10
                }}
              >
                <div style={{
                  width: '10px',
                  height: '14px',
                  borderRadius: '2px',
                  backgroundColor: card.isRed ? '#ef4444' : '#fbbf24'
                }} />
              </div>
            );
          })}
        </div>

        {/* Time labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '11px',
          color: '#6b7280'
        }}>
          <span>0'</span>
          <span>15'</span>
          <span>30'</span>
          <span>HT</span>
          <span>60'</span>
          <span>75'</span>
          <span>90'</span>
        </div>
      </div>

      {/* Info card */}
      <div style={{
        backgroundColor: '#1a2634',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#e5e7eb',
          marginBottom: '12px'
        }}>
          Trend Hakkinda
        </div>
        <div style={{
          fontSize: '13px',
          color: '#9ca3af',
          lineHeight: '1.6'
        }}>
          <p style={{ marginBottom: '8px' }}>
            Bu grafik, mac boyunca takimlarin hucum yogunlugunu dakika dakika gostermektedir.
          </p>
          <ul style={{ marginLeft: '16px', marginBottom: '8px' }}>
            <li><span style={{ color: '#22d3ee' }}>Mavi cizgiler</span>: Ev sahibi hucum baskisi</li>
            <li><span style={{ color: '#f59e0b' }}>Turuncu cizgiler</span>: Deplasman hucum baskisi</li>
          </ul>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            Degerler, atak ve top kontrolune gore hesaplanmaktadir.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        fontSize: '13px',
        color: '#9ca3af'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#22d3ee', borderRadius: '2px' }} />
          {match?.home_team?.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
          {match?.away_team?.name}
        </div>
      </div>
    </div>
  );
}

export default TrendTab;
