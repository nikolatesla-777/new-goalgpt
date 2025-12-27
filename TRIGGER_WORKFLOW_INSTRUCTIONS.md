# 🚀 GitHub Actions Workflow Tetikleme - Detaylı Talimatlar

## ⚠️ Önemli Not

GitHub Actions workflow'unu programatik olarak tetiklemek için **GitHub Personal Access Token** gerekiyor. Bu token şu anda environment'ta yok.

## ✅ Çözüm: GitHub Web UI'dan Manuel Tetikleme

### Adım 1: GitHub'a Git
```
https://github.com/nikolatesla-777/new-goalgpt/actions
```

### Adım 2: Workflow'u Bul
1. Sol menüde **"Test All Endpoints"** workflow'unu bulun
2. Üzerine tıklayın

### Adım 3: Workflow'u Tetikle
1. Sağ üstte **"Run workflow"** butonuna tıklayın
2. Branch: **main** (zaten seçili olmalı)
3. **"Run workflow"** butonuna tekrar tıklayın

### Adım 4: Sonuçları Bekle
- Workflow çalışmaya başlayacak (~10 saniye)
- VPS'e bağlanıp script'i çalıştıracak (~1-2 dakika)
- Toplam süre: ~2-3 dakika

### Adım 5: Sonuçları İncele
1. Workflow run'una tıklayın
2. **"Test Endpoints on VPS"** step'ine tıklayın
3. Sonuçları göreceksiniz

## 📊 Beklenen Sonuç Formatı

```
🧪 Testing TheSports API Endpoints...

Base URL: https://api.thesports.com/v1/football
User: goalgpt
Secret: 3205e4f6...

───────────────────────────────────────────────────────────────────────────────────────

📋 Testing Basic Info Endpoints...

Testing category... ✅ 200 (has results)
Testing country... ✅ 200 (has results)
Testing competition... ✅ 200 (has results)
...

───────────────────────────────────────────────────────────────────────────────────────

📊 Test Results Summary

┌──────────────────────────┬──────────────────────────────────────────────┬─────────────────────┬──────┬────────────────────────────────┐
│ Endpoint                 │ URL                                          │ Status              │ Code │ Notes                          │
├──────────────────────────┼──────────────────────────────────────────────┼─────────────────────┼──────┼────────────────────────────────┤
│ category                 │ /category/list                              │ ✅ SUCCESS          │ 200  │ Has results                    │
│ country                  │ /country/list                               │ ✅ SUCCESS          │ 200  │ Has results                    │
│ matchRecent              │ /match/recent/list                          │ ✅ SUCCESS          │ 200  │ Has results                    │
│ matchDetailLive          │ /match/detail_live                          │ ✅ SUCCESS          │ 200  │ Has results                    │
│ dataUpdate               │ /data/update                                │ ✅ SUCCESS          │ 200  │ Has results                    │
...

📈 Statistics:
   ✅ Success: X/31
   ❌ Access Denied: X/31
   ⚠️  Error: X/31
   ⏱️  Timeout: X/31
```

## 🔧 Alternatif: Token ile Programatik Tetikleme

Eğer GitHub Personal Access Token oluşturursanız:

### Token Oluşturma
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)"
3. **`actions:write`** permission'ını seçin
4. Token'ı kopyalayın

### Token ile Tetikleme
```bash
export GITHUB_TOKEN=your_token_here
cd /Users/utkubozbay/Desktop/project
node trigger-workflow.js
```

## 📝 Notlar

- Workflow manuel tetiklenir (`workflow_dispatch`)
- VPS SSH key GitHub Secrets'ta olmalı (`VPS_SSH_KEY`)
- Test süresi: ~2-3 dakika
- 31 endpoint test edilir


