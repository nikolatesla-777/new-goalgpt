/**
 * TheSports API Endpoint Test Script
 * 
 * Tests all TheSports API endpoints to check for access errors
 * Run this script on VPS to verify IP whitelist status
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { API_ENDPOINTS, THESPORTS_BASE_URL } from '../config/api-endpoints';

dotenv.config();

interface TestResult {
  endpoint: string;
  url: string;
  status: 'SUCCESS' | 'ERROR' | 'ACCESS_DENIED' | 'TIMEOUT';
  statusCode?: number;
  errorMessage?: string;
  hasResults?: boolean;
  resultCount?: number;
}

const BASE_URL = THESPORTS_BASE_URL || 'https://api.thesports.com/v1/football';
const USER = process.env.THESPORTS_API_USER || 'goalgpt';
const SECRET = process.env.THESPORTS_API_SECRET || '';

if (!SECRET) {
  console.error('❌ THESPORTS_API_SECRET environment variable is not set!');
  process.exit(1);
}

/**
 * Test a single endpoint
 */
async function testEndpoint(
  endpointKey: string,
  config: { url: string; description: string }
): Promise<TestResult> {
  const fullUrl = `${BASE_URL}${config.url}`;
  const params = new URLSearchParams({
    user: USER,
    secret: SECRET,
    ...getDefaultParams(config.url),
  });

  const testUrl = `${fullUrl}?${params.toString()}`;

  try {
    const startTime = Date.now();
    const response = await axios.get(testUrl, {
      timeout: 10000, // 10 seconds timeout
    });

    const elapsed = Date.now() - startTime;

    // Check for error in response body
    const data = response.data;
    
    // Check for IP authorization error
    if (data?.err && (data.err.includes('not authorized') || data.err.includes('IP'))) {
      return {
        endpoint: endpointKey,
        url: config.url,
        status: 'ACCESS_DENIED',
        statusCode: response.status,
        errorMessage: data.err,
      };
    }

    // Check for code-based error
    if (data?.code && data.code !== 0 && data.code !== 200) {
      return {
        endpoint: endpointKey,
        url: config.url,
        status: 'ERROR',
        statusCode: response.status,
        errorMessage: data.msg || data.err || `Code: ${data.code}`,
      };
    }

    // Check if results exist
    const results = data?.results;
    const hasResults = results !== undefined && results !== null;

    return {
      endpoint: endpointKey,
      url: config.url,
      status: 'SUCCESS',
      statusCode: response.status,
      hasResults,
      resultCount: Array.isArray(results) ? results.length : 
                   typeof results === 'object' ? Object.keys(results).length : 
                   undefined,
    };
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      return {
        endpoint: endpointKey,
        url: config.url,
        status: 'TIMEOUT',
        errorMessage: 'Request timeout (10s)',
      };
    }

    const statusCode = error.response?.status;
    const errorData = error.response?.data;

    // Check for IP authorization error in response
    if (statusCode === 401 || statusCode === 403) {
      return {
        endpoint: endpointKey,
        url: config.url,
        status: 'ACCESS_DENIED',
        statusCode,
        errorMessage: errorData?.err || errorData?.msg || error.message,
      };
    }

    return {
      endpoint: endpointKey,
      url: config.url,
      status: 'ERROR',
      statusCode,
      errorMessage: errorData?.err || errorData?.msg || error.message,
    };
  }
}

/**
 * Get default parameters for endpoint
 */
function getDefaultParams(url: string): Record<string, string> {
  // Add default parameters based on endpoint type
  if (url.includes('/match/diary')) {
    // Use today's date in YYYYMMDD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return { date: `${year}${month}${day}` };
  }

  if (url.includes('/match/recent/list') || url.includes('/data/update')) {
    // These endpoints don't need extra params for basic test
    return {};
  }

  // For paginated endpoints, use page 1, limit 5 for quick test
  if (url.includes('/list') || url.includes('/additional/list')) {
    return { page: '1', limit: '5' };
  }

  return {};
}

