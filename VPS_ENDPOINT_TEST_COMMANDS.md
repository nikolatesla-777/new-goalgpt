# VPS'te Endpoint Test Script'ini Çalıştırma

## 🚀 Komutlar

```bash
# 1. VPS'e SSH ile bağlan
ssh root@142.93.103.128

# 2. Proje dizinine git
cd /var/www/goalgpt

# 3. Latest code'u çek (GitHub Actions deploy etti ama yine de kontrol et)
git pull origin main

# 4. Dependencies'leri kontrol et (gerekirse)
npm install

# 5. Test script'ini çalıştır
npm run test:all-endpoints
```

## 📋 Beklenen Çıktı

Script, tüm 31 endpoint'i test edecek ve tablo formatında sonuç gösterecek.

## 💾 Sonuçları Kaydetme

Eğer sonuçları dosyaya kaydetmek isterseniz:

```bash
npm run test:all-endpoints > endpoint-test-results.txt 2>&1
```

Sonra sonuçları görmek için:
```bash
cat endpoint-test-results.txt
```


