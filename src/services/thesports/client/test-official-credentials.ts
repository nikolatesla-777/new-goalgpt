
import axios from 'axios';

const user = 'goalgpt';
const secret = '3205e4f6efe04a03f0055152c4aa0f37';
const baseUrl = 'https://api.thesports.com/v1/football';

async function testEndpoint(name: string, path: string, params: Record<string, string> = {}) {
    const url = `${baseUrl}${path}`;
    const allParams = { user, secret, ...params };
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);
    console.log(`Params: ${JSON.stringify(allParams)}`);

    try {
        const response = await axios.get(url, { params: allParams, timeout: 10000 });
        console.log(`Status: ${response.status}`);
        console.log(`Response Snippet: ${JSON.stringify(response.data).substring(0, 300)}`);
    } catch (error: any) {
        console.log(`Error Status: ${error.response?.status}`);
        console.log(`Error Data: ${JSON.stringify(error.response?.data)}`);
        console.log(`Error Message: ${error.message}`);
    }
}

async function runTests() {
    // 1. detail_live (The problematic one)
    await testEndpoint('detail_live', '/match/detail_live');

    // 2. recent/list
    await testEndpoint('recent/list', '/match/recent/list');

    // 3. diary
    await testEndpoint('diary', '/match/diary', { date: '20251225' });

    // 4. data/update
    await testEndpoint('data/update', '/data/update');
}

runTests();
