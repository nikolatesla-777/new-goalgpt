/**
 * API Access Test Script
 * 
 * Tests if TheSports API credentials are valid and accessible
 * This helps isolate API authorization issues from code logic bugs
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const baseUrl = process.env.THESPORTS_API_BASE_URL || 'https://api.thesports.com/v1/football';
const user = process.env.THESPORTS_API_USER || '';
const secret = process.env.THESPORTS_API_SECRET || '';

async function testApiAccess() {
  console.log('\n🔍 Testing TheSports API Access...\n');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`User: ${user}`);
  console.log(`Secret: ${secret ? '***' + secret.slice(-4) : 'NOT SET'}\n`);

  if (!user || !secret) {
    console.error('❌ ERROR: THESPORTS_API_USER or THESPORTS_API_SECRET is not set in .env file');
    process.exit(1);
  }

  // Test 1: Match Recent List endpoint (replaces /match/list)
  console.log('📡 Test 1: GET /match/recent/list (incremental sync endpoint)...');
  try {
    const response = await axios.get(`${baseUrl}/match/recent/list`, {
      params: {
        user,
        secret,
        page: 1,
        limit: 10,
      },
      timeout: 10000,
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Response Code: ${response.data?.code || 'N/A'}`);
    console.log(`✅ Results Count: ${response.data?.results?.length || 0}`);
    
    if (response.status === 200 && !response.data?.err) {
      console.log('✅ API Key is Valid. Access Granted.\n');
    } else {
      console.log(`⚠️  Response contains error: ${response.data?.err || 'Unknown'}\n`);
    }
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.err || error.response.data?.msg || error.message;
      
      console.log(`❌ API Error: [${status}] - ${message}`);
      
      if (status === 401 || status === 403) {
        console.log('❌ CHECK YOUR PLAN: API Key may be invalid or subscription expired.');
      } else if (status === 429) {
        console.log('⚠️  Rate Limit: Too many requests. Wait and retry.');
      } else {
        console.log(`⚠️  Unexpected error: ${status}`);
      }
    } else if (error.request) {
      console.log('❌ Network Error: No response from server.');
      console.log('   Check your internet connection and API endpoint URL.');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log('');
  }

  // Test 2: Category endpoint (usually available)
  console.log('📡 Test 2: GET /category/list (basic metadata endpoint)...');
  try {
    const response = await axios.get(`${baseUrl}/category/list`, {
      params: {
        user,
        secret,
      },
      timeout: 10000,
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Response Code: ${response.data?.code || 'N/A'}`);
    console.log(`✅ Results Count: ${response.data?.results?.length || 0}`);
    
    if (response.status === 200 && !response.data?.err) {
      console.log('✅ Category endpoint accessible.\n');
    } else {
      console.log(`⚠️  Response contains error: ${response.data?.err || 'Unknown'}\n`);
    }
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.err || error.response.data?.msg || error.message;
      console.log(`❌ Category Endpoint Error: [${status}] - ${message}\n`);
    } else {
      console.log(`❌ Category Endpoint Error: ${error.message}\n`);
    }
  }

  // Test 3: Competition endpoint (may require higher tier)
  console.log('📡 Test 3: GET /competition/additional/list (may require premium)...');
  try {
    const response = await axios.get(`${baseUrl}/competition/additional/list`, {
      params: {
        user,
        secret,
        page: 1,
      },
      timeout: 10000,
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Response Code: ${response.data?.code || 'N/A'}`);
    
    if (response.status === 200 && !response.data?.err) {
      console.log('✅ Competition endpoint accessible.\n');
    } else {
      console.log(`⚠️  Response contains error: ${response.data?.err || 'Unknown'}\n`);
    }
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.err || error.response.data?.msg || error.message;
      console.log(`❌ Competition Endpoint Error: [${status}] - ${message}`);
      
      if (message.includes('not authorized') || message.includes('contact our business staff')) {
        console.log('❌ THIS ENDPOINT REQUIRES PREMIUM PLAN OR AUTHORIZATION.\n');
      } else {
        console.log(`\n`);
      }
    } else {
      console.log(`❌ Competition Endpoint Error: ${error.message}\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Test Summary:');
  console.log('   If all tests failed with 401/403: API Key is invalid.');
  console.log('   If Test 1 & 2 passed but Test 3 failed: Plan limitation.');
  console.log('   If all passed: API access is working correctly.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the test
testApiAccess()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

