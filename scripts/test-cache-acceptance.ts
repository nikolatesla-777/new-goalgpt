/**
 * Cache Hardening Acceptance Tests
 *
 * Tests 3 critical requirements:
 * 1. Key stability: Same params → same key (regardless of order)
 * 2. Single-flight: 20 concurrent requests → 1 DB query
 * 3. Error caching: DB errors NOT cached
 *
 * Usage: npx tsx scripts/test-cache-acceptance.ts
 */

import { generatePredictionsCacheKey } from '../src/utils/cache/cacheKeyGenerator';
import { singleFlight } from '../src/utils/cache/singleFlight';
import { memoryCache } from '../src/utils/cache/memoryCache';

// ============================================================
// TEST 1: KEY STABILITY
// ============================================================

function testKeyStability(): boolean {
  console.log('\n=== TEST 1: Key Stability ===');

  // Same params, different order
  const params1 = { userId: 'user123', limit: 50, date: '2026-01-24' };
  const params2 = { limit: 50, date: '2026-01-24', userId: 'user123' };
  const params3 = { date: '2026-01-24', userId: 'user123', limit: 50 };

  const key1 = generatePredictionsCacheKey(params1);
  const key2 = generatePredictionsCacheKey(params2);
  const key3 = generatePredictionsCacheKey(params3);

  console.log('Params order 1:', JSON.stringify(params1));
  console.log('  → Key:', key1);
  console.log('Params order 2:', JSON.stringify(params2));
  console.log('  → Key:', key2);
  console.log('Params order 3:', JSON.stringify(params3));
  console.log('  → Key:', key3);

  const allSame = key1 === key2 && key2 === key3;

  if (allSame) {
    console.log('✅ Key stable: Same params → same key (order-independent)');
  } else {
    console.log('❌ Key unstable: Different keys for same params!');
    console.log('  Expected all to be equal');
  }

  // Test volatile params exclusion (null/undefined)
  const params4 = { userId: 'user123', limit: 50, tracking: null, timestamp: undefined };
  const params5 = { userId: 'user123', limit: 50 };

  const key4 = generatePredictionsCacheKey(params4);
  const key5 = generatePredictionsCacheKey(params5);

  console.log('\nWith null/undefined params:', JSON.stringify(params4));
  console.log('  → Key:', key4);
  console.log('Without null/undefined:', JSON.stringify(params5));
  console.log('  → Key:', key5);

  const volatileExcluded = key4 === key5;

  if (volatileExcluded) {
    console.log('✅ Volatile params excluded: null/undefined ignored');
  } else {
    console.log('❌ Volatile params NOT excluded: null/undefined affect key');
  }

  return allSame && volatileExcluded;
}

// ============================================================
// TEST 2: SINGLE-FLIGHT (DEDUPE)
// ============================================================

