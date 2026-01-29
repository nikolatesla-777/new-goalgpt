# PHASE-3B: ADMIN OPERATIONS - IMPLEMENTATION GUIDE

**Version:** 1.0
**Date:** 2026-01-29
**Status:** 🚧 IN PROGRESS (3B-1 COMPLETE)

---

## 📋 OVERVIEW

Phase-3B transforms the Admin Panel into a production-ready operational tool for Telegram publishing. This phase adds AI-powered features, bulk operations, image generation, and scheduling capabilities.

### Epic Breakdown

| Epic | Status | Description |
|------|--------|-------------|
| **3B-1** | ✅ COMPLETE | AI Match Summary (deterministic template-based) |
| **3B-2** | 🔜 NEXT | Bulk Publishing (daily list logic) |
| **3B-3** | 📋 PLANNED | Image Generation (match preview graphics) |
| **3B-4** | 📋 PLANNED | Scheduler / Auto-Publish (cron-based) |
| **3B-5** | 📋 PLANNED | Security/Permissions (role-based + IP allowlist) |

---

## 🎯 PHASE-3B.1: AI MATCH SUMMARY

### What It Does

Generates structured match summaries using:
- Week-2A scoring endpoint data (probability, confidence, markets)
- FootyStats data (xG, form, potentials)
- Deterministic template-based approach (LLM optional)
- Schema-validated output (TR/EN localization)

### API Endpoint

**POST /api/admin/ai-summary**

**Authentication:** Requires `x-admin-api-key` header

**Request:**
```json
{
  "match_id": "12345",
  "locale": "tr"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "match_id": "12345",
    "title": "Barcelona vs Real Madrid - La Liga Analysis",
    "key_angles": [
      {
        "icon": "⚡",
        "title": "High Scoring Potential",
        "description": "Both teams have high xG values (2.85). A goal-filled match is expected."
      }
    ],
    "bet_ideas": [
      {
        "market": "Over 2.5",
        "reason": "Over 2.5 goals recommended due to high xG and team form.",
        "confidence": 72
      }
    ],
    "disclaimer": "⚠️ This analysis is based on statistical data. Betting involves risk. Please bet responsibly.",
    "generated_at": "2026-01-29T19:30:00Z",
    "locale": "tr"
  }
}
```

### Schema Validation

All summary responses are validated against:
- Required fields: `match_id`, `title`, `key_angles`, `bet_ideas`, `disclaimer`, `generated_at`, `locale`
- Array constraints: 3-5 key angles, 2-4 bet ideas
- Confidence range: 0-100
- Locale: "tr" or "en"

### Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/types/aiSummary.types.ts` | TypeScript interfaces | 60 |
| `src/services/admin/aiSummaryFormatter.service.ts` | Core formatter logic | 350 |
| `src/routes/admin.routes.ts` | API endpoint | 130 |
| `src/routes/index.ts` | Route registration | +10 |

### Usage Example

```bash
# 1. Set ADMIN_API_KEY environment variable
export ADMIN_API_KEY="your-secret-key"

# 2. Call API
curl -X POST http://localhost:3000/api/admin/ai-summary \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: your-secret-key" \
  -d '{"match_id": "12345", "locale": "tr"}'
```

### Localization

**Turkish (TR):**
- Title template: "{home} vs {away} - {competition} Analizi"
- Key angles: "Yüksek Gol Potansiyeli", "Karşılıklı Gol", etc.
- Bet ideas: "Yüksek xG ve takım formu nedeniyle 2.5 üst gol öneriliyor."
- Disclaimer: "⚠️ Bu analiz istatistiksel verilere dayanır..."

**English (EN):**
- Title template: "{home} vs {away} - {competition} Analysis"
- Key angles: "High Scoring Potential", "Both Teams To Score", etc.
- Bet ideas: "Over 2.5 goals recommended due to high xG and team form."
- Disclaimer: "⚠️ This analysis is based on statistical data..."

### Deterministic Logic

The summary generation is **deterministic** (no LLM randomness):

1. **Key Angles Selection:**
   - High Scoring: `xg_total > 2.3`
   - BTTS: `btts_pct > 60`
   - Team Form: `ppg > 0`
   - Odds Value: `edge > 0.05`
   - Corners: `corners_avg > 9`

2. **Bet Ideas Selection:**
   - Over 2.5: `confidence >= 60`
   - BTTS: `confidence >= 60`
   - HT O0.5: `confidence >= 60`
   - Home O1.5: `confidence >= 60`

3. **Template-Based Output:**
   - Uses `LOCALE_STRINGS` dictionary
   - String interpolation with match data
   - No AI model calls (unless explicitly added later)

### Error Handling

| Error | Status Code | Message |
|-------|-------------|---------|
| Missing ADMIN_API_KEY | 500 | "ADMIN_API_KEY not configured" |
| Invalid API Key | 401 | "Invalid ADMIN_API_KEY" |
| Missing match_id | 400 | "match_id is required" |
| Invalid locale | 400 | "locale must be 'tr' or 'en'" |
| Week-2A not available | 503 | "Week-2A endpoint not available yet" |
| Schema validation failed | 200 (success: false) | "Schema validation failed: ..." |

---

