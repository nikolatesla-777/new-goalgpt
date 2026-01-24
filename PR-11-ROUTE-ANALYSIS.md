# PR-11: Route De-duplication Analysis
**Date**: 2026-01-24
**Status**: Analysis Complete - Ready for Implementation

---

## 🎯 OBJECTIVE

Controlled deprecation of 5 duplicate/legacy routes with:
- Backward compatibility (zero breaking changes)
- Deprecation headers on legacy routes
- Single source of truth (canonical handlers)
- Rate-limited logging (no noise)

---

## 📋 DUPLICATE ROUTES IDENTIFIED

### 1. Prediction Ingest (Legacy v1)

**Legacy Route**: `POST /api/v1/ingest/predictions`
- Location: `src/routes/prediction.routes.ts:173`
- Handler: Inline async function
- Purpose: Backward compatibility with external systems

**Canonical Route**: `POST /api/predictions/ingest`
- Location: `src/routes/prediction.routes.ts:113`
- Handler: Same logic (aiPredictionService.ingestPrediction)
- Response: Modern format

**Differences**:
- Legacy returns: `{ type: 'legacy', count: 1, message: string, ... }`
- Canonical returns: `{ success: boolean, prediction_id: string, ... }`

**Migration Path**: Response format wrapper - canonical handler + legacy response formatter

---

### 2. Legacy Auth: Login

**Legacy Route**: `POST /api/auth/legacy/login`
- Location: `src/routes/auth.routes.ts:241`
- Handler: `legacyLogin` (legacyAuth.controller.ts)
- Purpose: Phone + password authentication (old mobile app)

**Canonical Route**: `POST /api/auth/phone/login`
- Location: `src/routes/auth.routes.ts:127`
- Handler: `phoneLogin` (phoneAuth.controller.ts)
- Modern: Uses Firebase Auth + OTP

**Differences**:
- Legacy: Phone + password (bcrypt)
- Canonical: Phone + OTP (Firebase)

**Migration Path**: Legacy route stays functional (password-based users exist), add deprecation headers

---

### 3. Legacy Auth: Check User

**Legacy Route**: `POST /api/auth/legacy/check`
- Location: `src/routes/auth.routes.ts:255`
- Handler: `checkLegacyUser` (legacyAuth.controller.ts)
- Purpose: Check if phone number has password-based account

**Canonical Route**: Not a direct equivalent (auth flow handles this internally)
- Standard flow: Try OAuth → fallback to phone/login → check credentials

**Migration Path**: Keep functional, add deprecation headers (used by old app versions)

---

### 4. Legacy Auth: Migrate to OAuth

**Legacy Route**: `POST /api/auth/legacy/migrate-oauth`
- Location: `src/routes/auth.routes.ts:274`
- Handler: `migrateToOAuth` (legacyAuth.controller.ts)
- Purpose: Link Google/Apple to legacy password account

**Canonical Route**: OAuth signin endpoints handle this implicitly
- `POST /api/auth/google/signin`
- `POST /api/auth/apple/signin`

**Migration Path**: Keep functional (migration still needed for old accounts), add deprecation headers

---

### 5. Match Analysis (Old H2H Endpoint)

**Legacy Route**: `GET /api/matches/:match_id/analysis`
- Location: `src/routes/match.routes.ts:130`
- Handler: `getMatchAnalysis` (match.controller.ts:939)
- Purpose: Get H2H data via /match/analysis API

**Canonical Route**: `GET /api/matches/:match_id/h2h`
- Location: `src/routes/match.routes.ts:136`
- Handler: `getMatchH2H` (match.controller.ts:1607)
- Modern: Database-first with API fallback

**Differences**:
- Legacy: Direct API call (slow, no caching)
- Canonical: DB-first (97% faster), API fallback for NOT_STARTED matches

**Migration Path**: Legacy route calls canonical handler, adds deprecation headers

---

## 📊 ROUTE MAPPING TABLE

| # | Legacy Route | Canonical Route | Status | Breaking? |
|---|-------------|----------------|--------|-----------|
| 1 | `POST /api/v1/ingest/predictions` | `POST /api/predictions/ingest` | Active | No (response wrapper) |
| 2 | `POST /api/auth/legacy/login` | `POST /api/auth/phone/login` | Active | No (different auth method) |
| 3 | `POST /api/auth/legacy/check` | (Internal auth flow) | Active | No (no direct replacement) |
| 4 | `POST /api/auth/legacy/migrate-oauth` | OAuth signin endpoints | Active | No (migration needed) |
| 5 | `GET /api/matches/:match_id/analysis` | `GET /api/matches/:match_id/h2h` | Active | No (same data shape) |

---

## 🔧 IMPLEMENTATION STRATEGY

