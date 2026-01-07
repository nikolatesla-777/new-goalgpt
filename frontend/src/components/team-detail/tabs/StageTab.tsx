/**
 * Stage Tab
 *
 * Displays stage/round information for the team's competition.
 */

import { useTeamDetail } from '../TeamDetailContext';

export function StageTab() {
  const { team } = useTeamDetail();

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Stage (Asama) Bilgisi</h3>
      <div style={{ padding: '24px', textAlign: 'center', color: '#4b5563', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        {team?.competition ? (
          <>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              {team.competition.name}
            </div>
            <div>Mevcut Sezon</div>
          </>
        ) : (
          <div>Lig/Kupa bilgisi mevcut degil.</div>
        )}
      </div>
    </div>
  );
}

export default StageTab;
