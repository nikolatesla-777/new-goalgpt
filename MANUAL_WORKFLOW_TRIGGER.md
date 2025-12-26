# GitHub Actions Workflow Manuel Tetikleme

## 🔑 GitHub Token Gerekli

GitHub Actions workflow'unu programatik olarak tetiklemek için GitHub Personal Access Token gerekiyor.

## 🚀 Hızlı Yol: GitHub Web UI

**En Kolay Yöntem:**

1. GitHub'a git: https://github.com/nikolatesla-777/new-goalgpt/actions
2. Sol menüden **"Test All Endpoints"** workflow'unu seç
3. Sağ üstte **"Run workflow"** butonuna tıkla
4. **"Run workflow"** butonuna tekrar tıkla

## 🔧 Programatik Tetikleme (Token ile)

### Adım 1: GitHub Personal Access Token Oluştur

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" tıkla
3. Token'a bir isim ver (örn: "Workflow Trigger")
4. **`actions:write`** permission'ını seç
5. "Generate token" tıkla ve token'ı kopyala

### Adım 2: Token'ı Environment Variable Olarak Ayarla

```bash
export GITHUB_TOKEN=your_token_here
```

### Adım 3: Script'i Çalıştır

```bash
cd /Users/utkubozbay/Desktop/project
node trigger-workflow.js
```

## 📊 Sonuçları İnceleme

Workflow tetiklendikten sonra:

1. https://github.com/nikolatesla-777/new-goalgpt/actions adresine git
2. En üstteki workflow run'una tıkla
3. "Test Endpoints on VPS" step'ine tıkla
4. Sonuçları incele

## ⏱️ Bekleme Süresi

- Workflow başlatma: ~10 saniye
- VPS'e bağlanma ve script çalıştırma: ~1-2 dakika
- Toplam: ~2-3 dakika

