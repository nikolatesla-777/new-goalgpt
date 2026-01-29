# Phase-3A.1: Alignment Fix Pack - Documentation

**Status:** ✅ Implementation Complete
**Branch:** `phase-3A/admin-panel-mvp` (updated)
**Date:** 2026-01-29
**Parent Phase:** Phase-3A Admin Panel MVP

---

## Overview

Phase-3A.1 is an alignment update that integrates Phase-3A admin panel with Week-2A's deterministic scoring pipeline. This update eliminates duplicate scoring logic and establishes Week-2A as the single source of truth for all scoring predictions.

**Key Changes:**
- ✅ Deprecated `/api/matches/:id/scoring-preview` endpoint (now proxies to Week-2A)
- ✅ Created `src/routes/admin.routes.ts` with ADMIN_API_KEY authentication
- ✅ Moved admin endpoints to separate route file (separation of concerns)
- ✅ Updated frontend to use Week-2A endpoint: `GET /api/matches/:id/scoring`
- ✅ Added comprehensive tests: `admin.routes.test.ts`
- ✅ Real Telegram integration (calls existing telegram publish endpoints)

---

## Architecture Changes

### Before Phase-3A.1

```
src/
├── services/
│   └── admin/
│       └── scoringPreview.service.ts    # Simplified scoring (duplicate logic)
├── routes/
│   └── scoring.routes.ts                # Mixed: scoring + admin endpoints
```

**Problems:**
- Duplicate scoring logic (Phase-3A simplified vs Week-2A deterministic)
- Admin endpoints mixed with scoring endpoints
- No authentication on admin endpoints
- Frontend using non-standard endpoint

### After Phase-3A.1

```
src/
├── routes/
│   ├── admin.routes.ts                  # NEW: Admin endpoints with ADMIN_API_KEY
│   └── scoring.routes.ts                # DEPRECATED: Proxies to Week-2A
└── routes/__tests__/
    └── admin.routes.test.ts             # NEW: Comprehensive tests
```

**Improvements:**
- Single source of truth: Week-2A scoring endpoint
- Clear separation: Admin routes separate from scoring routes
- Authentication: ADMIN_API_KEY header protection
- Standard endpoints: Frontend uses Week-2A directly

---

## API Changes

### 1. NEW: ADMIN_API_KEY Authentication

All admin endpoints now require authentication via header:

**Header:**
```
x-admin-api-key: <ADMIN_API_KEY from env>
```

**Responses:**

**Missing Header (401):**
```json
{
  "error": "Unauthorized",
  "message": "Missing x-admin-api-key header"
}
```

**Invalid Key (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid ADMIN_API_KEY"
}
```

### 2. MOVED: POST /api/admin/publish-with-audit

**Previous Location:** `/api/admin/publish-with-audit` (in scoring.routes.ts)
**New Location:** `/api/admin/publish-with-audit` (in admin.routes.ts)

**BREAKING CHANGE:** Now requires `x-admin-api-key` header

**Updated Request Body:**
```json
{
  "market_id": "O25",                    // Required: Market ID
  "match_ids": ["12345", "67890"],       // Required: Array of match IDs
  "locale": "tr",                        // Optional: tr|en (default: tr)
  "dry_run": false,                      // Optional: Test mode (default: false)
  "message_overrides": {                 // Optional: Override message parts
    "title": "Custom Title",
    "notes": "Custom notes"
  },
  "admin_user_id": "admin-username"      // Required: Admin identifier for audit
}
```

**Key Changes:**
- Now accepts array of `match_ids` instead of single match
- Calls real telegram endpoints (no longer mocked)
- Returns detailed status per match
- Persists audit log with telegram response

**Updated Response:**
```json
{
  "request_id": "uuid-v4",
  "market_id": "O25",
  "dry_run": false,
  "status": "sent",                      // sent | failed | dry_run_success
  "match_results": [
    {
      "match_id": "12345",
      "status": "sent",
      "telegram_message_id": "telegram-msg-123"
    },
    {
      "match_id": "67890",
      "status": "failed",
      "error": "Match not found"
    }
  ]
}
```

### 3. MOVED: GET /api/admin/publish-logs

**Previous Location:** `/api/admin/publish-logs` (in scoring.routes.ts)
**New Location:** `/api/admin/publish-logs` (in admin.routes.ts)

**BREAKING CHANGE:** Now requires `x-admin-api-key` header

**Updated Query Parameters:**
- `market_id` (optional): Filter by market
- `admin_user_id` (optional): Filter by admin user
- `status` (optional): Filter by status (sent|failed|dry_run_success)
- `limit` (optional): Max results (default: 100, max: 1000)
- `offset` (optional): Pagination offset (default: 0)

**Updated Response:**
```json
{
  "logs": [ /* array of log objects */ ],
  "total": 487,
  "limit": 100,
  "offset": 0
}
```

### 4. DEPRECATED: GET /api/matches/:fsMatchId/scoring-preview

**Status:** ⚠️ DEPRECATED - Will be removed after Week-2A merge

**Current Behavior:** Proxies to Week-2A endpoint

**Migration Path:**
```
OLD: GET /api/matches/:fsMatchId/scoring-preview
NEW: GET /api/matches/:fsMatchId/scoring?locale=tr
```

**Error When Week-2A Not Available (503):**
```json
{
  "error": "Week-2A scoring pipeline not available",
  "message": "The deterministic scoring system (Week-2A) has not been merged yet...",
  "week_2a_status": "NOT_MERGED",
  "fallback_note": "Phase-3A admin panel requires Week-2A scoring system to function."
}
```

---

## Frontend Changes

### MatchScoringAnalysis Component Update

**File:** `frontend/src/components/admin/MatchScoringAnalysis.tsx`

**Old Code:**
```typescript
const response = await fetch(
  `/api/matches/${fsMatchId}/scoring-preview`
);
```

**New Code:**
```typescript
// Phase-3A.1: Use Week-2A deterministic scoring endpoint
const response = await fetch(
  `/api/matches/${fsMatchId}/scoring?locale=tr`
);

