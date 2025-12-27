
const USER = 'goalgpt';
const SECRET = '3205e4f6efe04a03f0055152c4aa0f37';
const BASE_URL = 'https://api.thesports.com/v1/football';

async function fetchApi(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('user', USER);
    url.searchParams.append('secret', SECRET);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, String(value));
    }

    console.log(`Fetching ${url.toString()}...`);
    try {
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error.message);
        return null;
    }
}

async function diagnose() {
    const matchId = 'x7lm7phjo39gm2w';

    console.log('--- DIAGNOSTIC START ---');

    // 1. Detail Live
    const liveData = await fetchApi('/match/detail_live');
    if (liveData && liveData.results) {
        const match = liveData.results.find(m => m.id === matchId);
        if (match) {
            console.log('\n--- LIVE DATA STATS (detail_live) ---');
            console.log(JSON.stringify(match.stats, null, 2));
        } else {
            console.log('\nMatch not found in detail_live');
        }
    }

    // 2. Team Stats List (Realtime)
    const statsList = await fetchApi('/match/team_stats/list');
    if (statsList && statsList.results) {
        const matchStats = statsList.results.find(m => m.id === matchId);
        if (matchStats) {
            console.log('\n--- TEAM STATS LIST (Realtime) ---');
            console.log(JSON.stringify(matchStats, null, 2));
        } else {
            console.log('\nMatch not found in team_stats/list');
        }
    }

    // 3. Team Stats Detail (Historical)
    const statsDetail = await fetchApi('/match/team_stats/detail', { match_id: matchId });
    if (statsDetail) {
        console.log('\n--- TEAM STATS DETAIL (Historical) ---');
        console.log(JSON.stringify(statsDetail, null, 2));
    }

    // 4. Match Analysis
    const analysis = await fetchApi('/match/analysis', { match_id: matchId });
    if (analysis) {
        console.log('\n--- MATCH ANALYSIS ---');
        console.log(JSON.stringify(analysis, null, 2));
    }

    console.log('--- DIAGNOSTIC END ---');
}

diagnose();
