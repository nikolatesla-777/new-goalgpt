/**
 * Stats Tab
 *
 * Shows match statistics (possession, shots, corners, etc.)
 */

import { useMatchDetail } from '../MatchDetailContext';

// Stat name mapping
const STAT_NAMES: Record<number, { name: string; nameTr: string }> = {
  2: { name: 'Corner Kicks', nameTr: 'Korner' },
  3: { name: 'Yellow Cards', nameTr: 'Sari Kart' },
  4: { name: 'Red Cards', nameTr: 'Kirmizi Kart' },
  5: { name: 'Free Kicks', nameTr: 'Serbest Vurus' },
  8: { name: 'Offsides', nameTr: 'Ofsayt' },
  9: { name: 'Fouls', nameTr: 'Faul' },
  21: { name: 'Shots on Target', nameTr: 'Isabetli Sut' },
  22: { name: 'Shots off Target', nameTr: 'Isabetsiz Sut' },
  23: { name: 'Attacks', nameTr: 'Atak' },
  24: { name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
  25: { name: 'Ball Possession', nameTr: 'Top Hakimiyeti' },
  26: { name: 'Passes', nameTr: 'Pas' },
  27: { name: 'Pass Accuracy', nameTr: 'Pas Isabetkisi' },
  28: { name: 'Crosses', nameTr: 'Orta' },
  29: { name: 'Interceptions', nameTr: 'Top Kapma' },
  30: { name: 'Tackles', nameTr: 'Mudahale' },
  37: { name: 'Blocked Shots', nameTr: 'Bloklanan Sut' },
};

// Priority order for stats display
const STAT_PRIORITY = [25, 21, 22, 23, 24, 2, 3, 4, 9, 8, 26, 27, 28, 29, 30, 37, 5];

export function StatsTab() {
  const { stats, statsLoading, match } = useMatchDetail();

  if (statsLoading && stats.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Istatistikler yukleniyor...
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Istatistik Bulunamadi
        </div>
        <div style={{ fontSize: '14px' }}>
          {match?.status_id === 1
            ? 'Mac basladiktan sonra istatistikler gosterilecek.'
            : 'Bu mac icin istatistik verisi yok.'}
        </div>
      </div>
    );
  }

  // Sort stats by priority
  const sortedStats = [...stats].sort((a, b) => {
    const priorityA = STAT_PRIORITY.indexOf(a.type);
    const priorityB = STAT_PRIORITY.indexOf(b.type);
    if (priorityA === -1 && priorityB === -1) return 0;
    if (priorityA === -1) return 1;
    if (priorityB === -1) return -1;
    return priorityA - priorityB;
  });

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 1fr',
        padding: '12px 16px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontWeight: '600',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <div>{match?.home_team?.name?.substring(0, 10) || 'Ev'}</div>
        <div style={{ textAlign: 'center' }}>Istatistik</div>
        <div style={{ textAlign: 'right' }}>{match?.away_team?.name?.substring(0, 10) || 'Dep'}</div>
      </div>

      {/* Stats List */}
      {sortedStats.map((stat, idx) => {
        const statInfo = STAT_NAMES[stat.type] || { name: stat.name || `Type ${stat.type}`, nameTr: stat.nameTr || '' };
        const total = (stat.home || 0) + (stat.away || 0);
        const homePercent = total > 0 ? ((stat.home || 0) / total) * 100 : 50;
        const awayPercent = total > 0 ? ((stat.away || 0) / total) * 100 : 50;
        const isPossession = stat.type === 25;

        return (
          <div
            key={stat.type || idx}
            style={{
              padding: '14px 16px',
              borderBottom: idx < sortedStats.length - 1 ? '1px solid #f3f4f6' : 'none'
            }}
          >
            {/* Stat Name */}
            <div style={{
              textAlign: 'center',
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              {statInfo.nameTr || statInfo.name}
            </div>

            {/* Progress Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Home Value */}
              <div style={{
                width: '40px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '15px',
                color: homePercent > awayPercent ? '#3b82f6' : '#374151'
              }}>
                {isPossession ? `${stat.home}%` : stat.home}
              </div>

              {/* Bar */}
              <div style={{
                flex: 1,
                height: '8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                overflow: 'hidden',
                display: 'flex'
              }}>
                <div style={{
                  width: `${homePercent}%`,
                  backgroundColor: homePercent > awayPercent ? '#3b82f6' : '#93c5fd',
                  transition: 'width 0.3s ease'
                }} />
                <div style={{
                  width: `${awayPercent}%`,
                  backgroundColor: awayPercent > homePercent ? '#ef4444' : '#fca5a5',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Away Value */}
              <div style={{
                width: '40px',
                textAlign: 'right',
                fontWeight: '600',
                fontSize: '15px',
                color: awayPercent > homePercent ? '#ef4444' : '#374151'
              }}>
                {isPossession ? `${stat.away}%` : stat.away}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StatsTab;
