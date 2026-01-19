/**
 * Events Tab
 *
 * Shows match events/incidents (goals, cards, substitutions)
 */

import { useNavigate } from 'react-router-dom';
import { useMatchDetail } from '../MatchDetailContext';

// Event icons
const EVENT_ICONS: Record<string, string> = {
  goal: '⚽',
  penalty_goal: '⚽',
  own_goal: '⚽',
  penalty_miss: '❌',
  yellow_card: '🟨',
  red_card: '🟥',
  second_yellow: '🟨🟥',
  substitution: '🔄',
  var: '📺',
  penalty_awarded: '🎯',
};

// Event text
const EVENT_TEXT: Record<string, string> = {
  goal: 'Gol',
  penalty_goal: 'Penalti Golu',
  own_goal: 'Kendi Kalesine Gol',
  penalty_miss: 'Kacirilan Penalti',
  yellow_card: 'Sari Kart',
  red_card: 'Kirmizi Kart',
  second_yellow: 'Ikinci Sari Kart',
  substitution: 'Oyuncu Degisikligi',
  var: 'VAR Karari',
  penalty_awarded: 'Penalti',
};

export function EventsTab() {
  const navigate = useNavigate();
  const { incidents, incidentsLoading, match } = useMatchDetail();

  if (incidentsLoading && incidents.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Olaylar yukleniyor...
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚽</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Olay Bulunamadi
        </div>
        <div style={{ fontSize: '14px' }}>
          {match?.status_id === 1
            ? 'Mac basladiktan sonra olaylar gosterilecek.'
            : 'Bu macta henuz kayda deger bir olay olmadi.'}
        </div>
      </div>
    );
  }

  // Sort by minute (descending - most recent first)
  const sortedIncidents = [...incidents].sort((a, b) => {
    const minuteA = a.minute + (a.added_time || 0) * 0.01;
    const minuteB = b.minute + (b.added_time || 0) * 0.01;
    return minuteB - minuteA;
  });

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden' }}>
      {sortedIncidents.map((event, idx) => {
        const isHome = event.team === 'home';
        const icon = EVENT_ICONS[event.incident_type] || '📋';
        const text = EVENT_TEXT[event.incident_type] || event.incident_type;
        const isGoal = ['goal', 'penalty_goal', 'own_goal'].includes(event.incident_type);

        return (
          <div
            key={`${event.incident_type}-${event.minute}-${idx}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '14px 16px',
              borderBottom: idx < sortedIncidents.length - 1 ? '1px solid #f3f4f6' : 'none',
              backgroundColor: isGoal ? '#fefce8' : 'transparent'
            }}
          >
            {/* Home side */}
            <div style={{
              flex: 1,
              textAlign: 'right',
              paddingRight: '12px',
              opacity: isHome ? 1 : 0.3
            }}>
              {isHome && (
                <>
                  {event.player_name && (
                    <div
                      onClick={() => event.player_id && navigate(`/player/${event.player_id}`)}
                      style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: event.player_id ? 'pointer' : 'default',
                        color: '#1f2937'
                      }}
                    >
                      {event.player_name}
                    </div>
                  )}
                  {event.assist_player_name && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      Asist: {event.assist_player_name}
                    </div>
                  )}
                  {event.incident_type === 'substitution' && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      <span style={{ color: '#22c55e' }}>↑ {event.in_player_name}</span>
                      {event.out_player_name && (
                        <span style={{ color: '#ef4444' }}> ↓ {event.out_player_name}</span>
                      )}
                    </div>
                  )}
                  {event.reason && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {event.reason}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Center - Icon & Minute */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '60px'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {event.minute}'
                {event.added_time && event.added_time > 0 && (
                  <span style={{ color: '#6b7280' }}>+{event.added_time}</span>
                )}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                {text}
              </div>
            </div>

            {/* Away side */}
            <div style={{
              flex: 1,
              textAlign: 'left',
              paddingLeft: '12px',
              opacity: !isHome ? 1 : 0.3
            }}>
              {!isHome && (
                <>
                  {event.player_name && (
                    <div
                      onClick={() => event.player_id && navigate(`/player/${event.player_id}`)}
                      style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: event.player_id ? 'pointer' : 'default',
                        color: '#1f2937'
                      }}
                    >
                      {event.player_name}
                    </div>
                  )}
                  {event.assist_player_name && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      Asist: {event.assist_player_name}
                    </div>
                  )}
                  {event.incident_type === 'substitution' && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      <span style={{ color: '#22c55e' }}>↑ {event.in_player_name}</span>
                      {event.out_player_name && (
                        <span style={{ color: '#ef4444' }}> ↓ {event.out_player_name}</span>
                      )}
                    </div>
                  )}
                  {event.reason && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {event.reason}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EventsTab;
