# Status Transition Audit Report

**Date:** 2025-12-24  
**Audit:** Complete status transition logic review

## Summary

All status transitions are **provider-driven** (endpoint-based). No time-based auto-transitions exist.

---

## ✅ Status Transitions

### 1. NOT_STARTED (1) → FIRST_HALF (2)

**Source:** Provider endpoint (`/match/detail_live`, `/match/diary`, `/match/recent/list`)  
**Logic:**
- Provider sends `status_id=2` → Directly update DB
- `first_half_kickoff_ts` is set if NULL (line 447)
- No time-based check - **endpoint is source of truth**

**Status:** ✅ CORRECT

---

### 2. FIRST_HALF (2) → HALF_TIME (3)

**Source:** Provider endpoint  
**Logic:**
- Provider sends `status_id=3` → Directly update DB
- `minute` is set to NULL (line 513)
- No time-based check - **endpoint is source of truth**

**Status:** ✅ CORRECT

---

### 3. HALF_TIME (3) → SECOND_HALF (4)

**Source:** Provider endpoint  
**Logic:**
- Provider sends `status_id=4` → Directly update DB
- ~~**FIXED**: `second_half_kickoff_ts` is now set if NULL (regardless of previous status)~~ ✅
- Previous bug: Only set if `existingStatusId === 3` (would fail if HALF_TIME transition was missed)
- Now: Set if `second_half_kickoff_ts === null` (line 471) - **endpoint is source of truth**

**Status:** ✅ FIXED

---

### 4. SECOND_HALF (4) → OVERTIME (5)

**Source:** Provider endpoint  
**Logic:**
- Provider sends `status_id=5` → Directly update DB
- ~~**FIXED**: `overtime_kickoff_ts` is now set if NULL (regardless of previous status)~~ ✅
- Previous bug: Only set if `existingStatusId === 4` (would fail if SECOND_HALF transition was missed)
- Now: Set if `overtime_kickoff_ts === null` (line 481) - **endpoint is source of truth**

**Status:** ✅ FIXED

---

### 5. Any Status → END (8)

**Source:** Provider endpoint  
**Logic:**
- Provider sends `status_id=8` → Directly update DB
- `minute` is set to NULL (line 513)
- No time-based check - **endpoint is source of truth**
- No 150-minute safety check (removed - endpoint is authoritative)

**Status:** ✅ CORRECT

---

## 🔧 Key Fixes Applied

1. **Score Array Format Support** (`extractLiveFields`):
   - Added support for `score` array format: `[match_id, status_id, home_scores[], away_scores[], update_time, ...]`
   - Extracts `status_id` from `score[1]`
   - Extracts scores from `score[2][0]` and `score[3][0]`
   - Extracts `update_time` from `score[4]`

2. **SECOND_HALF Kickoff Timestamp**:
   - **Before**: Only set if transitioning from HALF_TIME (`existingStatusId === 3`)
   - **After**: Set if NULL (regardless of previous status) - provider says SECOND_HALF, set it

3. **OVERTIME Kickoff Timestamp**:
   - **Before**: Only set if transitioning from SECOND_HALF (`existingStatusId === 4`)
   - **After**: Set if NULL (regardless of previous status) - provider says OVERTIME, set it

---

## ✅ Architecture Principles

1. **Endpoint is Source of Truth**: All status transitions come from provider endpoints
2. **No Time-Based Checks**: Never auto-transition based on elapsed time
3. **Write-Once Timestamps**: Kickoff timestamps are set once (never overwritten if already set)
4. **Provider Minute Priority**: If provider supplies `minute`, use it; otherwise calculate or clear

---

## 🎯 Conclusion

All status transitions are **endpoint-driven** and **correctly implemented**. The fixes ensure that:
- Transitions work even if intermediate statuses were missed
- Provider data is always authoritative
- No time-based auto-transitions exist


