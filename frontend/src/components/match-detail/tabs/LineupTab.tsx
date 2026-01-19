/**
 * Lineup Tab
 *
 * Shows team lineups with formations
 */

import { useNavigate } from 'react-router-dom';
import { useMatchDetail } from '../MatchDetailContext';

export function LineupTab() {
  const navigate = useNavigate();
  const { lineup, lineupLoading, match } = useMatchDetail();

  if (lineupLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Kadrolar yukleniyor...
      </div>
    );
  }

  if (!lineup || (lineup.home.length === 0 && lineup.away.length === 0)) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Kadro Bilgisi Bulunamadi
        </div>
        <div style={{ fontSize: '14px' }}>
          {match?.status_id === 1
            ? 'Kadro bilgisi mac yaklastikca yayinlanacak.'
            : 'Bu mac icin kadro verisi yok.'}
        </div>
      </div>
    );
  }

  // Separate starters and subs
  const homeStarters = lineup.home.filter(p => p.is_starter !== false);
  const homeSubs = lineup.home_subs || lineup.home.filter(p => p.is_starter === false);
  const awayStarters = lineup.away.filter(p => p.is_starter !== false);
  const awaySubs = lineup.away_subs || lineup.away.filter(p => p.is_starter === false);

  const PlayerCard = ({ player, teamColor }: { player: any; teamColor: string }) => (
    <div
      onClick={() => player.player_id && navigate(`/player/${player.player_id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        cursor: player.player_id ? 'pointer' : 'default',
        borderLeft: `3px solid ${teamColor}`
      }}
    >
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151'
      }}>
        {player.shirt_number || '-'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: '500',
          fontSize: '14px',
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {player.player_name || 'Bilinmiyor'}
          {player.is_captain && <span style={{ fontSize: '10px', color: '#eab308' }}>©</span>}
        </div>
        {player.position && (
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {player.position}
          </div>
        )}
      </div>
      {player.rating && (
        <div style={{
          padding: '2px 8px',
          backgroundColor: player.rating >= 7 ? '#dcfce7' : player.rating >= 6 ? '#fef9c3' : '#fee2e2',
          color: player.rating >= 7 ? '#16a34a' : player.rating >= 6 ? '#ca8a04' : '#dc2626',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {player.rating.toFixed(1)}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Formations */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
            {match?.home_team?.name}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
            {lineup.home_formation || '-'}
          </div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
            {match?.away_team?.name}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
            {lineup.away_formation || '-'}
          </div>
        </div>
      </div>

      {/* Starting XI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
      }}>
        {/* Home Team */}
        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '4px',
              height: '16px',
              backgroundColor: '#3b82f6',
              borderRadius: '2px'
            }} />
            Ilk 11
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {homeStarters.map((player, idx) => (
              <PlayerCard key={player.player_id || idx} player={player} teamColor="#3b82f6" />
            ))}
          </div>
        </div>

        {/* Away Team */}
        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '4px',
              height: '16px',
              backgroundColor: '#ef4444',
              borderRadius: '2px'
            }} />
            Ilk 11
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {awayStarters.map((player, idx) => (
              <PlayerCard key={player.player_id || idx} player={player} teamColor="#ef4444" />
            ))}
          </div>
        </div>
      </div>

      {/* Substitutes */}
      {(homeSubs.length > 0 || awaySubs.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px'
        }}>
          {/* Home Subs */}
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '12px'
            }}>
              Yedekler
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {homeSubs.map((player, idx) => (
                <PlayerCard key={player.player_id || idx} player={player} teamColor="#93c5fd" />
              ))}
            </div>
          </div>

          {/* Away Subs */}
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '12px'
            }}>
              Yedekler
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {awaySubs.map((player, idx) => (
                <PlayerCard key={player.player_id || idx} player={player} teamColor="#fca5a5" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LineupTab;
