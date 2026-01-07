/**
 * Match Minute Text Generator
 *
 * Generates UI-friendly minute display text from backend minute value and status.
 * This is a pure function for display formatting only; it does NOT calculate minutes.
 *
 * Phase 3C: Frontend no longer calculates minutes. This helper formats backend-provided minute values.
 * Phase 6: Enhanced injury time support (45+2', 90+3' format)
 */

/**
 * Minute text result with metadata for advanced UI rendering
 */
export interface MinuteTextResult {
  text: string;           // Display text: "45+2'", "HT", "90+3'"
  isInjuryTime: boolean;  // true if showing injury time
  phase: 'PRE' | 'FH' | 'HT' | 'SH' | 'ET' | 'PEN' | 'FT' | 'OTHER';
  rawMinute: number | null;
}

/**
 * Status mapping (TheSports):
 * 1 = NOT_STARTED
 * 2 = FIRST_HALF
 * 3 = HALF_TIME
 * 4 = SECOND_HALF
 * 5 = OVERTIME
 * 7 = PENALTY_SHOOTOUT
 * 8 = END
 * 9 = DELAY
 * 10 = INTERRUPT
 */

/**
 * Generate minute text for display (simple string version)
 * Phase 4-4: Contract enforcement - minute_text is always a string (never null)
 * Phase 6: Enhanced injury time display (45+2', 90+3')
 *
 * @param minute - Backend-calculated minute value (from ts_matches.minute, nullable)
 * @param statusId - Match status ID (TheSports format)
 * @returns Display string (HT/45+2'/90+3'/FT/etc.)
 */
export function generateMinuteText(
  minute: number | null,
  statusId: number
): string {
  return generateMinuteTextDetailed(minute, statusId).text;
}

/**
 * Generate minute text with full metadata
 * Use this when you need phase info or injury time detection
 *
 * @param minute - Backend-calculated minute value
 * @param statusId - Match status ID
 * @returns MinuteTextResult with text, phase, and injury time info
 */
export function generateMinuteTextDetailed(
  minute: number | null,
  statusId: number
): MinuteTextResult {
  // Status-specific labels (always shown regardless of minute)
  switch (statusId) {
    case 1: // NOT_STARTED
      return { text: '—', isInjuryTime: false, phase: 'PRE', rawMinute: null };

    case 3: // HALF_TIME
      return { text: 'HT', isInjuryTime: false, phase: 'HT', rawMinute: 45 };

    case 8: // END
      return { text: 'FT', isInjuryTime: false, phase: 'FT', rawMinute: 90 };

    case 7: // PENALTY_SHOOTOUT
      return { text: 'PEN', isInjuryTime: false, phase: 'PEN', rawMinute: minute };

    case 9: // DELAY
      return { text: 'DELAY', isInjuryTime: false, phase: 'OTHER', rawMinute: minute };

    case 10: // INTERRUPT
      return { text: 'INT', isInjuryTime: false, phase: 'OTHER', rawMinute: minute };

    case 12: // CANCEL
      return { text: 'CAN', isInjuryTime: false, phase: 'OTHER', rawMinute: null };
  }

  // For live statuses, minute value is required
  if (minute === null) {
    return { text: '—', isInjuryTime: false, phase: 'OTHER', rawMinute: null };
  }

  // FIRST_HALF (status 2)
  if (statusId === 2) {
    if (minute > 45) {
      // Injury time: 45+X' format (e.g., 47 -> "45+2'")
      const injuryMinutes = minute - 45;
      return {
        text: `45+${injuryMinutes}'`,
        isInjuryTime: true,
        phase: 'FH',
        rawMinute: minute
      };
    }
    return { text: `${minute}'`, isInjuryTime: false, phase: 'FH', rawMinute: minute };
  }

  // SECOND_HALF (status 4)
  if (statusId === 4) {
    if (minute > 90) {
      // Injury time: 90+X' format (e.g., 93 -> "90+3'")
      const injuryMinutes = minute - 90;
      return {
        text: `90+${injuryMinutes}'`,
        isInjuryTime: true,
        phase: 'SH',
        rawMinute: minute
      };
    }
    return { text: `${minute}'`, isInjuryTime: false, phase: 'SH', rawMinute: minute };
  }

  // OVERTIME (status 5)
  if (statusId === 5) {
    if (minute > 105) {
      // Extra time injury: 105+X' format
      const injuryMinutes = minute - 105;
      return {
        text: `105+${injuryMinutes}'`,
        isInjuryTime: true,
        phase: 'ET',
        rawMinute: minute
      };
    }
    if (minute > 90) {
      // Normal extra time: show as is (91-105)
      return { text: `${minute}'`, isInjuryTime: false, phase: 'ET', rawMinute: minute };
    }
    // First period of extra time (shouldn't happen but handle gracefully)
    return { text: `ET ${minute}'`, isInjuryTime: false, phase: 'ET', rawMinute: minute };
  }

  // Default: show minute with apostrophe
  return { text: `${minute}'`, isInjuryTime: false, phase: 'OTHER', rawMinute: minute };
}

