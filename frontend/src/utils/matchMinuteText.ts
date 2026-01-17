/**
 * Match Minute Text Generator (Frontend)
 *
 * Generates UI-friendly minute display text from backend minute value and status.
 * This is a pure function for display formatting only; it does NOT calculate minutes.
 *
 * Phase 6 Fix: Frontend copy of backend utility to generate minute_text on WebSocket updates
 */

/**
 * Generate minute text for display
 *
 * @param minute - Backend-calculated minute value (from ts_matches.minute, nullable)
 * @param statusId - Match status ID (TheSports format)
 * @returns Display string (HT/45+2'/90+3'/FT/etc.)
 */
export function generateMinuteText(
  minute: number | null,
  statusId: number
): string {
  // Status-specific labels (always shown regardless of minute)
  switch (statusId) {
    case 1: // NOT_STARTED
      return '—';

    case 3: // HALF_TIME
      return 'HT';

    case 8: // END
      return 'FT';

    case 7: // PENALTY_SHOOTOUT
      return 'PEN';

    case 9: // DELAY
      return 'DELAY';

    case 10: // INTERRUPT
      return 'INT';

    case 12: // CANCEL
      return 'CAN';
  }

  // For live statuses, minute value is required
  if (minute === null) {
    return '—';
  }

  // FIRST_HALF (status 2)
  if (statusId === 2) {
    if (minute > 45) {
      // Injury time: 45+X' format (e.g., 47 -> "45+2'")
      const injuryMinutes = minute - 45;
      return `45+${injuryMinutes}'`;
    }
    return `${minute}'`;
  }

  // SECOND_HALF (status 4)
  if (statusId === 4) {
    if (minute > 90) {
      // Injury time: 90+X' format (e.g., 93 -> "90+3'")
      const injuryMinutes = minute - 90;
      return `90+${injuryMinutes}'`;
    }
    return `${minute}'`;
  }

  // OVERTIME (status 5)
  if (statusId === 5) {
    if (minute > 105) {
      // Extra time injury: 105+X' format
      const injuryMinutes = minute - 105;
      return `105+${injuryMinutes}'`;
    }
    if (minute > 90) {
      // Normal extra time: show as is (91-105)
      return `${minute}'`;
    }
    // First period of extra time (shouldn't happen but handle gracefully)
    return `ET ${minute}'`;
  }

  // Default: show minute with apostrophe
  return `${minute}'`;
}
