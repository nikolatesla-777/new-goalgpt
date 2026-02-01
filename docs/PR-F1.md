# PR-F1: Canonical Contracts + Normalizer

**Status**: ✅ READY FOR REVIEW
**Branch**: `feature/canonical-snapshot-pr-f1`
**Base**: `refactor/menu-registry-2026w05`
**Created**: 2026-01-30

---

## Summary

Introduce canonical data contracts and normalization layer for FootyStats API responses. This is **Phase 1 of 4** in building a stable AI Generator input pipeline.

**Changes**:
- Define `RawFootyStatsMatch` type (raw API shape)
- Define `CanonicalMatchSnapshot` type (our internal contract)
- Implement normalizer with null→undefined conversion and missing field tracking
- Add 10 unit tests covering normalization logic
- **ZERO behavior change** (no endpoint modifications)

**Test Results**:
- TypeScript errors: 0 ✅
- Tests: 173/173 PASS ✅ (10 new tests added)
- Behavior: ZERO change ✅

---

## Files Added/Changed

### New Files (4)

1. **`src/types/footystats.raw.ts`** (115 lines)
   - Raw FootyStats API response types
   - Reflects actual API payload structure
   - All fields nullable (as API may return)

2. **`src/types/matchSnapshot.ts`** (181 lines)
   - Canonical match snapshot contract (our internal standard)
   - Versioned (schema_version: 1)
   - All nulls converted to undefined
   - Missing field tracking
   - Data completeness scoring

3. **`src/services/mapping/footystatsNormalizer.ts`** (285 lines)
   - Normalizes raw API → canonical snapshot
   - Null → undefined conversion
   - Type validation (ensure numbers are numbers)
   - Missing field tracking
   - Data completeness calculation (0-100 score)

4. **`src/services/mapping/__tests__/footystatsNormalizer.test.ts`** (346 lines)
   - 10 unit tests
   - Coverage: basic structure, null handling, form data, missing fields, validation
   - All tests passing ✅

### Modified Files

None (zero behavior change)

---

## Type Contracts

### RawFootyStatsMatch

Reflects actual FootyStats API response:
```typescript
interface RawFootyStatsMatch {
  id: number;
  homeID: number;
  awayID: number;
  home_name: string;
  away_name: string;
  status: string;
  date_unix: number;
  btts_potential?: number | null;      // May be null from API
  o25_potential?: number | null;
  team_a_xg_prematch?: number | null;
  // ... 20+ more fields
  h2h?: { /* deeply nested */ } | null;
}
```

### CanonicalMatchSnapshot

Our internal contract (stable, versioned):
```typescript
interface CanonicalMatchSnapshot {
  ids: {
    fs_match_id: number;
    home_team_id: number;
    away_team_id: number;
  };
  time: {
    match_date_unix: number;
    status: string;
    captured_at_unix: number;
  };
  teams: {
    home_name: string;
    away_name: string;
    competition_name?: string;        // undefined, never null
  };
  stats: {
    form: { /* ... */ };
    h2h?: { /* ... */ };              // Optional, but never null
    xg: { home?: number; away?: number; };
    potentials: { btts?: number; /* ... */ };
  };
  meta: {
    schema_version: number;            // Current: 1
    source_version: string;
    missing_fields: string[];          // Track what was null/missing
    confidence: {
      data_completeness: number;       // 0-100 score
      has_form_data: boolean;
      has_h2h_data: boolean;
      has_xg_data: boolean;
    };
  };
}
```

---

## Normalizer Logic

### Null → Undefined Conversion

**Rule**: All optional fields use `undefined` (never `null`)

```typescript
// Before (raw API)
{
  btts_potential: null,
  team_a_xg_prematch: null
}

// After (canonical)
{
  potentials: {
    btts: undefined  // Not present in JSON
  },
  xg: {
    home: undefined
  }
}
```

### Missing Field Tracking

```typescript
const snapshot = normalizeFootyStatsMatch(rawMatch);

snapshot.meta.missing_fields;
// Example: ['potentials.btts', 'xg.home', 'h2h.avg_goals']

snapshot.meta.confidence.data_completeness;
// Example: 72 (out of 100)
```

### Data Completeness Scoring

- Start at 100
- Deduct 10 points per critical field missing (max -70)
  - Critical: xg.home, xg.away, potentials.btts, potentials.over25, form data, h2h
- Deduct 2 points per non-critical field (max -30)
- Minimum: 0

---

## Test Coverage

### Test Suite Summary
```
Test Suites: 1 passed
Tests:       10 passed
Time:        0.352 s
```

### Tests Breakdown

1. **Basic Structure**
   - ✅ Normalize minimal match data
   - ✅ Normalize match with full data

2. **Null Handling**
   - ✅ Convert null → undefined for optional fields
   - ✅ Handle deeply nested nulls in H2H

3. **Form Data**
   - ✅ Normalize home form data
   - ✅ Handle missing form data gracefully

4. **Missing Fields Tracking**
   - ✅ Track missing critical fields
   - ✅ Calculate high completeness with full data

5. **Validation**
   - ✅ Validate correct snapshot
   - ✅ Detect missing required fields

---

## Verification Commands

### TypeScript Compilation
```bash
$ npx tsc --noEmit
(No output - clean compilation)

$ npx tsc --noEmit | grep "^src/" | wc -l
0
```
**Result**: ✅ Zero TypeScript errors

### Test Suite
```bash
$ npm test

Test Suites: 10 passed, 10 total
Tests:       173 passed, 173 total
Time:        8.707 s
```
**Result**: ✅ 173/173 tests pass (10 new tests added)

### Normalizer-Specific Tests
```bash
$ npm test -- footystatsNormalizer.test.ts

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        0.352 s
```
**Result**: ✅ All normalizer tests pass

---

## Behavior Verification

### No Endpoint Changes
- ✅ Zero existing endpoints modified
- ✅ No route changes
- ✅ No response payload changes
- ✅ No database schema changes

### Code Scope
- ✅ Only new files added (4 files)
- ✅ No modifications to existing services
- ✅ No dependencies added
- ✅ No console.log statements

---

## Next Steps (PR-F2)

This PR establishes contracts only. Next phase:

1. **PR-F2**: Implement mapper behind feature flag
   - Add `footystatsToSnapshot.ts` mapper
   - Feature flag: `FEATURE_CANONICAL_SNAPSHOT` (default: false)
   - No endpoint behavior change when flag OFF

2. **PR-F3**: Persistence + observability
   - Storage layer for snapshots
   - Admin endpoint: `GET /admin/mapping/snapshot/:fsMatchId`
   - Metrics: mapping_success_total, mapping_latency_ms

3. **PR-F4**: Enable in staging + validation
   - Turn on flag in staging
   - Validation checklist
   - Production rollout

---

## Rollback Plan

```bash
git revert HEAD --no-edit
npm test  # Verify: 163/163 pass (back to baseline)
```

**Recovery Time**: <2 minutes
**Impact**: Zero (only new files added)

---

## Merge Checklist

- ✅ TypeScript errors: 0
- ✅ Tests: 173/173 PASS
- ✅ Behavior change: ZERO
- ✅ No endpoint modifications
- ✅ No database changes
- ✅ No new dependencies
- ✅ Documentation complete
- ✅ Rollback plan ready

**Status**: ✅ READY FOR MERGE

---

**Base Branch**: `refactor/menu-registry-2026w05`
**Merge Strategy**: Squash merge recommended
**Rollback**: `git revert <commit>`
