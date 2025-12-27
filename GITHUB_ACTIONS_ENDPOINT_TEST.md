# GitHub Actions ile Endpoint Test Çalıştırma

## 🎯 Nasıl Çalıştırılır?

### Adım 1: GitHub Repository'ye Git
```
https://github.com/nikolatesla-777/new-goalgpt
```

### Adım 2: Actions Sekmesine Tıkla
- Repository sayfasında üst menüden **"Actions"** sekmesine tıklayın

### Adım 3: Workflow'u Bul
- Sol menüden **"Test All Endpoints"** workflow'unu bulun ve tıklayın

### Adım 4: Workflow'u Çalıştır
- Sağ üstte **"Run workflow"** butonuna tıklayın
- Branch olarak **"main"** seçili olduğundan emin olun
- **"Run workflow"** butonuna tıklayın

### Adım 5: Sonuçları İncele
- Workflow çalışmaya başlayacak (yaklaşık 1-2 dakika)
- Workflow run'una tıklayarak sonuçları görebilirsiniz
- **"Test Endpoints on VPS"** step'ine tıklayarak detaylı çıktıyı görebilirsiniz

## 📊 Beklenen Çıktı

Workflow çalıştığında şu çıktıyı göreceksiniz:

```
🧪 Testing TheSports API Endpoints...
...
┌──────────────────────────┬──────────────────────────────────────────────┬─────────────────────┬──────┬────────────────────────────────┐
│ Endpoint                 │ URL                                          │ Status              │ Code │ Notes                          │
├──────────────────────────┼──────────────────────────────────────────────┼─────────────────────┼──────┼────────────────────────────────┤
│ category                 │ /category/list                              │ ✅ SUCCESS          │ 200  │ Has results                    │
│ country                  │ /country/list                               │ ✅ SUCCESS          │ 200  │ Has results                    │
│ matchRecent              │ /match/recent/list                          │ ✅ SUCCESS          │ 200  │ Has results                    │
...
└──────────────────────────┴──────────────────────────────────────────────┴─────────────────────┴──────┴────────────────────────────────┘

📈 Statistics:
   ✅ Success: X/31
   ❌ Access Denied: X/31
   ⚠️  Error: X/31
   ⏱️  Timeout: X/31
```

## ⚠️ Notlar

- Workflow manuel tetiklenir (`workflow_dispatch`)
- VPS'e SSH erişimi gerektirir (GitHub Secrets'ta `VPS_SSH_KEY` olmalı)
- Test süresi yaklaşık 1-2 dakika
- 31 endpoint test edilir