if (response.status === 503) {
  // Week-2A not merged yet
  const errorData = await response.json();
  throw new Error(
    '⚠️ Week-2A Scoring Pipeline Not Available\n\n' +
    'The deterministic scoring system (Week-2A) has not been merged yet. ' +
    'This admin panel requires Week-2A to function properly.\n\n' +
    'Status: ' + (errorData.week_2a_status || 'NOT_MERGED')
  );
}
```

**User Experience:**
- Clear error message when Week-2A not available
- Links to Week-2A PR/documentation
- Automatic fallback when Week-2A is merged

---

## Configuration

### Environment Variables

**Backend (.env):**
```env
# NEW: Phase-3A.1 Admin Authentication
ADMIN_API_KEY=your-secure-admin-key-here

# Existing variables (unchanged)
DATABASE_URL=postgres://...
FOOTYSTATS_API_USER=...
FOOTYSTATS_API_SECRET=...
```

**Security Notes:**
- Generate strong random key: `openssl rand -base64 32`
- Never commit to git
- Rotate regularly
- Use different keys per environment (dev/staging/prod)

---

## Testing

### Test Suite: admin.routes.test.ts

**Coverage:**
```
✅ ADMIN_API_KEY Authentication
   ✓ Should reject request without header
   ✓ Should reject request with invalid key
   ✓ Should accept request with valid key

✅ POST /api/admin/publish-with-audit
   ✓ Should reject without market_id
   ✓ Should reject without admin_user_id
   ✓ Should reject invalid market_id
   ✓ Should handle DRY_RUN mode
   ✓ Should handle invalid match_id format
   ✓ Should call telegram endpoint for each match_id

✅ GET /api/admin/publish-logs
   ✓ Should return logs with default pagination
   ✓ Should filter logs by market_id
   ✓ Should filter logs by admin_user_id
   ✓ Should respect limit and offset parameters
   ✓ Should enforce max limit of 1000
```

**Run Tests:**
```bash
npm test src/routes/__tests__/admin.routes.test.ts
```

---

## Migration Guide

### For Developers

**1. Update Environment:**
```bash
# Add to .env
ADMIN_API_KEY=your-secure-key-here
```

**2. Update API Calls:**

If you have code calling admin endpoints, add header:
```typescript
fetch('/api/admin/publish-with-audit', {
  method: 'POST',
  headers: {
    'x-admin-api-key': process.env.ADMIN_API_KEY, // NEW
    'content-type': 'application/json'
  },
  body: JSON.stringify({ /* ... */ })
})
```

**3. Update Frontend Imports:**

No changes needed - MatchScoringAnalysis.tsx already updated

### For Admins

**1. Set ADMIN_API_KEY:**
```bash
# On VPS
export ADMIN_API_KEY="your-secure-key-here"

