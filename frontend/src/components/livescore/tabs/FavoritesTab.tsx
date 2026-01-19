/**
 * FavoritesTab
 *
 * Displays user's favorite matches
 * Uses LivescoreContext for match data and FavoritesContext for favorites
 */

import { useMemo } from 'react';
import { useLivescore } from '../../../context/LivescoreContext';
import { useFavorites } from '../../../context/FavoritesContext';
import { MatchList } from '../../MatchList';
import { Star } from '@phosphor-icons/react';

export function FavoritesTab() {
  const { matches, isLoading, error } = useLivescore();
  const { favorites } = useFavorites();

  // Filter matches that are in favorites
  const favoriteMatches = useMemo(() => {
    return matches.filter(match => favorites.has(match.id));
  }, [matches, favorites]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        gap: '16px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #334155',
          borderTop: '3px solid #f59e0b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#94a3b8' }}>Favoriler yukleniyor...</span>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}>
        <p style={{ marginBottom: '8px', fontWeight: '600' }}>Hata</p>
        <p style={{ fontSize: '0.875rem', color: '#f87171' }}>{error}</p>
      </div>
    );
  }

  if (favoriteMatches.length === 0) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        color: '#64748b',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          borderRadius: '50%',
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Star size={32} weight="fill" color="#f59e0b" />
        </div>
        <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px', color: '#334155' }}>
          Henuz favori mac eklemediniz
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          Mac kartlarindaki yildiz ikonuna tiklayarak favorilere ekleyebilirsiniz
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Favorites indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      }}>
        <Star size={18} weight="fill" color="#f59e0b" />
        <span style={{ color: '#f59e0b', fontWeight: '600' }}>
          {favoriteMatches.length} favori mac
        </span>
      </div>

      {/* Match List */}
      <MatchList
        view="favorites"
        prefetchedMatches={favoriteMatches}
        skipInternalUpdates={true}
        isLoading={isLoading}
      />
    </div>
  );
}

export default FavoritesTab;
