/**
 * TheSports Client Test Script
 * 
 * Tests the API client with retry, circuit breaker, and rate limiting.
 * 
 * Usage: tsx src/services/thesports/client/test-client.ts
 */

import dotenv from 'dotenv';
import { TheSportsClient } from './thesports-client';
import { logger } from '../../../utils/logger';

dotenv.config();

async function testClient() {
  try {
    logger.info('Initializing TheSports API Client...');
    const client = new TheSportsClient();

    logger.info('Testing API connection...');
    logger.info(`Circuit Breaker State: ${client.getCircuitBreakerState()}`);

    // Test a simple endpoint (adjust endpoint as needed)
    const testEndpoint = '/match/recent/list';
    logger.info(`Testing endpoint: ${testEndpoint}`);

    const result = await client.get(testEndpoint, { page: 1, limit: 5 });
    
    // Check for error response
    if (result && typeof result === 'object' && 'err' in result) {
      const errorResponse = result as { err: string };
      logger.warn('⚠️ API returned error:', errorResponse.err);
      
      if (errorResponse.err.includes('IP is not authorized')) {
        logger.warn('💡 IP whitelist is required. Please contact TheSports API support.');
      }
    } else {
      logger.info('✅ API connection successful!');
      logger.info('Response:', JSON.stringify(result, null, 2));
    }
    
    logger.info(`Circuit Breaker State: ${client.getCircuitBreakerState()}`);

    process.exit(0);
  } catch (error: any) {
    logger.error('❌ API connection failed:', error.message);
    logger.error('Error details:', error);
    process.exit(1);
  }
}

testClient();

