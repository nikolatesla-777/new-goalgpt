/**
 * Debug Script: TheSports Schedule Endpoint Discovery
 * 
 * This script tests different TheSports API endpoints to find the correct one
 * that accepts a date parameter for schedule queries.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.THESPORTS_API_BASE_URL || 'https://api.thesports.com/v1/football';
const USER = process.env.THESPORTS_API_USER || '';
const SECRET = process.env.THESPORTS_API_SECRET || '';

// Get today's date in YYYY-MM-DD format
const today = new Date();
const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

console.log('='.repeat(80));
console.log('TheSports API Schedule Endpoint Discovery');
console.log('='.repeat(80));
console.log(`Base URL: ${BASE_URL}`);
console.log(`User: ${USER}`);
console.log(`Secret: ${SECRET ? '***' + SECRET.slice(-4) : 'NOT SET'}`);
console.log(`Date: ${dateStr} (YYYY-MM-DD)`);
console.log('='.repeat(80));
console.log('');

// Endpoints to test
const endpoints = [
  '/match/list',
  '/match/schedule',
  '/match/fixtures',
  '/match/diary', // Already known, but testing again
  '/match/recent/list', // Testing with date param
];

/**
 * Mask secret in URL for logging
 */
function maskSecret(url) {
  return url.replace(/secret=[^&]*/, 'secret=***');
}

/**
 * Test an endpoint with date parameter
 */
async function testEndpoint(endpoint, dateFormat = 'YYYY-MM-DD') {
  const dateParam = dateFormat === 'YYYY-MM-DD' ? dateStr : dateStr.replace(/-/g, '');
  
  const params = {
    user: USER,
    secret: SECRET,
    date: dateParam,
  };
  
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${BASE_URL}${endpoint}?${queryString}`;
  
  console.log(`\n🔍 Testing: ${endpoint}`);
  console.log(`📋 Full URL: ${maskSecret(fullUrl)}`);
  console.log(`📅 Date Format: ${dateFormat} (value: ${dateParam})`);
  
  try {
    const response = await axios.get(fullUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    
    const data = response.data;
    
    // Check for error fields
    if (data.err) {
      console.log(`❌ API Error: ${data.err}`);
    }
    if (data.code && data.code !== 200 && data.code !== 0) {
      console.log(`❌ API Error Code: ${data.code}, Message: ${data.msg || 'N/A'}`);
    }
    
    // Log results
    if (data.results && Array.isArray(data.results)) {
      console.log(`📊 Results Count: ${data.results.length}`);
      if (data.results.length > 0) {
        console.log(`\n📝 First 2 items:`);
        data.results.slice(0, 2).forEach((item, index) => {
          console.log(`\n  Item ${index + 1}:`);
          console.log(`    ID: ${item.id || item.match_id || 'N/A'}`);
          console.log(`    Home Team: ${item.home_team?.name || item.home_team_name || item.home_team_id || 'N/A'}`);
          console.log(`    Away Team: ${item.away_team?.name || item.away_team_name || item.away_team_id || 'N/A'}`);
          console.log(`    Match Time: ${item.match_time ? new Date(item.match_time * 1000).toISOString() : 'N/A'}`);
          console.log(`    Status: ${item.status || item.status_id || 'N/A'}`);
        });
      } else {
        console.log(`⚠️  No results returned (empty array)`);
      }
    } else {
      console.log(`⚠️  Response structure:`, JSON.stringify(data, null, 2).substring(0, 500));
    }
    
    return { success: true, endpoint, data };
  } catch (error) {
    if (error.response) {
      console.log(`❌ HTTP Error: ${error.response.status} ${error.response.statusText}`);
      console.log(`📄 Response:`, JSON.stringify(error.response.data, null, 2).substring(0, 500));
    } else if (error.request) {
      console.log(`❌ Network Error: No response received`);
      console.log(`📄 Request:`, error.request);
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    return { success: false, endpoint, error: error.message };
  }
}

/**
 * Test endpoint with different date formats
 */
async function testEndpointVariations(endpoint) {
  const formats = [
    { name: 'YYYY-MM-DD', value: dateStr },
    { name: 'YYYYMMDD', value: dateStr.replace(/-/g, '') },
  ];
  
  for (const format of formats) {
    const params = {
      user: USER,
      secret: SECRET,
      date: format.value,
    };
    
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${BASE_URL}${endpoint}?${queryString}`;
    
    console.log(`\n🔍 Testing: ${endpoint} with date format: ${format.name}`);
    console.log(`📋 Full URL: ${maskSecret(fullUrl)}`);
    
    try {
      const response = await axios.get(fullUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log(`✅ Status: ${response.status}`);
      
      const data = response.data;
      
      if (data.err) {
        console.log(`❌ API Error: ${data.err}`);
      } else if (data.code && data.code !== 200 && data.code !== 0) {
        console.log(`❌ API Error Code: ${data.code}, Message: ${data.msg || 'N/A'}`);
      } else if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        console.log(`✅ SUCCESS! Found ${data.results.length} matches`);
        return { success: true, endpoint, format: format.name, data };
      } else {
        console.log(`⚠️  No results (empty array or no results field)`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);
        if (error.response.data) {
          const errorData = typeof error.response.data === 'string' 
            ? error.response.data 
            : JSON.stringify(error.response.data);
          console.log(`📄 Error: ${errorData.substring(0, 200)}`);
        }
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
    }
  }
  
  return { success: false, endpoint };
}

/**
 * Main execution
 */
async function main() {
  if (!USER || !SECRET) {
    console.error('❌ ERROR: THESPORTS_API_USER and THESPORTS_API_SECRET must be set in .env file');
    process.exit(1);
  }
  
  console.log('Starting endpoint discovery...\n');
  
  const results = [];
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    const result = await testEndpointVariations(endpoint);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    console.log('\n✅ WORKING ENDPOINTS:');
    successful.forEach(r => {
      console.log(`  - ${r.endpoint} (date format: ${r.format})`);
    });
  } else {
    console.log('\n❌ NO WORKING ENDPOINTS FOUND');
    console.log('\nAll endpoints tested:');
    endpoints.forEach(ep => console.log(`  - ${ep}`));
  }
  
  console.log('\n' + '='.repeat(80));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

