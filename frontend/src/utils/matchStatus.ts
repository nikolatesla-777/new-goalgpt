/**
 * Match Status Utilities
 */

export const MatchState = {
  ABNORMAL: 0,
  NOT_STARTED: 1,
  FIRST_HALF: 2,
  HALF_TIME: 3,
  SECOND_HALF: 4,
  OVERTIME: 5,
  OVERTIME_DEPRECATED: 6,
  PENALTY_SHOOTOUT: 7,
  END: 8,
  DELAY: 9,
  INTERRUPT: 10,
  CUT_IN_HALF: 11,
  CANCEL: 12,
  TO_BE_DETERMINED: 13,
} as const;

export function isLiveMatch(status: number): boolean {
  return status >= MatchState.FIRST_HALF && status <= MatchState.PENALTY_SHOOTOUT;
}

export function isFinishedMatch(status: number): boolean {
  return status === MatchState.END;
}

export function getMatchStatusText(status: number): string {
  switch (status) {
    case MatchState.NOT_STARTED:
      return 'Başlamadı';
    case MatchState.FIRST_HALF:
      return '1. Yarı';
    case MatchState.HALF_TIME:
      return 'Devre Arası';
    case MatchState.SECOND_HALF:
      return '2. Yarı';
    case MatchState.OVERTIME:
      return 'Uzatmalar';
    case MatchState.PENALTY_SHOOTOUT:
      return 'Penaltılar';
    case MatchState.END:
      return 'Bitti';
    case MatchState.DELAY:
      return 'Ertelendi';
    case MatchState.INTERRUPT:
      return 'Yarıda Kesildi';
    case MatchState.CANCEL:
      return 'İptal';
    default:
      return 'Bilinmiyor';
  }
}

/**
 * Format match time from UTC timestamp to local time
 * CRITICAL: TheSports API returns UTC timestamps, we must convert to user's local time
 */
export function formatMatchTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Tarih yok';
  
  // Create date from UTC timestamp (seconds to milliseconds)
  const date = new Date(timestamp * 1000);
  
  // Use browser's local timezone (automatic conversion)
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Check if match time is in the future (relative to user's local time)
 * CRITICAL: Used to validate match status - future matches cannot be "Ended"
 */
export function isMatchInFuture(timestamp: number): boolean {
  if (!timestamp || timestamp <= 0) return false;
  const matchDate = new Date(timestamp * 1000);
  const now = new Date();
  return matchDate > now;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Phase 4-4: Frontend is a pure renderer - no minute calculations.
 * Backend provides `minute_text` directly. This helper is kept only as a fallback
 * for edge cases where minute_text might be missing (defensive programming).
 * 
 * @deprecated Phase 4-4: Prefer backend `minute_text` field. This is fallback only.
 */
export function formatMatchMinute(minute: number | null, status: number): string {
  // Phase 4-4: This is a pure formatter, NOT a calculator.
  // It only formats existing minute values, never calculates from time.
  
  if (minute === null) return '—';
  
  // Status-specific labels (no time calculation)
  if (status === MatchState.HALF_TIME) {
    return 'HT';
  }

  if (status === MatchState.END) {
    return 'FT';
  }

  if (status === MatchState.OVERTIME) {
    return 'ET';
  }

  if (status === MatchState.PENALTY_SHOOTOUT) {
    return 'PEN';
  }
  
  // Format existing minute value (no calculation)
  if (status === MatchState.FIRST_HALF && minute > 45) {
    return '45+';
  } else if (status === MatchState.SECOND_HALF && minute > 90) {
    return '90+';
  } else if (status === MatchState.OVERTIME && minute > 120) {
    return '120+';
  }
  
  return `${minute}'`;
}