/**
 * Main test function
 */
async function testAllEndpoints(): Promise<void> {
  console.log('🧪 Testing TheSports API Endpoints...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User: ${USER}`);
  console.log(`Secret: ${SECRET.substring(0, 8)}...\n`);
  console.log('─'.repeat(100));

  const results: TestResult[] = [];
  const endpointKeys = Object.keys(API_ENDPOINTS) as Array<keyof typeof API_ENDPOINTS>;

  // Test Basic Info Endpoints first
  console.log('\n📋 Testing Basic Info Endpoints...\n');
  for (const key of endpointKeys) {
    const config = API_ENDPOINTS[key];
    process.stdout.write(`Testing ${key}... `);
    const result = await testEndpoint(key, config);
    results.push(result);
    
    if (result.status === 'SUCCESS') {
      console.log(`✅ ${result.statusCode} ${result.hasResults ? `(has results)` : ''}`);
    } else if (result.status === 'ACCESS_DENIED') {
      console.log(`❌ ACCESS DENIED: ${result.errorMessage?.substring(0, 50)}`);
    } else {
      console.log(`⚠️  ${result.status}: ${result.errorMessage?.substring(0, 50)}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n─'.repeat(100));
  console.log('\n📊 Test Results Summary\n');

  // Create summary table
  const table: Array<{
    Endpoint: string;
    URL: string;
    Status: string;
    Code: string;
    Notes: string;
  }> = [];

  for (const result of results) {
    const statusEmoji = 
      result.status === 'SUCCESS' ? '✅' :
      result.status === 'ACCESS_DENIED' ? '❌' :
      result.status === 'TIMEOUT' ? '⏱️' :
      '⚠️';

    table.push({
      Endpoint: result.endpoint,
      URL: result.url,
      Status: `${statusEmoji} ${result.status}`,
      Code: result.statusCode?.toString() || '—',
      Notes: result.errorMessage?.substring(0, 60) || 
             (result.hasResults ? `Has results (${result.resultCount || 'N/A'})` : ''),
    });
  }

  // Print table
  console.log('┌──────────────────────────┬──────────────────────────────────────────────┬─────────────────────┬──────┬────────────────────────────────┐');
  console.log('│ Endpoint                 │ URL                                          │ Status              │ Code │ Notes                          │');
  console.log('├──────────────────────────┼──────────────────────────────────────────────┼─────────────────────┼──────┼────────────────────────────────┤');
  
  for (const row of table) {
    const endpoint = row.Endpoint.padEnd(24);
    const url = row.URL.padEnd(60);
    const status = row.Status.padEnd(19);
    const code = row.Code.padEnd(4);
    const notes = (row.Notes || '').substring(0, 30).padEnd(30);
    console.log(`│ ${endpoint} │ ${url} │ ${status} │ ${code} │ ${notes} │`);
  }
  
  console.log('└──────────────────────────┴──────────────────────────────────────────────┴─────────────────────┴──────┴────────────────────────────────┘');

  // Summary statistics
  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const accessDeniedCount = results.filter(r => r.status === 'ACCESS_DENIED').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  const timeoutCount = results.filter(r => r.status === 'TIMEOUT').length;

  console.log('\n📈 Statistics:');
  console.log(`   ✅ Success: ${successCount}/${results.length}`);
  console.log(`   ❌ Access Denied: ${accessDeniedCount}/${results.length}`);
  console.log(`   ⚠️  Error: ${errorCount}/${results.length}`);
  console.log(`   ⏱️  Timeout: ${timeoutCount}/${results.length}`);

  // List access denied endpoints
  if (accessDeniedCount > 0) {
    console.log('\n❌ Access Denied Endpoints:');
    for (const result of results.filter(r => r.status === 'ACCESS_DENIED')) {
      console.log(`   - ${result.endpoint} (${result.url})`);
    }
  }

  console.log('\n✅ Test completed!\n');
}

// Run tests
testAllEndpoints().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

test

