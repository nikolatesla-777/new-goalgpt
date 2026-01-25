/**
 * Telegram Match Card
 *
 * Individual match card for Telegram publisher with selection
 */

interface Match {
  id: number;
  home_name: string;
  away_name: string;
  competition_name?: string;
  date_unix: number;
  btts_potential?: number;
  o25_potential?: number;
  o15_potential?: number;
  team_a_xg_prematch?: number;
  team_b_xg_prematch?: number;
}

interface Props {
  match: Match;
  isSelected: boolean;
  onSelect: () => void;
}

export function TelegramMatchCard({ match, isSelected, onSelect }: Props) {
  const matchDate = new Date(match.date_unix * 1000);
  const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '16px',
        border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        background: isSelected ? '#eff6ff' : 'white',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#d1d5db';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#e5e7eb';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          {/* League & Time */}
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            {match.competition_name || 'Unknown League'} • {timeStr}
          </div>

          {/* Teams */}
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
            {match.home_name} vs {match.away_name}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#4b5563' }}>
            {match.btts_potential && (
              <span>BTTS: %{match.btts_potential}</span>
            )}
            {match.o25_potential && (
              <span>O2.5: %{match.o25_potential}</span>
            )}
            {match.o15_potential && (
              <span>O1.5: %{match.o15_potential}</span>
            )}
            {match.team_a_xg_prematch !== undefined && match.team_b_xg_prematch !== undefined && (
              <span>
                xG: {match.team_a_xg_prematch.toFixed(1)} - {match.team_b_xg_prematch.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Selection Indicator */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
            background: isSelected ? '#3b82f6' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isSelected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
