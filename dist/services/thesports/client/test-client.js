"use strict";
/**
 * TheSports Client Test Script
 *
 * Tests the API client with retry, circuit breaker, and rate limiting.
 *
 * Usage: tsx src/services/thesports/client/test-client.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const thesports_client_1 = require("./thesports-client");
const logger_1 = require("../../../utils/logger");
dotenv_1.default.config();
async function testClient() {
    try {
        logger_1.logger.info('Initializing TheSports API Client...');
        const client = new thesports_client_1.TheSportsClient();
        logger_1.logger.info('Testing API connection...');
        logger_1.logger.info(`Circuit Breaker State: ${client.getCircuitBreakerState()}`);
        // Test a simple endpoint (adjust endpoint as needed)
        const testEndpoint = '/match/recent/list';
        logger_1.logger.info(`Testing endpoint: ${testEndpoint}`);
        const result = await client.get(testEndpoint, { page: 1, limit: 5 });
        // Check for error response
        if (result && typeof result === 'object' && 'err' in result) {
            const errorResponse = result;
            logger_1.logger.warn('⚠️ API returned error:', errorResponse.err);
            if (errorResponse.err.includes('IP is not authorized')) {
                logger_1.logger.warn('💡 IP whitelist is required. Please contact TheSports API support.');
            }
        }
        else {
            logger_1.logger.info('✅ API connection successful!');
            logger_1.logger.info('Response:', JSON.stringify(result, null, 2));
        }
        logger_1.logger.info(`Circuit Breaker State: ${client.getCircuitBreakerState()}`);
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ API connection failed:', error.message);
        logger_1.logger.error('Error details:', error);
        process.exit(1);
    }
}
testClient();
