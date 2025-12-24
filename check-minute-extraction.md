# Minute Extraction Check

## Current Implementation

1. **extractLiveFields** extracts minute from:
   - `root?.minute`
   - `root?.match_minute`
   - `root?.match?.minute`
   - `root?.match?.match_minute`

2. **Provider score array format**: `[match_id, status_id, home_scores[], away_scores[], update_time, ...]`
   - Minute is NOT in score array
   - Minute might be in root object separately

3. **reconcileMatchToDatabase** writes minute:
   - If provider supplies minute → writes it
   - If no minute from provider → clears it for HALF_TIME/END

## Problem
If provider doesn't supply minute in response, minute will be NULL. MatchMinuteWorker is disabled, so no calculation happens.

## Solution Needed
- Check if provider sends minute in detail_live response
- If yes, ensure it's extracted correctly
- If no, consider re-enabling MatchMinuteWorker OR calculate from kickoff timestamps
