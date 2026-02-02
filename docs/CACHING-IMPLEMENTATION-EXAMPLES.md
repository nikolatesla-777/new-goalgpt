# CACHING IMPLEMENTATION EXAMPLES

**Purpose**: Practical examples for adding Redis caching to endpoints
**Related**: PR-P1D (Caching + Index Optimization)
**Date**: 2026-02-02

---

## OVERVIEW

This document provides **copy-paste ready** examples for adding Redis caching to various endpoint types in the GoalGPT application.

**Prerequisites**:
- Redis server running (localhost:6379 or REDIS_URL set)
- `src/utils/cache.ts` available (from PR-P1D)
- `src/config/features.ts` available (from PR-P1D)
- `ioredis` package installed

---

## EXAMPLE 1: SIMPLE GET ENDPOINT (Standings)

### Before (No Caching)

```typescript
// src/routes/admin/standings.routes.ts

import { FastifyInstance } from 'fastify';
import { pool } from '../../database/connection';

export async function adminStandingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/standings/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };
    const { view = 'overall' } = request.query as { view?: string };

    try {
      // Expensive database query (300-800ms)
      const standings = await fetchStandingsFromDB(competitionId, view);

      return reply.send(standings);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
```

### After (With Caching)

```typescript
// src/routes/admin/standings.routes.ts

import { FastifyInstance } from 'fastify';
import { pool } from '../../database/connection';
import { getCache, CACHE_TTL } from '../../utils/cache';
import { FEATURE_FLAGS } from '../../config/features';

export async function adminStandingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/standings/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };
    const { view = 'overall' } = request.query as { view?: string };

    try {
      // PR-P1D: Check if caching is enabled
      if (FEATURE_FLAGS.USE_REDIS_CACHE && FEATURE_FLAGS.CACHE_STANDINGS) {
        const cache = getCache();
        const cacheKey = `standings:${competitionId}:${view}`;

        const { data, fromCache } = await cache.getOrFetch(
          cacheKey,
          CACHE_TTL.STANDINGS,  // 5 minutes
          async () => {
            // Expensive database query (only on cache miss)
            return await fetchStandingsFromDB(competitionId, view);
          }
        );

        return reply.send({
          ...data,
          fromCache,  // ✅ Tell frontend if cached
        });
      }

      // Legacy path (no caching)
      const standings = await fetchStandingsFromDB(competitionId, view);
      return reply.send(standings);

    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
```

**Key Changes**:
1. Import `getCache`, `CACHE_TTL`, `FEATURE_FLAGS`
2. Wrap expensive operation in `cache.getOrFetch()`
3. Add `fromCache` field to response
4. Keep legacy path for rollback

**Result**:
- Cache MISS: 800ms (first request)
- Cache HIT: <50ms (subsequent requests)
- Hit rate: >80% after warmup

---

## EXAMPLE 2: DYNAMIC QUERY PARAMS (H2H)

### Scenario

Endpoint with multiple query parameters that affect cache key.

```typescript
// src/controllers/match.controller.ts

import { getCache, CACHE_TTL } from '../utils/cache';
import { FEATURE_FLAGS } from '../config/features';

export async function getMatchH2H(request: any, reply: any) {
  const { match_id } = request.params;
  const { limit = 10 } = request.query;

  try {
    // PR-P1D: Cache H2H data (rarely changes)
    if (FEATURE_FLAGS.USE_REDIS_CACHE && FEATURE_FLAGS.CACHE_H2H) {
      const cache = getCache();

      // ✅ Include query params in cache key
      const cacheKey = `h2h:${match_id}:limit${limit}`;

      const { data, fromCache } = await cache.getOrFetch(
        cacheKey,
        CACHE_TTL.H2H,  // 1 hour (historical data)
        async () => {
          // Fetch from database or API
          const h2hData = await fetchH2HData(match_id, limit);
          return h2hData;
        }
      );

      return reply.send({
        match_id,
        h2h: data,
        fromCache,
      });
    }

    // Legacy path
    const h2hData = await fetchH2HData(match_id, limit);
    return reply.send({ match_id, h2h: h2hData });

  } catch (error: any) {
    return reply.status(500).send({ error: error.message });
  }
}
```

**Key Points**:
- Include all query params in cache key (`limit${limit}`)
- Use longer TTL for historical data (1 hour)
- Different limits = different cache entries

---

