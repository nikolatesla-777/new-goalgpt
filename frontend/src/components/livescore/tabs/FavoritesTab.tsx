/**
 * Favorites Tab - Favorilerim
 *
 * Shows user's favorite matches with real-time updates
 */

import { useState, useCallback, useMemo } from 'react';
import { useLivescore } from '../LivescoreContext';
import { useFavorites } from '../../../context/FavoritesContext';
import { LeagueSection } from '../../LeagueSection';
import type { Match, Competition } from '../../../api/matches';

export function FavoritesTab() {
  const { allMatches, loading } = useLivescore();
  const { favorites, favoritesCount } = useFavorites();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Toggle section collapse
  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  // Filter matches to only show favorites
  const favoriteMatches = useMemo(() => {
    return allMatches.filter(match => favorites.has(match.id));
  }, [allMatches, favorites]);

  // Group favorite matches by country and competition
  const groupedMatches = useMemo(() => {
    if (favoriteMatches.length === 0) {
      return [];
    }

    // Helper to sort matches within a group
    const sortMatchesInGroup = (matchList: Match[]) => {
      return [...matchList].sort((a, b) => {
        const statusA = (a as any).status_id ?? (a as any).status ?? 0;
        const statusB = (b as any).status_id ?? (b as any).status ?? 0;
        const isLiveA = [2, 3, 4, 5, 7].includes(statusA);
        const isLiveB = [2, 3, 4, 5, 7].includes(statusB);

        if (isLiveA && isLiveB) {
          const minuteA = a.minute ?? 0;
          const minuteB = b.minute ?? 0;
          if (minuteA !== minuteB) return minuteB - minuteA;
          return a.id.localeCompare(b.id);
        }

        if (isLiveA && !isLiveB) return -1;
        if (!isLiveA && isLiveB) return 1;

        const timeA = a.match_time || 0;
        const timeB = b.match_time || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
    };

    // Group by Country → Competition
    const grouped = new Map<string, {
      competition: Competition | null;
      matches: Match[];
      countryName: string;
    }>();

    favoriteMatches.forEach((match) => {
      if (!match || typeof match !== 'object' || !match.id) return;

      const comp = match.competition || null;
      const countryName = comp?.country_name || 'Diğer';
      const compId = match.competition_id || 'unknown';
      const groupKey = `${countryName}|${compId}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          competition: comp,
          matches: [],
          countryName,
        });
      }
      grouped.get(groupKey)!.matches.push(match);
    });

    // Sort matches within each group
    grouped.forEach((group) => {
      group.matches = sortMatchesInGroup(group.matches);
    });

    // Sort by country name first, then by competition name
    const sorted = Array.from(grouped.entries()).sort((a, b) => {
      const countryA = a[1].countryName || 'Diğer';
      const countryB = b[1].countryName || 'Diğer';

      const countryCompare = countryA.localeCompare(countryB, 'tr');
      if (countryCompare !== 0) return countryCompare;

      const nameA = a[1].competition?.name || 'Bilinmeyen Lig';
      const nameB = b[1].competition?.name || 'Bilinmeyen Lig';
      return nameA.localeCompare(nameB, 'tr');
    });

    return sorted.map(([key, value]) => [key, { ...value, isTimeGroup: false }] as [string, typeof value & { isTimeGroup: boolean }]);
  }, [favoriteMatches]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #f59e0b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <span style={{ marginLeft: '12px', color: '#4b5563' }}>Favoriler yükleniyor...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{
        marginBottom: '1rem',
        padding: '12px',
        backgroundColor: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.25rem' }}>⭐</span>
          <span style={{ fontWeight: '600', color: '#92400e', fontSize: '1rem' }}>
            FAVORİ MAÇLARIM
          </span>
        </div>
        <span style={{ color: '#92400e', fontWeight: '500' }}>
          {favoritesCount} maç
        </span>
      </div>

      {/* Content */}
      {favoriteMatches.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#fefce8',
          borderRadius: '12px',
          border: '1px solid #fef08a',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
          <h3 style={{ color: '#854d0e', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
            Henüz favori maçınız yok
          </h3>
          <p style={{ color: '#a16207', fontSize: '0.875rem', maxWidth: '300px', margin: '0 auto' }}>
            Maç kartlarındaki yıldız ikonuna tıklayarak maçları favorilere ekleyebilirsiniz
          </p>
        </div>
      ) : (
        <div>
          {groupedMatches.map(([sectionKey, groupData]) => {
            if (!Array.isArray(groupData.matches)) return null;

            const isCollapsed = collapsedSections.has(sectionKey);

            return (
              <LeagueSection
                key={sectionKey}
                competition={groupData.competition}
                matches={groupData.matches}
                countryName={(groupData as any).countryName || null}
                isTimeGroup={false}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => toggleSection(sectionKey)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FavoritesTab;