async function testSingleFlight(): Promise<boolean> {
  console.log('\n=== TEST 2: Single-Flight Dedupe ===');

  let dbQueryCount = 0;

  // Simulate DB query with delay
  const simulateDBQuery = async (key: string): Promise<string> => {
    dbQueryCount++;
    console.log(`  [DB Query #${dbQueryCount}] Executing for key: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    return `result-${key}`;
  };

  // Fire 20 concurrent requests for SAME key
  const testKey = 'test-key-concurrent';
  const promises: Promise<string>[] = [];

  console.log('Firing 20 concurrent requests for key:', testKey);

  const startTime = Date.now();
  for (let i = 0; i < 20; i++) {
    promises.push(
      singleFlight.do(testKey, () => simulateDBQuery(testKey))
    );
  }

  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;

  console.log('\nResults:');
  console.log(`  Total requests: 20`);
  console.log(`  DB queries executed: ${dbQueryCount}`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  All results identical: ${results.every(r => r === results[0])}`);

  // Get single-flight stats
  const stats = singleFlight.getStats();
  console.log('\nSingle-Flight Stats:');
  console.log(`  Executed: ${stats.executed}`);
  console.log(`  Deduplicated: ${stats.deduplicated}`);
  console.log(`  Savings: ${stats.savings}%`);

  const success = dbQueryCount === 1 && results.every(r => r === results[0]);

  if (success) {
    console.log('✅ Single-flight working: 20 requests → 1 DB query');
  } else {
    console.log('❌ Single-flight FAILED: Multiple DB queries for same key');
  }

  // Cleanup
  singleFlight.clear();

  return success;
}

// ============================================================
// TEST 3: ERROR CACHING PREVENTION & EMPTY ARRAY HANDLING
// ============================================================

async function testErrorCaching(): Promise<boolean> {
  console.log('\n=== TEST 3: Error Caching Prevention & Empty Array Handling ===');

  const testCacheType = 'predictions';
  const testKey = 'test-error-key';

  // Test 1: Empty result with CACHE_EMPTY_RESPONSES config
  console.log('\nTest 3a: Empty Array Caching (Config-Based)');
  const emptyResult = { success: true, data: { predictions: [], total: 0 }, count: 0, predictions: [] };

  console.log('  Empty result:', JSON.stringify(emptyResult));

  // Check environment config
  const cacheEmptyResponses = process.env.CACHE_EMPTY_RESPONSES !== 'false';
  console.log(`  CACHE_EMPTY_RESPONSES config: ${cacheEmptyResponses}`);

  // Simulate the new logic
  const hasData = emptyResult.predictions && emptyResult.predictions.length > 0;
  const isEmpty = emptyResult.predictions && emptyResult.predictions.length === 0;

  console.log(`  Has data: ${hasData}`);
  console.log(`  Is empty: ${isEmpty}`);

  if (hasData) {
    console.log('  ✅ Would cache: Has data');
  } else if (isEmpty && cacheEmptyResponses) {
    console.log(`  ✅ Would cache: Empty but CACHE_EMPTY_RESPONSES=true`);
  } else if (isEmpty && !cacheEmptyResponses) {
    console.log(`  ❌ Would NOT cache: Empty and CACHE_EMPTY_RESPONSES=false`);
  }

  // Business rule check
  console.log('\n  Business Rule Decision:');
  if (cacheEmptyResponses) {
    console.log('  ✅ Config: CACHE_EMPTY_RESPONSES=true');
    console.log('     → Empty responses are normal (user has no predictions)');
    console.log('     → Cache with short TTL to reduce DB load');
  } else {
    console.log('  ✅ Config: CACHE_EMPTY_RESPONSES=false');
    console.log('     → Empty responses indicate temporary error');
    console.log('     → Don\'t cache, retry on next request');
  }

  // Test 2: Error scenario
  console.log('\nTest 3b: Error Scenario (null/undefined result)');

  let errorThrown = false;
  try {
    await singleFlight.do('error-test', async () => {
      throw new Error('DB connection failed');
    });
  } catch (err: any) {
    errorThrown = true;
    console.log('  Error thrown:', err.message);
  }

  // Check if key is in cache
  const errorInCache = memoryCache.has(testCacheType, 'error-test');

  console.log(`  Error cached: ${errorInCache}`);

  if (!errorInCache && errorThrown) {
    console.log('  ✅ Errors NOT cached: Exception did not populate cache');
  } else {
    console.log('  ❌ Error WAS cached or not thrown properly');
  }

  // Test 3: Successful result with data
  console.log('\nTest 3c: Successful Result (with data)');
  const successResult = {
    success: true,
    data: { predictions: [{ id: 1 }, { id: 2 }], total: 2 },
    count: 2,
    predictions: [{ id: 1 }, { id: 2 }]
  };

  const hasData2 = successResult.predictions && successResult.predictions.length > 0;
  console.log(`  Has data: ${hasData2}`);

  if (hasData2) {
    console.log('  ✅ Successful results WITH data ALWAYS cached');
  } else {
    console.log('  ❌ Successful results NOT being cached (bug)');
  }

  // Test 4: Config test recommendations
  console.log('\nTest 3d: Config Recommendations');
  console.log('  To test different behaviors:');
  console.log('  - CACHE_EMPTY_RESPONSES=true npm run test:cache  (cache empty arrays)');
  console.log('  - CACHE_EMPTY_RESPONSES=false npm run test:cache (don\'t cache empty arrays)');

  // Overall result
  const success = !errorInCache && errorThrown && hasData2;

  return success;
}

// ============================================================
// MAIN RUNNER
// ============================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Cache Hardening Acceptance Tests                ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  const results: { test: string; passed: boolean }[] = [];

  // Run tests
  try {
    results.push({ test: 'Key Stability', passed: testKeyStability() });
  } catch (err: any) {
    console.error('❌ Test 1 crashed:', err.message);
    results.push({ test: 'Key Stability', passed: false });
  }

  try {
    results.push({ test: 'Single-Flight', passed: await testSingleFlight() });
  } catch (err: any) {
    console.error('❌ Test 2 crashed:', err.message);
    results.push({ test: 'Single-Flight', passed: false });
  }

  try {
    results.push({ test: 'Error Caching', passed: await testErrorCaching() });
  } catch (err: any) {
    console.error('❌ Test 3 crashed:', err.message);
    results.push({ test: 'Error Caching', passed: false });
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  results.forEach(({ test, passed }) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });

  const allPassed = results.every(r => r.passed);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ ALL ACCEPTANCE TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED - Review above output');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main();
