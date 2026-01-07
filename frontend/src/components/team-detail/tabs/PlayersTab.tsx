/**
 * Players Tab
 *
 * Displays team squad with player cards.
 */

import { useNavigate } from 'react-router-dom';
import { useTeamDetail } from '../TeamDetailContext';

export function PlayersTab() {
  const navigate = useNavigate();
  const { players } = useTeamDetail();

  if (players.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Kadro bilgisi bulunamadi.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        Kadro ({players.length})
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '16px'
      }}>
        {players.map(player => (
          <div
            key={player.external_id}
            onClick={() => navigate(`/player/${player.external_id}`)}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: '#fff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {player.logo ? (
              <img
                src={player.logo}
                alt={player.name}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  margin: '0 auto 8px'
                }}
              />
            ) : (
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                P
              </div>
            )}
            <div style={{
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '4px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            }}>
              {player.name}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {player.position} {player.shirt_number ? `#${player.shirt_number}` : ''}
            </div>
            {player.market_value && (
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: '500' }}>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumSignificantDigits: 3
                }).format(player.market_value)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlayersTab;