## EXAMPLE 3: LIVE DATA WITH SHORT TTL (Match Details)

### Scenario

Live match data that changes frequently - use short TTL.

```typescript
// src/services/thesports/match/matchDetailLive.service.ts

import { getCache, CACHE_TTL } from '../../../utils/cache';
import { FEATURE_FLAGS } from '../../../config/features';

export class MatchDetailLiveService {
  async getMatchDetailLive(matchId: string): Promise<any> {
    // PR-P1D: Cache with SHORT TTL for live matches
    if (FEATURE_FLAGS.USE_REDIS_CACHE && FEATURE_FLAGS.CACHE_MATCH_DETAILS) {
      const cache = getCache();
      const cacheKey = `match:detail:${matchId}`;

      const { data, fromCache } = await cache.getOrFetch(
        cacheKey,
        CACHE_TTL.MATCH_DETAILS,  // 30 seconds (live data)
        async () => {
          // Expensive API call to TheSports
          const matchData = await this.theSportsAPI.getMatchDetailLive(matchId);
          return matchData;
        }
      );

      return { ...data, _fromCache: fromCache };
    }

    // Legacy path
    return await this.theSportsAPI.getMatchDetailLive(matchId);
  }
}
```

**Key Points**:
- Short TTL (30 seconds) for live data
- Still provides 30-second relief for API rate limits
- Reduces duplicate requests from multiple users

---

## EXAMPLE 4: CACHE INVALIDATION (After Sync Job)

### Scenario

Manually invalidate cache after data sync/update.

```typescript
// src/jobs/standingsAutoSync.job.ts

import { getCache } from '../utils/cache';
import { logger } from '../utils/logger';

export async function syncStandings(competitionId: string) {
  try {
    // 1. Sync standings from API
    const newStandings = await theSportsAPI.getStandings(competitionId);

    // 2. Save to database
    await db
      .insertInto('ts_standings')
      .values({ competition_id: competitionId, standings: newStandings })
      .onConflict((oc) => oc.column('competition_id').doUpdateSet({ standings: newStandings }))
      .execute();

    // 3. PR-P1D: Invalidate cached standings
    const cache = getCache();
    await cache.invalidatePattern(`standings:${competitionId}:*`);

    logger.info(`✅ Synced and invalidated cache for competition ${competitionId}`);

  } catch (error: any) {
    logger.error(`Failed to sync standings: ${error.message}`);
    throw error;
  }
}
```

**Key Points**:
- Invalidate cache AFTER database update succeeds
- Use `invalidatePattern()` to clear all related cache entries
- Pattern `standings:${competitionId}:*` clears overall/home/away views

---

## EXAMPLE 5: CONDITIONAL CACHING (User-Specific Data)

### Scenario

Don't cache user-specific responses - only cache shared data.

```typescript
// src/routes/user.routes.ts

export async function getUserPredictions(request: any, reply: any) {
  const { user_id } = request.params;
  const { match_id } = request.query;

  try {
    // ❌ DON'T cache user-specific data
    // Each user has different predictions, caching would leak data
    const predictions = await db
      .selectFrom('customer_predictions')
      .where('customer_user_id', '=', user_id)
      .where('match_id', '=', match_id)
      .execute();

    return reply.send({ user_id, predictions });

  } catch (error: any) {
    return reply.status(500).send({ error: error.message });
  }
}
```

**Key Points**:
- User-specific data should NOT be cached (privacy/correctness)
- Cache only shared, public data (standings, H2H, match details)

---

## EXAMPLE 6: CACHE WITH ERROR FALLBACK

### Scenario

Gracefully handle Redis connection failures.

```typescript
// src/routes/admin/standings.routes.ts

export async function getStandings(request: any, reply: any) {
  const { competitionId } = request.params;

  try {
    if (FEATURE_FLAGS.USE_REDIS_CACHE && FEATURE_FLAGS.CACHE_STANDINGS) {
      const cache = getCache();

      try {
        const { data, fromCache } = await cache.getOrFetch(
          `standings:${competitionId}`,
          CACHE_TTL.STANDINGS,
          async () => await fetchStandingsFromDB(competitionId)
        );

        return reply.send({ ...data, fromCache });

      } catch (cacheError: any) {
        // ✅ Redis error - log and fallback to DB
        logger.warn(`[Cache] Failed to fetch from cache: ${cacheError.message}`);
        // Fall through to direct DB fetch below
      }
    }

    // Direct DB fetch (legacy path OR cache error fallback)
    const standings = await fetchStandingsFromDB(competitionId);
    return reply.send({ ...standings, fromCache: false });

  } catch (error: any) {
    return reply.status(500).send({ error: error.message });
  }
}
```

