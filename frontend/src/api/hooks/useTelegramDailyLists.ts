/**
 * React Query hooks for Telegram Daily Lists
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTelegramDailyListsToday,
  getTelegramDailyListsRange,
  publishTelegramDailyList,
  publishAllTelegramDailyLists,
  regenerateTelegramDailyLists,
} from '../client';
import type {
  TelegramPublishRequest,
} from '../types';

// ============================================================================
// Query Keys
// ============================================================================

export const telegramQueryKeys = {
  all: ['telegram'] as const,
  dailyLists: () => [...telegramQueryKeys.all, 'daily-lists'] as const,
  dailyListsToday: () => [...telegramQueryKeys.dailyLists(), 'today'] as const,
  dailyListsRange: (start: string, end: string) =>
    [...telegramQueryKeys.dailyLists(), 'range', start, end] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch today's daily lists
 */
export function useTelegramDailyListsToday() {
  return useQuery({
    queryKey: telegramQueryKeys.dailyListsToday(),
    queryFn: getTelegramDailyListsToday,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch daily lists for a date range
 */
export function useTelegramDailyListsRange(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: telegramQueryKeys.dailyListsRange(start, end),
    queryFn: () => getTelegramDailyListsRange(start, end),
    enabled: enabled && !!start && !!end,
    staleTime: 1000 * 60 * 10, // 10 minutes (historical data doesn't change often)
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook to publish a single daily list
 */
export function usePublishDailyList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      market,
      options,
    }: {
      market: string;
      options?: TelegramPublishRequest;
    }) => publishTelegramDailyList(market, options),
    onSuccess: () => {
      // Invalidate today's lists to refresh telegram_message_id
      queryClient.invalidateQueries({
        queryKey: telegramQueryKeys.dailyListsToday(),
      });
    },
  });
}

/**
 * Hook to publish all daily lists
 */
export function usePublishAllDailyLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: TelegramPublishRequest) =>
      publishAllTelegramDailyLists(options),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: telegramQueryKeys.dailyListsToday(),
      });
    },
  });
}

/**
 * Hook to regenerate today's daily lists
 */
export function useRegenerateDailyLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: regenerateTelegramDailyLists,
    onSuccess: () => {
      // Invalidate all daily lists queries
      queryClient.invalidateQueries({
        queryKey: telegramQueryKeys.dailyLists(),
      });
    },
  });
}