## 🔐 AUTHENTICATION

### ADMIN_API_KEY

Phase-3B uses header-based API key authentication (separate from JWT):

**Setup:**
```bash
# .env file
ADMIN_API_KEY=your-secret-key-here
```

**Request Header:**
```
x-admin-api-key: your-secret-key-here
```

**Middleware:**
- Applied to all `/api/admin/*` routes
- Checks `x-admin-api-key` header
- Returns 401 if missing or invalid

### Security Notes

- ⚠️ **Production**: Use strong random key (32+ characters)
- ⚠️ **HTTPS Only**: Never send API key over HTTP
- ⚠️ **Rotation**: Change key periodically
- ⚠️ **Logging**: Avoid logging API key values

---

## 📊 PHASE-3B.2: BULK PUBLISHING (PLANNED)

### Overview

Enable bulk publishing of daily lists with filters:
- Market selection (O25, BTTS, etc.)
- Minimum confidence threshold
- Minimum probability threshold
- Maximum risk flags
- League limits
- Time range filters

### Workflow

```
1. Select Filters → 2. Preview Matches → 3. Bulk Publish → 4. Track Status
```

### API Endpoints (Planned)

```
POST /api/admin/bulk-publish
  - Input: {filters, matches[], dry_run}
  - Output: {published_count, failed_count, audit_log_ids}

GET /api/admin/bulk-status/:batch_id
  - Output: {status, progress, results[]}
```

---

## 📊 PHASE-3B.3: IMAGE GENERATION (PLANNED)

### Overview

Template-based match preview images:
- Team logos
- Market label
- Confidence badge
- Match time
- Disclaimer footer

### Tech Stack Options

1. **Canvas API** (Node.js)
2. **Sharp** (image processing)
3. **Puppeteer** (HTML → Image)

### API Endpoint (Planned)

```
POST /api/admin/generate-image
  - Input: {match_id, market_id, locale}
  - Output: {image_url, width, height}
```

---

## 📊 PHASE-3B.4: SCHEDULER / AUTO-PUBLISH (PLANNED)

### Overview

Cron job for automated publishing:
- Daily execution at specified time
- Market-based selection
- Dry-run report generation
- Conditional auto-publish
- Fail-safe: No publish if risk flags high

### Job Definition

```typescript
{
  name: 'Auto Telegram Publisher',
  schedule: '0 9 * * *', // Daily at 09:00 UTC
  handler: async () => {
    const candidates = await selectCandidates({
      min_confidence: 65,
      min_probability: 0.60,
      max_risk_flags: 2,
    });

    if (candidates.length > 0) {
      await publishWithAudit(candidates, { dry_run: false });
    }
  },
}
```

---

## 📊 PHASE-3B.5: SECURITY/PERMISSIONS (PLANNED)

### Overview

Enhanced security for production:
- Role-based access control (RBAC)
- IP allowlist
- Rate limiting
- Request validation
- Safe logging (no sensitive data)

### Implementation

```typescript
// Role-based permissions
enum AdminRole {
  VIEWER = 'viewer',     // Read-only
  PUBLISHER = 'publisher', // Publish rights
  ADMIN = 'admin',       // Full access
}

// IP allowlist
const ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
```

---

## 🧪 TESTING

### Unit Tests

**Location:** `src/services/admin/__tests__/aiSummaryFormatter.test.ts`

**Coverage:**
- ✅ Schema validation (valid/invalid cases)
- ✅ Key angles selection logic
- ✅ Bet ideas selection logic
- ✅ Localization (TR/EN)
- ✅ Error handling

**Run Tests:**
```bash
npm test src/services/admin/__tests__/aiSummaryFormatter.test.ts
```

### Integration Tests

**Smoke Test:**
```bash
# 1. Start server
npm run dev

# 2. Test AI summary endpoint
curl -X POST http://localhost:3000/api/admin/ai-summary \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: test-key" \
  -d '{"match_id": "test", "locale": "tr"}'
```

---

## 📦 DEPLOYMENT

### Environment Variables

```bash
# Required
ADMIN_API_KEY=your-secret-key-here

# Optional (for Week-2A integration)
WEEK_2A_ENDPOINT=http://localhost:3000/api/matches/:id/scoring
```

### Deployment Steps

1. **Set Environment Variables:**
   ```bash
   export ADMIN_API_KEY="$(openssl rand -hex 32)"
   ```

2. **Build:**
   ```bash
   npm run build
   ```

3. **Start:**
   ```bash
   npm start
   ```

4. **Verify:**
   ```bash
   curl http://localhost:3000/api/health
   ```

### Rollback Plan

If issues occur:
```bash
# 1. Revert to previous version
git checkout <previous-commit>

# 2. Rebuild
npm run build

# 3. Restart
pm2 restart goalgpt
```

---

## 📚 REFERENCES

- [Week-2A Scoring Endpoint](./WEEK-2A-STAGING-VERIFICATION.md)
- [FootyStats API Docs](./footystats/README.md)
- [Phase-3A Admin Panel](./PHASE-3A.1-ALIGNMENT-UPDATES.md)

---

**Last Updated:** 2026-01-29
**Author:** Claude (AI Assistant)
**Version:** 1.0
