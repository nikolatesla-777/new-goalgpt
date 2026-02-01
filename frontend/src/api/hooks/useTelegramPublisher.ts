/**
 * React Query hooks for Telegram Publisher
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTodaysMatches,
  publishToTelegram,
  getTelegramHealth,
} from '../telegram';

// ============================================================================
// Query Keys
// ============================================================================

export const telegramPublisherQueryKeys = {
  all: ['telegram', 'publisher'] as const,
  matches: (date?: string) => [...telegramPublisherQueryKeys.all, 'matches', date] as const,
  health: () => [...telegramPublisherQueryKeys.all, 'health'] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch today's matches for Telegram publishing
 */
export function useTodaysMatches(date?: string) {
  return useQuery({
    queryKey: telegramPublisherQueryKeys.matches(date),
    queryFn: () => getTodaysMatches(date),
    staleTime: 1000 * 60 * 2, // 2 minutes (matches data changes frequently)
  });
}

/**
 * Hook to fetch Telegram bot health status
 */
export function useTelegramHealth() {
  return useQuery({
    queryKey: telegramPublisherQueryKeys.health(),
    queryFn: getTelegramHealth,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook to publish a match to Telegram
 */
export function usePublishToTelegram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fsMatchId, matchId, picks }: { fsMatchId: number; matchId: string; picks: Array<{ market_type: string; odds?: number }> }) =>
      publishToTelegram(fsMatchId, matchId, picks),
    onSuccess: () => {
      // Invalidate matches query to refresh published status
      queryClient.invalidateQueries({
        queryKey: telegramPublisherQueryKeys.all,
      });

      // Also invalidate daily lists if they exist
      queryClient.invalidateQueries({
        queryKey: ['telegram', 'daily-lists'],
      });
    },
  });
}