**Key Points**:
- Try-catch inside caching block
- Fallback to direct DB query if Redis fails
- Log cache errors for debugging
- Application continues working even if Redis is down

---

## EXAMPLE 7: BATCH CACHE INVALIDATION

### Scenario

Invalidate multiple cache entries after batch operation.

```typescript
// src/jobs/matchWatchdog.job.ts

export async function updateLiveMatches(matchIds: string[]) {
  try {
    // 1. Update all matches in database
    await Promise.all(
      matchIds.map((id) => updateMatchInDB(id))
    );

    // 2. PR-P1D: Batch invalidate cache
    const cache = getCache();

    // Approach 1: Invalidate specific matches
    for (const matchId of matchIds) {
      await cache.invalidate(`match:detail:${matchId}`);
    }

    // Approach 2: Invalidate all match details (nuclear option)
    // await cache.invalidatePattern('match:detail:*');

    logger.info(`✅ Updated ${matchIds.length} matches and invalidated cache`);

  } catch (error: any) {
    logger.error(`Failed to update matches: ${error.message}`);
    throw error;
  }
}
```

**Key Points**:
- Invalidate cache for each updated entity
- Consider using pattern invalidation for bulk operations
- Balance between precision and performance

---

## EXAMPLE 8: ADMIN CACHE CLEAR ENDPOINT

### Scenario

Allow admins to manually clear cache.

```typescript
// src/routes/admin/cache.routes.ts

import { FastifyInstance } from 'fastify';
import { getCache } from '../../utils/cache';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware';

export async function adminCacheRoutes(fastify: FastifyInstance) {
  /**
   * DELETE /api/admin/cache/:pattern
   * Clear cache entries matching pattern
   *
   * SECURITY: Admin-only endpoint
   *
   * Examples:
   * - DELETE /api/admin/cache/standings:*
   * - DELETE /api/admin/cache/h2h:12345:*
   */
  fastify.delete('/api/admin/cache/:pattern', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request, reply) => {
    const { pattern } = request.params as { pattern: string };

    try {
      const cache = getCache();
      await cache.invalidatePattern(pattern);

      return reply.send({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/admin/cache/all
   * Clear ALL cache entries
   *
   * SECURITY: Admin-only endpoint
   * WARNING: Use with extreme caution - clears entire cache
   */
  fastify.delete('/api/admin/cache/all', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request, reply) => {
    try {
      const cache = getCache();
      await cache.clear();

      return reply.send({
        success: true,
        message: 'All cache entries cleared',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/admin/cache/stats
   * Get Redis cache statistics
   *
   * SECURITY: Admin-only endpoint
   */
  fastify.get('/api/admin/cache/stats', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request, reply) => {
    try {
      const cache = getCache();
      const stats = await cache.getStats();

      return reply.send({
        success: true,
        stats,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
}
```

---

## CACHE KEY NAMING CONVENTIONS

### Best Practices

```typescript
// ✅ GOOD: Hierarchical, readable, predictable
`standings:${competitionId}:${view}`              // standings:39:overall
`h2h:${matchId}:limit${limit}`                     // h2h:12345:limit10
`match:detail:${matchId}`                          // match:detail:12345
`team:info:${teamId}`                              // team:info:789
`league:fixtures:${leagueId}:date${date}`          // league:fixtures:39:date2026-02-02

// ❌ BAD: Flat, cryptic, unpredictable
`std_39_ov`  // What is this?
`match12345` // Match what? Detail? H2H?
`cache_123`  // Meaningless
```

### Pattern Matching

```typescript
// Clear all standings for competition 39
await cache.invalidatePattern('standings:39:*');

// Clear all match details
await cache.invalidatePattern('match:detail:*');

// Clear all H2H data
await cache.invalidatePattern('h2h:*');
```

---

## TTL RECOMMENDATIONS

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Standings | 5 minutes | Updates frequently during match days |
| H2H | 1 hour | Historical data, rarely changes |
| Match Details (Live) | 30 seconds | Live data needs freshness |
| Match Details (Ended) | 1 hour | Historical data |
| Team Info | 24 hours | Rarely changes |
| League Info | 24 hours | Rarely changes |
| Player Info | 24 hours | Rarely changes |
| Fixtures | 1 hour | Schedule rarely changes |

