/**
 * Match Minute Text Generator
 * 
 * Generates UI-friendly minute display text from backend minute value and status.
 * This is a pure function for display formatting only; it does NOT calculate minutes.
 * 
 * Phase 3C: Frontend no longer calculates minutes. This helper formats backend-provided minute values.
 */

/**
 * Generate minute text for display
 * 
 * @param minute - Backend-calculated minute value (from ts_matches.minute, nullable)
 * @param statusId - Match status ID (TheSports format)
 * @returns Display string (HT/45+/90+/FT/etc.) or null
 * 
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
 * Phase 4-4: Contract enforcement - minute_text is always a string (never null)
 */
export function generateMinuteText(
  minute: number | null,
  statusId: number
): string {
  // Phase 4-4: Contract - always return string, use "—" if unavailable
  // Status-specific labels MUST win even if minute is null
  // These labels are always shown regardless of minute value
  if (statusId === 3) return 'HT';   // HALF_TIME
  if (statusId === 8) return 'FT';   // END
  if (statusId === 5) return 'ET';   // OVERTIME
  if (statusId === 7) return 'PEN';  // PENALTY_SHOOTOUT
  if (statusId === 9) return 'DELAY'; // DELAY
  if (statusId === 10) return 'INT'; // INTERRUPT

  // For other statuses, minute value is required
  if (minute === null) {
    return '—'; // Phase 4-4: Contract - never return null, use "—" instead
  }

  // Injury time indicators (require minute > threshold)
  // 45th minute shows "45'", 46th+ shows "45+"
  if (statusId === 2 && minute > 45) return '45+'; // FIRST_HALF
  // 90th minute shows "90'", 91st+ shows "90+"
  if (statusId === 4 && minute > 90) return '90+'; // SECOND_HALF

  // Default: show minute with apostrophe
  return `${minute}'`;
}

