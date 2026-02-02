/**
 * Performance Calculation Utilities
 * Centralized performance metrics calculation for daily lists
 */

import type { DailyList } from '../api/types';

export interface PerformanceMetrics {
  total: number;
  won: number;
  lost: number;
  pending: number;
  void: number;
  winRate: number;
}

/**
 * Calculate performance metrics from a list of daily lists
 * @param lists - Array of daily lists
 * @returns Aggregated performance metrics
 */
export function calculatePerformance(lists: DailyList[]): PerformanceMetrics {
  let total = 0;
  let won = 0;
  let lost = 0;
  let pending = 0;
  let voidCount = 0;

  lists.forEach((list: DailyList) => {
    list.matches.forEach((match: any) => {
      if (match.result === 'won') {
        won++;
        total++;
      } else if (match.result === 'lost') {
        lost++;
        total++;
      } else if (match.result === 'void') {
        voidCount++;
      } else {
        pending++;
      }
    });
  });

  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

  return { total, won, lost, pending, void: voidCount, winRate };
}

/**
 * Calculate performance metrics from a single daily list
 * @param list - Single daily list
 * @returns Performance metrics for the list
 */
export function calculateListPerformance(list: DailyList): PerformanceMetrics {
  return calculatePerformance([list]);
}
