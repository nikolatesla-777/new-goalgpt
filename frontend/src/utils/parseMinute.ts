/**
 * Parse minute_text to extract numeric minute value
 * Handles formats like "26'", "64'", "HT", "45+", "90+", "FT", etc.
 */
export function parseMinuteFromText(minuteText: string | null | undefined, status: number): number | null {
    if (!minuteText || minuteText === '—' || minuteText === '-') {
        return null;
    }

    // Handle special status-based cases
    if (status === 3) { // HALF_TIME
        return 45;
    }

    if (status === 8) { // END
        return null; // For finished matches, we don't limit trend data
    }

    // Parse "26'", "64'", etc.
    const match = minuteText.match(/^(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }

    // Handle "45+", "90+" - use the base minute (45 or 90)
    const plusMatch = minuteText.match(/(\d+)\+/);
    if (plusMatch) {
        return parseInt(plusMatch[1], 10);
    }

    // Handle "HT" (half time) - return 45
    if (minuteText === 'HT' || minuteText === 'ht') {
        return 45;
    }

    // Handle "FT" (full time) - return null (show all data for finished matches)
    if (minuteText === 'FT' || minuteText === 'ft') {
        return null;
    }

    return null;
}

