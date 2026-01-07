/**
 * AI Matches Tab - Yapay Zeka
 *
 * Shows matches that have AI predictions (same as favorites logic).
 * Filters allMatches by matching with aiMatches match IDs.
 */

import { useMemo } from 'react';
import { useLivescore } from '../LivescoreContext';
import { LeagueSection } from '../../LeagueSection';
import type { Match, Competition } from '../../../api/matches';

export function AIMatchesTab() {
  const { allMatches, aiMatches, sortBy, loading } = useLivescore();

  // Get match IDs that have AI predictions
  const aiMatchIds = useMemo(() => {
    if (!aiMatches || aiMatches.length === 0) return new Set<string>();
    return new Set(aiMatches.map((p: any) => p.match_external_id || p.match_id).filter(Boolean));
  }, [aiMatches]);

  // Filter allMatches to only show matches with AI predictions
  const matchesWithAI = useMemo(() => {
    if (!allMatches || allMatches.length === 0) return [];
    return allMatches.filter(m => aiMatchIds.has(m.id));
  }, [allMatches, aiMatchIds]);

  // Group matches by competition (same as other tabs)
  const groupedMatches = useMemo(() => {
    if (!matchesWithAI || matchesWithAI.length === 0) return [];

    const grouped = new Map<string, {
      competition: Competition | null;
      matches: Match[];
      countryName: string;
    }>();

    matchesWithAI.forEach((match) => {
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

    // Sort matches within each group by time
    grouped.forEach((group) => {
      group.matches.sort((a, b) => {
        const timeA = a.match_time || 0;
        const timeB = b.match_time || 0;
        return timeA - timeB;
      });
    });

    // Sort groups by country name then competition name
    return Array.from(grouped.entries())
      .sort((a, b) => {
        const countryCompare = a[1].countryName.localeCompare(b[1].countryName, 'tr');
        if (countryCompare !== 0) return countryCompare;
        const nameA = a[1].competition?.name || '';
        const nameB = b[1].competition?.name || '';
        return nameA.localeCompare(nameB, 'tr');
      })
      .map(([key, value]) => ({ key, ...value }));
  }, [matchesWithAI, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-12 h-12 border-3 border-gray-700 border-t-green-500 rounded-full animate-spin" />
        <span className="ml-3 text-gray-400">Maçlar yükleniyor...</span>
      </div>
    );
  }

  if (matchesWithAI.length === 0) {
    return (
      <div className="text-center p-12">
        <div className="text-4xl mb-4">🤖</div>
        <p className="text-gray-400 text-lg">Bu tarihte AI tahmini olan maç bulunamadı</p>
        <p className="text-gray-500 text-sm mt-2">
          Farklı bir tarih seçebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-blue-500/30">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <span className="text-blue-100 font-bold text-lg">
            AI TAHMİNLİ MAÇLAR
          </span>
          <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-sm font-bold">
            {matchesWithAI.length}
          </span>
          <span className="text-blue-300/70 text-sm">
            ({groupedMatches.length} lig)
          </span>
        </div>
      </div>

      {/* Match Groups */}
      {groupedMatches.map((group) => (
        <LeagueSection
          key={group.key}
          competition={group.competition}
          matches={group.matches}
          countryName={group.countryName}
          isTimeGroup={false}
          isCollapsed={false}
          onToggleCollapse={() => {}}
        />
      ))}
    </div>
  );
}

export default AIMatchesTab;
