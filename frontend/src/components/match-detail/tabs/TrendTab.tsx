/**
 * Trend Tab
 *
 * Shows minute-by-minute match trends (possession, attacks, etc.)
 */

import { useMatchDetail } from '../MatchDetailContext';

export function TrendTab() {
  const { trend, trendLoading, match } = useMatchDetail();

  if (trendLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Trend verisi yukleniyor...
      </div>
    );
  }

  if (!trend || trend.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Trend Verisi Bulunamadi
        </div>
        <div style={{ fontSize: '14px' }}>
          {match?.status_id === 1
            ? 'Mac basladiktan sonra dakika dakika veriler gosterilecek.'
            : 'Bu mac icin trend verisi yok.'}
        </div>
      </div>
    );
  }

  // Get latest values
  const latestTrend = trend[trend.length - 1] || {};

  // Calculate max values for scaling
  const maxAttacks = Math.max(
    ...trend.map(t => Math.max(t.home_attacks || 0, t.away_attacks || 0)),
    1
  );
  const maxDangerousAttacks = Math.max(
    ...trend.map(t => Math.max(t.home_dangerous_attacks || 0, t.away_dangerous_attacks || 0)),
    1
  );

  // Simple line chart component
  const TrendChart = ({
    title,
    homeData,
    awayData,
    maxValue
  }: {
    title: string;
    homeData: number[];
    awayData: number[];
    maxValue: number;
  }) => {
    const width = 100;
    const height = 60;
    const points = homeData.length;

    const getPath = (data: number[]) => {
      if (data.length === 0) return '';
      return data.map((value, i) => {
        const x = (i / Math.max(points - 1, 1)) * width;
        const y = height - (value / Math.max(maxValue, 1)) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    };

    return (
      <div style={{
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '12px'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          {title}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '80px' }}>
          {/* Grid lines */}
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#f3f4f6" strokeWidth="0.5" />

          {/* Home line */}
          <path
            d={getPath(homeData)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Away line */}
          <path
            d={getPath(awayData)}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '12px'
        }}>
          <span style={{ color: '#3b82f6', fontWeight: '600' }}>
            {homeData[homeData.length - 1] || 0}
          </span>
          <span style={{ color: '#ef4444', fontWeight: '600' }}>
            {awayData[awayData.length - 1] || 0}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Current Possession */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          Top Hakimiyeti
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#3b82f6',
            minWidth: '60px',
            textAlign: 'center'
          }}>
            {latestTrend.home_possession || 50}%
          </div>
          <div style={{
            flex: 1,
            height: '20px',
            backgroundColor: '#f3f4f6',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex'
          }}>
            <div style={{
              width: `${latestTrend.home_possession || 50}%`,
              backgroundColor: '#3b82f6',
              transition: 'width 0.5s ease'
            }} />
            <div style={{
              width: `${latestTrend.away_possession || 50}%`,
              backgroundColor: '#ef4444',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#ef4444',
            minWidth: '60px',
            textAlign: 'center'
          }}>
            {latestTrend.away_possession || 50}%
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
      }}>
        <TrendChart
          title="Ataklar"
          homeData={trend.map(t => t.home_attacks || 0)}
          awayData={trend.map(t => t.away_attacks || 0)}
          maxValue={maxAttacks}
        />
        <TrendChart
          title="Tehlikeli Ataklar"
          homeData={trend.map(t => t.home_dangerous_attacks || 0)}
          awayData={trend.map(t => t.away_dangerous_attacks || 0)}
          maxValue={maxDangerousAttacks}
        />
      </div>

      {/* Current Stats Summary */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: '600',
          fontSize: '14px',
          color: '#374151'
        }}>
          Guncel Durum
        </div>
        {[
          { label: 'Ataklar', home: latestTrend.home_attacks, away: latestTrend.away_attacks },
          { label: 'Tehlikeli Ataklar', home: latestTrend.home_dangerous_attacks, away: latestTrend.away_dangerous_attacks },
          { label: 'Sutlar', home: latestTrend.home_shots, away: latestTrend.away_shots },
          { label: 'Isabetli Sutlar', home: latestTrend.home_shots_on_target, away: latestTrend.away_shots_on_target },
          { label: 'Kornerler', home: latestTrend.home_corners, away: latestTrend.away_corners },
        ].filter(s => s.home !== undefined || s.away !== undefined).map((stat, idx) => (
          <div
            key={stat.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: idx < 4 ? '1px solid #f3f4f6' : 'none'
            }}
          >
            <div style={{
              fontWeight: '600',
              color: (stat.home || 0) > (stat.away || 0) ? '#3b82f6' : '#374151'
            }}>
              {stat.home || 0}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>{stat.label}</div>
            <div style={{
              fontWeight: '600',
              color: (stat.away || 0) > (stat.home || 0) ? '#ef4444' : '#374151'
            }}>
              {stat.away || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '3px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
          {match?.home_team?.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '3px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
          {match?.away_team?.name}
        </div>
      </div>
    </div>
  );
}

export default TrendTab;