---

## MONITORING & DEBUGGING

### Check Cache Hit Rate

```bash
# Redis CLI
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Calculate hit rate
# hit_rate = keyspace_hits / (keyspace_hits + keyspace_misses)
```

### View Cached Keys

```bash
# List all keys
redis-cli KEYS "goalgpt:*"

# List standings keys
redis-cli KEYS "goalgpt:standings:*"

# Count keys
redis-cli DBSIZE
```

### Test Cache Manually

```bash
# First request (cache MISS)
time curl -s http://localhost:3000/api/admin/standings/39 | jq '.fromCache'
# Expected: false, ~800ms

# Second request (cache HIT)
time curl -s http://localhost:3000/api/admin/standings/39 | jq '.fromCache'
# Expected: true, ~50ms
```

### Clear Cache for Testing

```bash
# Clear specific pattern
redis-cli DEL $(redis-cli KEYS "goalgpt:standings:*")

# Clear all cache
redis-cli FLUSHDB
```

---

## ROLLBACK

### Disable Caching Instantly

```bash
# Disable all caching
export USE_REDIS_CACHE=false
pm2 restart goalgpt-api

# Disable specific endpoint caching
export CACHE_STANDINGS=false
pm2 restart goalgpt-api
```

### Verify Caching Disabled

```bash
curl -s http://localhost:3000/api/admin/standings/39 | jq '.fromCache'
# Expected: field not present (undefined) or false
```

---

## PERFORMANCE COMPARISON

### Before Caching

```
GET /api/admin/standings/39
Response Time: 800ms
Database Queries: 3
CPU Usage: Medium
```

### After Caching (Cache HIT)

```
GET /api/admin/standings/39
Response Time: 45ms  (94% faster ✅)
Database Queries: 0
CPU Usage: Minimal
```

### After Caching (Cache MISS)

```
GET /api/admin/standings/39
Response Time: 850ms  (50ms cache overhead)
Database Queries: 3
CPU Usage: Medium
Cache Write: 50ms
```

**Typical Hit Rate**: 80-95% after warmup period

---

## COMMON PITFALLS

### ❌ Pitfall 1: Caching User-Specific Data

```typescript
// BAD: Leaks user data between users
const cacheKey = `predictions:${match_id}`;  // Same key for all users!
```

**Fix**: Don't cache user-specific data, OR include user_id in key:
```typescript
const cacheKey = `predictions:${user_id}:${match_id}`;  // Unique per user
```

### ❌ Pitfall 2: Too Long TTL for Live Data

```typescript
// BAD: 1 hour TTL for live match data
CACHE_TTL.MATCH_DETAILS: 3600  // Stale data for live matches
```

**Fix**: Use short TTL for frequently changing data:
```typescript
CACHE_TTL.MATCH_DETAILS: 30  // 30 seconds
```

### ❌ Pitfall 3: Forgetting Cache Invalidation

```typescript
// BAD: Update database but forget to clear cache
await updateStandings(competitionId);
// Cache still has old data for 5 minutes!
```

**Fix**: Always invalidate after updates:
```typescript
await updateStandings(competitionId);
await cache.invalidatePattern(`standings:${competitionId}:*`);
```

### ❌ Pitfall 4: Not Handling Redis Failures

```typescript
// BAD: Cache error breaks entire endpoint
const { data } = await cache.getOrFetch(...);  // Throws if Redis down
```

**Fix**: Use try-catch with fallback:
```typescript
try {
  const { data } = await cache.getOrFetch(...);
  return data;
} catch (err) {
  // Fallback to direct DB query
  return await fetchFromDB();
}
```

---

## NEXT STEPS

1. **Start with One Endpoint**: Implement caching for standings first
2. **Monitor Performance**: Track cache hit rate, response times
3. **Tune TTL**: Adjust TTL based on actual data change frequency
4. **Expand Gradually**: Add caching to more endpoints after validation
5. **Monitor Redis**: Track memory usage, connection count

---

**Last Updated**: 2026-02-02
**Related Documents**:
- `docs/PR-P1D-CACHING-INDEXES.md` - Full PR-P1D documentation
- `src/utils/cache.ts` - Redis cache utility implementation
- `src/config/features.ts` - Feature flags configuration

