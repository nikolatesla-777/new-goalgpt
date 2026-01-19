/**
 * Events Tab
 *
 * Shows match events/incidents (goals, cards, substitutions)
 */

import { useNavigate } from 'react-router-dom';
import { useMatchDetail } from '../MatchDetailContext';
import type { MatchIncident } from '../MatchDetailContext';

// Combined event config
const EVENT_CONFIG: Record<string, { icon: string; text: string }> = {
  goal: { icon: '⚽', text: 'Gol' },
  penalty_goal: { icon: '⚽', text: 'Penalti Golu' },
  own_goal: { icon: '⚽', text: 'Kendi Kalesine Gol' },
  penalty_miss: { icon: '❌', text: 'Kacirilan Penalti' },
  yellow_card: { icon: '🟨', text: 'Sari Kart' },
  red_card: { icon: '🟥', text: 'Kirmizi Kart' },
  second_yellow: { icon: '🟨🟥', text: 'Ikinci Sari Kart' },
  substitution: { icon: '🔄', text: 'Oyuncu Degisikligi' },
  var: { icon: '📺', text: 'VAR Karari' },
  penalty_awarded: { icon: '🎯', text: 'Penalti' },
};

const GOAL_TYPES = ['goal', 'penalty_goal', 'own_goal'];

// Shared component for event content (used by both home and away)
interface EventContentProps {
  event: MatchIncident;
  align: 'left' | 'right';
  onPlayerClick: (playerId: string) => void;
}

function EventContent({ event, align, onPlayerClick }: EventContentProps) {
  const isSubstitution = event.incident_type === 'substitution';

  return (
    <>
      {event.player_name && (
        <div
          onClick={() => event.player_id && onPlayerClick(event.player_id)}
          style={{
            fontWeight: '600',
            fontSize: '14px',
            cursor: event.player_id ? 'pointer' : 'default',
            color: '#1f2937',
            textAlign: align,
          }}
        >
          {event.player_name}
        </div>
      )}
      {event.assist_player_name && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', textAlign: align }}>
          Asist: {event.assist_player_name}
        </div>
      )}
      {isSubstitution && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', textAlign: align }}>
          <span style={{ color: '#22c55e' }}>↑ {event.in_player_name}</span>
          {event.out_player_name && (
            <span style={{ color: '#ef4444' }}> ↓ {event.out_player_name}</span>
          )}
        </div>
      )}
      {event.reason && (
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', textAlign: align }}>
          {event.reason}
        </div>
      )}
    </>
  );
}

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

  const handlePlayerClick = (playerId: string) => navigate(`/player/${playerId}`);

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden' }}>
      {sortedIncidents.map((event, idx) => {
        const isHome = event.team === 'home';
        const config = EVENT_CONFIG[event.incident_type] || { icon: '📋', text: event.incident_type };
        const isGoal = GOAL_TYPES.includes(event.incident_type);

        return (
          <div
            key={`${event.incident_type}-${event.minute}-${event.player_id || idx}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '14px 16px',
              borderBottom: idx < sortedIncidents.length - 1 ? '1px solid #f3f4f6' : 'none',
              backgroundColor: isGoal ? '#fefce8' : 'transparent'
            }}
          >
            {/* Home side */}
            <div style={{ flex: 1, paddingRight: '12px', opacity: isHome ? 1 : 0.3 }}>
              {isHome && <EventContent event={event} align="right" onPlayerClick={handlePlayerClick} />}
            </div>

            {/* Center - Icon & Minute */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>{config.icon}</div>
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
                {config.text}
              </div>
            </div>

            {/* Away side */}
            <div style={{ flex: 1, paddingLeft: '12px', opacity: isHome ? 0.3 : 1 }}>
              {!isHome && <EventContent event={event} align="left" onPlayerClick={handlePlayerClick} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EventsTab;
