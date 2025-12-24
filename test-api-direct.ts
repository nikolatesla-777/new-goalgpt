/**
 * Test TheSports API directly to see raw response
 */

import dotenv from 'dotenv';
import { TheSportsClient } from './src/services/thesports/client/thesports-client';
import { logger } from './src/utils/logger';

dotenv.config();

async function testDirectAPI() {
  const client = new TheSportsClient();
  
  try {
    logger.info('🔍 Testing API directly for date 20251219...');
    
    // Test with date parameter
    const response = await client.get<any>('/match/diary', { date: '20251219' });
    
    logger.info('📦 Raw API Response:');
    logger.info(`   Results count: ${response.results?.length || 0}`);
    logger.info(`   Total: ${response.total || 'N/A'}`);
    logger.info(`   Has results_extra: ${!!response.results_extra}`);
    logger.info(`   Error: ${response.err || 'None'}`);
    
    // Check if there's pagination info
    logger.info(`   Response keys: ${Object.keys(response).join(', ')}`);
    
    // Log first match structure
    if (response.results && response.results.length > 0) {
      logger.info(`   First match ID: ${response.results[0].id}`);
      logger.info(`   First match time: ${response.results[0].match_time}`);
    }
    
    // Try without date to see if there's a default
    logger.info('\n🔍 Testing API without date parameter...');
    const responseNoDate = await client.get<any>('/match/diary', {});
    logger.info(`   Results count (no date): ${responseNoDate.results?.length || 0}`);
    
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ API Test Failed:', error.message);
    process.exit(1);
  }
}

testDirectAPI();






