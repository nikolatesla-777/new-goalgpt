import https from 'https';
import fs from 'fs';

// Read credentials from .env
const envContent = fs.readFileSync('.env', 'utf8');
const user = envContent.match(/THESPORTS_API_USER=(.*)/)?.[1]?.trim();
const secret = envContent.match(/THESPORTS_API_SECRET=(.*)/)?.[1]?.trim();

if (!user || !secret) {
    console.error('Credentials not found in .env');
    process.exit(1);
}

function get(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function deepSearch() {
    const startPage = 1;
    const endPage = 1500;

    console.log(`Deep searching Barış Alper Yılmaz (Pages ${startPage}-${endPage})...`);

    for (let page = startPage; page <= endPage; page++) {
        if (page % 50 === 0) console.log(`Scanning page ${page}...`);

        try {
            const url = `https://api.thesports.com/v1/football/player/with_stat/list?user=${user}&secret=${secret}&page=${page}&limit=1000`;
            const res = await get(url);

            if (!res.results || res.results.length === 0) break;

            const found = res.results.filter((p: any) =>
                p.name.toLowerCase().includes('barış') ||
                p.name.toLowerCase().includes('baris') ||
                p.short_name?.toLowerCase().includes('barış') ||
                p.short_name?.toLowerCase().includes('baris')
            );

            for (const p of found) {
                if (p.name.includes('Barış Alper') || p.name.includes('Baris Alper')) {
                    console.log(`\nMATCH on page ${page}:`, JSON.stringify(p, null, 2));
                }
            }
        } catch (e: any) {
            console.error(`Error page ${page}:`, e.message);
        }
    }
}

deepSearch();
