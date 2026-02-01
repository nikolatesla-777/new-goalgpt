import dotenv from 'dotenv';
import { theSportsAPI } from '../core/TheSportsAPIManager';

dotenv.config();

async function main() {
  console.log('🔍 DETAILED TEST: /season/recent/table/detail');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Parametresiz çağır (tüm recent seasons?)
    console.log('Fetching /season/recent/table/detail...');
    const response = await theSportsAPI.get('/season/recent/table/detail', {});

    console.log('');
    console.log('FULL RESPONSE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(response, null, 2));
    console.log('');

    console.log('Response Analysis:');
    console.log('-'.repeat(80));
    console.log('code:', response.code);
    console.log('results type:', typeof response.results);
    console.log('results is array:', Array.isArray(response.results));
    console.log('results is object:', response.results && typeof response.results === 'object');

    if (response.results && typeof response.results === 'object' && !Array.isArray(response.results)) {
      console.log('results keys:', Object.keys(response.results));
      console.log('results values count:', Object.values(response.results).length);

      // Her key için value türünü göster
      Object.entries(response.results).forEach(([key, value]) => {
        console.log(`  ${key}:`, Array.isArray(value) ? `array[${(value as any[]).length}]` : typeof value);
      });
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('Response:', JSON.stringify(err.response, null, 2));
    }
  }

  process.exit(0);
}

main();
