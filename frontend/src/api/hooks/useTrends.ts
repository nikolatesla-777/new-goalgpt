/**
 * React Query hooks for Trends Analysis
 */

import { useQuery } from '@tanstack/react-query';
import { getTrendsAnalysis } from '../client';

// ============================================================================
// Query Keys
// ============================================================================

export const trendsQueryKeys = {
  all: ['trends'] as const,
  analysis: () => [...trendsQueryKeys.all, 'analysis'] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch trends analysis
 */
export function useTrendsAnalysis() {
  return useQuery({
    queryKey: trendsQueryKeys.analysis(),
    queryFn: getTrendsAnalysis,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}
