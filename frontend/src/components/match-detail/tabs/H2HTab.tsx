/**
 * H2H Tab
 *
 * Shows head-to-head history between teams
 */

import { useMatchDetail } from '../MatchDetailContext';

// Shared component for team recent form card
interface TeamFormCardProps {
  teamName: string | undefined;
  teamId: string | undefined;
  recentForm: any[];
}

function TeamFormCard({ teamName, teamId, recentForm }: TeamFormCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        fontWeight: '600',
        fontSize: '13px',
        color: '#374151'
      }}>
        {teamName} Son Form
      </div>
      {recentForm.slice(0, 5).map((m, idx) => {
        const isHome = m.home_team?.id === teamId;
        const teamScore = isHome ? m.home_score : m.away_score;
        const oppScore = isHome ? m.away_score : m.home_score;
        const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
        const resultColor = result === 'W' ? '#22c55e' : result === 'L' ? '#ef4444' : '#eab308';

        return (
          <div
            key={m.id || idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 16px',
              borderBottom: idx < Math.min(recentForm.length, 5) - 1 ? '1px solid #f3f4f6' : 'none',
              fontSize: '13px'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              backgroundColor: resultColor,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '12px',
              marginRight: '10px'
            }}>
              {result === 'W' ? 'G' : result === 'L' ? 'M' : 'B'}
            </div>
            <div style={{ flex: 1, color: '#6b7280' }}>
              {isHome ? m.away_team?.name : m.home_team?.name}
            </div>
            <div style={{ fontWeight: '500' }}>
              {teamScore}-{oppScore}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function H2HTab() {
  const { h2h, h2hLoading, match } = useMatchDetail();

  if (h2hLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        H2H verisi yukleniyor...
      </div>
    );
  }

  if (!h2h || !h2h.summary) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          H2H Verisi Bulunamadi
        </div>
        <div style={{ fontSize: '14px' }}>
          Bu takimlar arasindaki gecmis maclar bulunamadi.
        </div>
      </div>
    );
  }

  const { summary, h2hMatches = [], homeRecentForm = [], awayRecentForm = [] } = h2h;
  const total = summary.total || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          Karsılasma Ozeti
        </h3>

        {/* Stats Bars */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span style={{ color: '#3b82f6', fontWeight: '600' }}>
              {match?.home_team?.name} ({summary.homeWins})
            </span>
            <span style={{ color: '#6b7280' }}>Beraberlik ({summary.draws})</span>
            <span style={{ color: '#ef4444', fontWeight: '600' }}>
              {match?.away_team?.name} ({summary.awayWins})
            </span>
          </div>
          <div style={{
            display: 'flex',
            height: '12px',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#f3f4f6'
          }}>
            <div style={{
              width: `${(summary.homeWins / total) * 100}%`,
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s'
            }} />
            <div style={{
              width: `${(summary.draws / total) * 100}%`,
              backgroundColor: '#9ca3af',
              transition: 'width 0.3s'
            }} />
            <div style={{
              width: `${(summary.awayWins / total) * 100}%`,
              backgroundColor: '#ef4444',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          Toplam {summary.total} mac oynandi
        </div>
      </div>

      {/* Previous H2H Matches */}
      {h2hMatches.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            fontWeight: '600',
            fontSize: '14px',
            color: '#374151'
          }}>
            Onceki Karsilasmalar
          </div>
          {h2hMatches.slice(0, 5).map((m, idx) => (
            <div
              key={m.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: idx < Math.min(h2hMatches.length, 5) - 1 ? '1px solid #f3f4f6' : 'none'
              }}
            >
              <div style={{ flex: 1, fontSize: '14px' }}>
                {m.home_team?.name}
              </div>
              <div style={{
                padding: '4px 12px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {m.home_score} - {m.away_score}
              </div>
              <div style={{ flex: 1, textAlign: 'right', fontSize: '14px' }}>
                {m.away_team?.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <TeamFormCard
          teamName={match?.home_team?.name}
          teamId={match?.home_team_id}
          recentForm={homeRecentForm}
        />
        <TeamFormCard
          teamName={match?.away_team?.name}
          teamId={match?.away_team_id}
          recentForm={awayRecentForm}
        />
      </div>
    </div>
  );
}

export default H2HTab;