### Pattern 1: Response Wrapper (Route #1)
```typescript
// Legacy endpoint
fastify.post('/api/v1/ingest/predictions', async (request, reply) => {
  // Call canonical handler
  const canonicalResult = await aiPredictionService.ingestPrediction(request.body);

  // Add deprecation headers
  addDeprecationHeaders(reply, {
    canonical: '/api/predictions/ingest',
    sunset: '2026-03-01',
    docs: 'https://docs.goalgpt.app/api/predictions/ingest'
  });

  // Wrap response in legacy format
  return {
    type: 'legacy',
    count: 1,
    message: canonicalResult.success ? 'Prediction received' : canonicalResult.error,
    success: canonicalResult.success,
    prediction_id: canonicalResult.predictionId,
    match_found: canonicalResult.matchFound
  };
});
```

### Pattern 2: Direct Redirect (Routes #2-4)
```typescript
// Legacy auth endpoints - keep functional, add headers
fastify.post('/api/auth/legacy/login', async (request, reply) => {
  addDeprecationHeaders(reply, {
    canonical: '/api/auth/phone/login',
    sunset: '2026-04-01',
    docs: 'https://docs.goalgpt.app/api/auth/migration'
  });

  // Original handler (password auth still needed)
  return legacyLogin(request, reply);
});
```

### Pattern 3: Handler Redirect (Route #5)
```typescript
// Legacy match analysis - redirect to canonical H2H handler
fastify.get('/:match_id/analysis', async (request, reply) => {
  addDeprecationHeaders(reply, {
    canonical: `/api/matches/${request.params.match_id}/h2h`,
    sunset: '2026-02-28',
    docs: 'https://docs.goalgpt.app/api/matches/h2h'
  });

  // Call canonical handler directly
  return getMatchH2H(request, reply);
});
```

---

## 📝 DEPRECATION HEADER SPEC

All legacy routes will return these headers:

```http
Deprecation: true
Sunset: <ISO 8601 date>
Link: <canonical-url>; rel="alternate"
X-Deprecation-Message: This endpoint is deprecated. Use <canonical> instead.
```

**Example**:
```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: 2026-03-01T00:00:00Z
Link: /api/predictions/ingest; rel="alternate"
X-Deprecation-Message: This endpoint is deprecated. Use POST /api/predictions/ingest instead.
```

---

## 🔍 RATE-LIMITED LOGGING

**Problem**: Deprecation logs can flood production logs if endpoint is high-traffic

**Solution**: Rate-limited deprecation logger

```typescript
const deprecationLogCache = new Map<string, number>();
const LOG_RATE_LIMIT_MS = 60000; // 1 minute

function logDeprecation(routePath: string, clientIp: string) {
  const cacheKey = `${routePath}:${clientIp}`;
  const lastLog = deprecationLogCache.get(cacheKey) || 0;
  const now = Date.now();

  if (now - lastLog > LOG_RATE_LIMIT_MS) {
    logger.info(`[Deprecation] Route ${routePath} accessed by ${clientIp}`, {
      route: routePath,
      ip: clientIp,
      timestamp: new Date().toISOString()
    });
    deprecationLogCache.set(cacheKey, now);
  }
}
```

---

## 🚀 DEPLOYMENT PLAN

### Phase 1: Implementation (PR-11)
1. Create deprecation helper utilities
2. Update 5 legacy routes with deprecation headers
3. Add rate-limited logging
4. No breaking changes

### Phase 2: Monitoring (2 weeks)
1. Track deprecation header usage via metrics
2. Identify clients still using legacy endpoints
3. Contact affected clients (if any)

### Phase 3: Sunset (2-3 months)
1. After sunset date, return 410 Gone
2. Keep handlers for 1 more month (error only)
3. Full removal after 4 months

---

## ✅ VERIFICATION CHECKLIST

- [ ] All 5 legacy routes identified
- [ ] Canonical routes documented
- [ ] Deprecation headers spec finalized
- [ ] Rate-limited logging implemented
- [ ] Backward compatibility verified
- [ ] Sunset dates set (30-90 days)
- [ ] Smoke tests written
- [ ] Documentation updated

---

## 📊 IMPACT ANALYSIS

### Breaking Changes
**NONE** - All legacy routes remain functional with deprecation headers

### Performance Impact
**Minimal** - Deprecation headers add ~50 bytes per response

### Client Impact
**Low** - Clients see deprecation headers in responses, can migrate at their own pace

### Maintenance Impact
**Positive** - Single source of truth reduces maintenance burden

---

## 🎓 KEY DECISIONS

### Why Keep Legacy Routes?
1. **Backward Compatibility**: External systems may depend on legacy endpoints
2. **Gradual Migration**: Give clients time to migrate (30-90 days)
3. **Safe Rollback**: If issues arise, can remove deprecation headers

### Why Not Direct Removal?
1. **Unknown Clients**: Can't identify all external systems using legacy endpoints
2. **Mobile Apps**: Old app versions in production can't be force-updated
3. **API Contracts**: Some clients may have SLAs expecting these endpoints

### Sunset Timeline
- **30 days**: Low-risk routes (internal use only)
- **60 days**: Medium-risk routes (known external clients)
- **90 days**: High-risk routes (unknown external clients, mobile apps)

---

**Analysis Complete**: Ready for implementation ✅
