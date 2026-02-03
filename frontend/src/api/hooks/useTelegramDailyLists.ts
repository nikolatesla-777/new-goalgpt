/**
 * React Query hooks for Telegram Daily Lists
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTelegramDailyListsToday,
  getTelegramDailyListsRange,
  publishTelegramDailyList,
  publishTelegramDailyListPhoto,
  publishAllTelegramDailyLists,
  regenerateTelegramDailyLists,
} from '../client';
import type {
  TelegramPublishRequest,
} from '../types';
import { toast } from '../../utils/toast';

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
    staleTime: 30000, // 30 seconds (was 0)
    gcTime: 5 * 60 * 1000, // 5 minutes (was 0)
    refetchOnMount: true, // Only on initial mount (was 'always')
    refetchOnWindowFocus: false, // Disable (was true)
    refetchInterval: false, // Disable polling (was 60000)
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
    onSuccess: (_data, variables) => {
      // Invalidate today's lists to refresh telegram_message_id
      queryClient.invalidateQueries({
        queryKey: telegramQueryKeys.dailyListsToday(),
      });
      toast.success(`${variables.market} listesi başarıyla yayınlandı!`);
    },
    onError: (error: Error, variables) => {
      toast.error(`${variables.market} yayınlanırken hata oluştu`, error);
    },
  });
}

/**
 * Hook to publish a single daily list as PHOTO
 */
export function usePublishDailyListPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      market,
      caption,
    }: {
      market: string;
      caption?: string;
    }) => publishTelegramDailyListPhoto(market, caption),
    onSuccess: (_data, variables) => {
      // Invalidate today's lists to refresh telegram_message_id
      queryClient.invalidateQueries({
        queryKey: telegramQueryKeys.dailyListsToday(),
      });
      toast.success(`${variables.market} görsel olarak başarıyla yayınlandı! 🖼️`);
    },
    onError: (error: Error, variables) => {
      toast.error(`${variables.market} görsel yayınlanırken hata oluştu`, error);
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
      toast.success('Listeler başarıyla yayınlandı!');
    },
    onError: (error: Error) => {
      toast.error('Listeler yayınlanırken hata oluştu', error);
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
      toast.success('Listeler başarıyla yenilendi!');
    },
    onError: (error: Error) => {
      toast.error('Listeler yenilenirken hata oluştu', error);
    },
  });
}
