/**
 * Test Cache Match Detail
 * 
 * Tests that ended match data is correctly cached and retrievable
 */

import 'dotenv/config';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../services/cache/cache.types';

async function testCacheMatchDetail() {
  logger.info('🧪 Testing Cache Match Detail...\n');
  const client = await pool.connect();
  try {
    // 1. Find a recently ended match with complete data
    const matchResult = await client.query(`
      SELECT 
        external_id,
        match_time,
        status_id,
        statistics,
        incidents,
        trend_data,
        player_stats
      FROM ts_matches 
      WHERE status_id = 8
        AND match_time >= EXTRACT(EPOCH FROM NOW()) - 86400
        AND statistics IS NOT NULL
        AND incidents IS NOT NULL
        AND trend_data IS NOT NULL
        AND player_stats IS NOT NULL
      ORDER BY match_time DESC
      LIMIT 1
    `);
    
    if (matchResult.rows.length === 0) {
      logger.warn('⚠️ No complete ended matches found. Cannot test cache.');
      return;
    }
    
    const match = matchResult.rows[0];
    logger.info(`Testing cache for match: ${match.external_id}\n`);
    
    // 2. Test cache key generation
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:detail:${match.external_id}`;
    logger.info(`Cache key: ${cacheKey}`);
    
    // 3. Test cache set
    logger.info('\n1️⃣ Testing cache SET...');
    const matchData = {
      match_id: match.external_id,
      statistics: match.statistics,
      incidents: match.incidents,
      trend_data: match.trend_data,
      player_stats: match.player_stats,
    };
    
    await cacheService.set(cacheKey, matchData, CacheTTL.Day);
    logger.info('   ✅ Cache SET successful');
    
    // 4. Test cache get
    logger.info('\n2️⃣ Testing cache GET...');
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      logger.info('   ✅ Cache GET successful');
      logger.info(`   Statistics: ${cachedData.statistics ? '✅' : '❌'}`);
      logger.info(`   Incidents: ${cachedData.incidents ? '✅' : '❌'}`);
      logger.info(`   Trend Data: ${cachedData.trend_data ? '✅' : '❌'}`);
      logger.info(`   Player Stats: ${cachedData.player_stats ? '✅' : '❌'}`);
    } else {
      logger.warn('   ❌ Cache GET failed - data not found');
    }
    
    // 5. Test cache TTL
    logger.info('\n3️⃣ Testing cache TTL...');
    const ttl = await cacheService.getTTL(cacheKey);
    if (ttl !== null) {
      logger.info(`   ✅ TTL: ${ttl} seconds (${Math.round(ttl / 60)} minutes)`);
    } else {
      logger.warn('   ⚠️ TTL not available');
    }
    
    // 6. Summary
    logger.info('\n=== SUMMARY ===');
    if (cachedData) {
      logger.info('✅ Cache is working correctly!');
    } else {
      logger.warn('❌ Cache test failed');
    }
    
  } catch (error: any) {
    logger.error('Error testing cache:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testCacheMatchDetail().catch(console.error);
