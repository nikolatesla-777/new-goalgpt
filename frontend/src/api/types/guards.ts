/**
 * Type Guards for API Response Validation
 * Provides runtime type checking to replace unsafe type assertions
 */

import type { DailyListsResponse, DailyListsRangeResponse } from '../types';

export interface DateData {
  date: string;
  lists_count: number;
  lists: any[];
}

export function isDailyListsResponse(data: unknown): data is DailyListsResponse {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as any;
  return (
    'lists' in obj &&
    Array.isArray(obj.lists) &&
    (obj.generated_at === undefined || typeof obj.generated_at === 'string' || typeof obj.generated_at === 'number')
  );
}

export function isRangeResponse(data: unknown): data is DailyListsRangeResponse {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as any;
  return (
    'success' in obj &&
    'data' in obj &&
    Array.isArray(obj.data)
  );
}

export function isDateDataArray(data: unknown): data is DateData[] {
  if (!Array.isArray(data)) return false;

  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    'date' in item &&
    'lists' in item &&
    Array.isArray(item.lists)
  );
}
