/**
 * GitHub Actions Workflow Trigger Script
 * 
 * Bu script, GitHub API kullanarak workflow'u tetikler
 * Kullanım: GITHUB_TOKEN environment variable'ı gerekli
 */

const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const OWNER = 'nikolatesla-777';
const REPO = 'new-goalgpt';
const WORKFLOW_FILE = 'test-endpoints.yml';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN veya GH_TOKEN environment variable gerekli!');
  console.error('   Örnek: export GITHUB_TOKEN=your_token_here');
  process.exit(1);
}

const postData = JSON.stringify({
  ref: 'main'
});

const options = {
  hostname: 'api.github.com',
  port: 443,
  path: `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
  method: 'POST',
  headers: {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
    'User-Agent': 'Node.js'
  }
};

console.log('🚀 GitHub Actions workflow tetikleniyor...');
console.log(`   Repository: ${OWNER}/${REPO}`);
console.log(`   Workflow: ${WORKFLOW_FILE}`);
console.log(`   Branch: main\n`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 204) {
      console.log('✅ Workflow başarıyla tetiklendi!');
      console.log(`\n📊 Sonuçları görmek için:`);
      console.log(`   https://github.com/${OWNER}/${REPO}/actions`);
      console.log(`\n⏳ Workflow çalışması 1-2 dakika sürebilir.`);
    } else {
      console.error(`❌ Hata: ${res.statusCode}`);
      console.error(`   Response: ${data}`);
      if (res.statusCode === 404) {
        console.error('\n💡 Workflow dosyası bulunamadı veya yanlış isim.');
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        console.error('\n💡 Token geçersiz veya yetkisiz. GitHub Personal Access Token gerekli.');
        console.error('   Token\'da "actions:write" permission olmalı.');
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ İstek hatası:', error.message);
});

req.write(postData);
req.end();