# Or in .env file
echo "ADMIN_API_KEY=your-secure-key-here" >> .env
```

**2. Restart Backend:**
```bash
npm run build
pm2 restart goalgpt
```

**3. Verify:**
```bash
# Test without key (should fail)
curl -X POST http://localhost:3000/api/admin/publish-with-audit

# Test with key (should succeed)
curl -X POST http://localhost:3000/api/admin/publish-with-audit \
  -H "x-admin-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"market_id":"O25","match_ids":["12345"],"admin_user_id":"test"}'
```

---

## Known Limitations

### 1. Week-2A Dependency

**Issue:** Admin panel requires Week-2A scoring endpoint to function

**Status:** Week-2A is in separate PR/branch

**Workaround:** scoring-preview endpoint shows clear error message (503) when Week-2A not available

**Timeline:** Once Week-2A is merged, admin panel will work automatically

### 2. ADMIN_API_KEY Security

**Current:** Simple shared secret authentication

**Limitation:**
- Single key for all admins (no granular permissions)
- No rate limiting
- No audit trail of which admin used which key

**Future (Phase-3B):**
- JWT-based authentication
- Role-based access control (RBAC)
- Per-admin API keys
- Rate limiting

---

## Files Changed

### New Files
```
src/routes/admin.routes.ts                  # 350 lines - Admin endpoints
src/routes/__tests__/admin.routes.test.ts   # 440 lines - Test suite
docs/PHASE-3A.1-ALIGNMENT-UPDATES.md        # This file
```

### Modified Files
```
src/routes/index.ts                         # +10 lines - Register admin routes
src/routes/scoring.routes.ts                # Refactored - Now proxies to Week-2A
frontend/src/components/admin/MatchScoringAnalysis.tsx  # Updated endpoint
```

### Deprecated Files
```
src/services/admin/scoringPreview.service.ts  # Will be removed after Week-2A merge
```

---

## Rollout Plan

### Phase 1: Development (Current)
- ✅ Implement changes on `phase-3A/admin-panel-mvp` branch
- ✅ Add tests
- ✅ Update documentation

### Phase 2: Testing (Next)
- [ ] Test with ADMIN_API_KEY in dev environment
- [ ] Verify Week-2A proxy behavior (503 error)
- [ ] Test real telegram publish flow with DRY_RUN

### Phase 3: Week-2A Merge (Dependency)
- [ ] Wait for Week-2A PR to be merged
- [ ] Verify Week-2A endpoint is live
- [ ] Test admin panel with real Week-2A scoring

### Phase 4: Production (After Week-2A)
- [ ] Set ADMIN_API_KEY on production server
- [ ] Deploy Phase-3A.1 to production
- [ ] Monitor audit logs
- [ ] Verify frontend shows scoring data correctly

---

## Support & Troubleshooting

### Issue: "Missing x-admin-api-key header"

**Cause:** ADMIN_API_KEY header not provided

**Solution:**
```typescript
fetch('/api/admin/publish-with-audit', {
  headers: {
    'x-admin-api-key': 'your-key-here'  // Add this
  }
})
```

### Issue: "Week-2A scoring pipeline not available"

**Cause:** Week-2A PR not merged yet

**Solution:** Wait for Week-2A merge, or use Week-2A branch locally for testing

### Issue: "Invalid ADMIN_API_KEY"

**Cause:** Wrong key or ADMIN_API_KEY not set in environment

**Solution:**
1. Check `.env` file has correct key
2. Restart backend after changing `.env`
3. Verify key matches between client and server

---

## Related Documentation

- [PHASE-3A-ADMIN-PANEL.md](./PHASE-3A-ADMIN-PANEL.md) - Original Phase-3A documentation
- [PHASE-3A-PROGRESS-REPORT.md](./PHASE-3A-PROGRESS-REPORT.md) - Implementation report
- Week-2A Documentation (link TBD after merge)

---

## Changelog

### Phase-3A.1 (2026-01-29)
- Added ADMIN_API_KEY authentication
- Created admin.routes.ts with separated admin endpoints
- Deprecated scoring-preview endpoint (proxies to Week-2A)
- Updated frontend to use Week-2A endpoint
- Added comprehensive test suite
- Real telegram integration (no longer mocked)

### Phase-3A (2026-01-29)
- Initial admin panel MVP
- Simplified scoring preview
- Audit logging
- DRY_RUN mode

---

**Author:** Phase-3A.1 Implementation Team
**Review Required:** Backend Lead, Frontend Lead
**Approval Required:** Release Captain

