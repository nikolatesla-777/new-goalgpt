# 📱 GoalGPT Telegram Bot Setup

**Professional bot profile similar to Keydo**

---

## 1️⃣ BotFather Kurulumu

### Adım 1: Bot Bilgilerini Ayarla

BotFather'a şu komutları gönder:

```
/mybots
→ @goalgptbot seç (veya botunun adı)
```

### Adım 2: Bot Açıklaması (Description)

```
/setdescription
```

**Açıklama metni**:
```
⚽️ GoalGPT | AI Destekli Maç Tahmin Asistanı

Yapay zeka destekli maç tahmin ve analiz sistemi. Canlı skor takibi, AI tahminleri ve günlük bahis listeleri.

✨ Özellikler:
• 🤖 AI tabanlı maç analizleri
• 📊 Canlı skorlar ve istatistikler
• 📋 Günlük bahis listeleri (BTTS, Gol, Korner, Kart)
• 🎯 Güven skoru sistemi
• 📈 Performans takibi

Benden analiz iste veya günlük listelerimizi takip et!
```

### Adım 3: Kısa Açıklama (About)

```
/setabouttext
```

**Kısa metin**:
```
Yapay zeka destekli maç tahmin asistanınız. Benden analiz iste! ⚽️🤖
```

### Adım 4: Bot Komutları

```
/setcommands
```

**Komut listesi**:
```
start - Botu başlat ve ana menüyü göster
help - Yardım menüsü
gunluk - Günlük tahmin listelerini göster
canli - Canlı maçları göster
analiz - Maç analizi al
istatistik - İstatistiklerimizi göster
ayarlar - Bildirim ayarları
```

### Adım 5: Inline Mod (Opsiyonel)

```
/setinline
→ "Maç ara veya analiz iste..."
```

### Adım 6: Bot Profil Fotosu

```
/setuserpic
→ GoalGPT logosunu yükle (512x512 PNG)
```

---

## 2️⃣ Bot Menü Yapısı

### Ana Menü (Inline Keyboard)

```
┌──────────────────────────┐
│  📋 Günlük Listeler      │
├──────────────────────────┤
│  ⚽️ Canlı Maçlar         │
├──────────────────────────┤
│  🤖 AI Analiz İste       │
├──────────────────────────┤
│  📊 İstatistikler        │
├──────────────────────────┤
│  ⚙️ Ayarlar             │
└──────────────────────────┘
```

### Günlük Listeler Alt Menüsü

```
┌────────────┬────────────┐
│  ⚽️ Gol    │  🤝 BTTS  │
├────────────┼────────────┤
│  🚩 Korner │  🟨 Kart  │
├────────────┴────────────┤
│      🔙 Ana Menü         │
└──────────────────────────┘
```

---

## 3️⃣ Mesaj Şablonları

### Hoş Geldin Mesajı (Start Command)

```
⚽️ *GoalGPT'ye Hoş Geldiniz!*

AI destekli maç tahmin ve analiz sisteminiz.

*Neler Yapabilirsiniz:*
• 📋 Günlük bahis listelerini görüntüle
• ⚽️ Canlı maçları takip et
• 🤖 AI analiz iste
• 📊 İstatistikleri incele

Başlamak için aşağıdaki menüyü kullanın! 👇
```

### Günlük Liste Önizleme

```
📋 *GÜNLÜK BTTS LİSTESİ*
🗓 {tarih}

✅ *{takım1} vs {takım2}*
🏆 {lig_adı}
⏰ {saat}
⭐️ Güven: {confidence}%
📊 Potansiyel: {btts_potential}%

[4 maç daha...]

📊 *Toplam Performans*
✅ Kazanan: {won} / {total}
❌ Kaybeden: {lost} / {total}
📈 Başarı: {win_rate}%

➡️ Detaylar için tıklayın: /btts_{list_id}
```

---

## 4️⃣ Bildirim Ayarları

### Kullanıcı Tercihleri

```
⚙️ *Bildirim Ayarları*

Hangi listeler için bildirim almak istersiniz?

☑️ BTTS (Karşılıklı Gol)
☑️ Over 2.5 (2.5 Üst)
☑️ Korner (8.5 Üst)
☑️ Kart (2.5 Üst)

🕐 Bildirim Saati: 09:00

💾 Kaydet
```

---

## 5️⃣ Kanal Yapısı

### Ana Kanal (@goalgptbetting)
- Tüm piyasalar için genel duyurular
- Günlük performans raporları
- Özel analizler

### Piyasa Bazlı Kanallar (Opsiyonel)
- @goalgpt_btts - BTTS listeleri
- @goalgpt_goals - Gol listeleri
- @goalgpt_corners - Korner listeleri
- @goalgpt_cards - Kart listeleri

---

## 6️⃣ Affiliate Program (Gelecek)

```
👥 *Affiliate Programı*

Arkadaşlarını davet et, kazan!

📊 *Kazançların:*
• Her davet: %20 komisyon
• Lifetime commission
• Aylık ödemeler

🔗 Davet Linkin:
https://t.me/goalgptbot?start=ref_{user_id}

📈 *İstatistikler:*
Davetiye: {referral_count}
Kazanç: ₺{total_earnings}

💸 Ödeme Talep Et
```

---

## 7️⃣ Gruba/Kanala Ekleme

Bot'u gruplara ekleme izni:

```
/setjoingroups
→ ENABLE (grupları aktif et)
```

Group admin izinleri:

```
/setprivacy
→ DISABLED (mesajları okuyabilsin)
```

---

## 8️⃣ .env Yapılandırması

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=-1003764965770

# Bot Features
TELEGRAM_PUBLISH_ENABLED=true
TELEGRAM_DRY_RUN=false
TELEGRAM_ALLOW_DUPLICATES=false

# Webhook (Opsiyonel - polling kullanılıyor)
TELEGRAM_WEBHOOK_URL=https://api.goalgpt.com/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
```

---

## 9️⃣ Implementasyon Dosyaları

### 1. Bot Komut Handler

`src/services/telegram/bot.handler.ts`
- /start komutu
- /help komutu
- /gunluk komutu
- Inline keyboard callback handler

### 2. Webhook Route

`src/routes/telegram.webhook.ts`
- Telegram webhook endpoint
- Message handler
- Callback query handler

### 3. Menü Builder

`src/services/telegram/menu.builder.ts`
- Ana menü
- Alt menüler
- Dinamik butonlar

---

## 🚀 Hızlı Başlangıç

### BotFather'da Yapılacaklar (5 dakika)

1. `/setdescription` - Açıklama ekle
2. `/setabouttext` - Kısa açıklama ekle
3. `/setcommands` - Komutları ekle
4. `/setuserpic` - Logo yükle

### Kodda Yapılacaklar

```bash
# Bot handler'ı implement et
npm run dev

# Webhook'u test et (opsiyonel)
curl -X POST https://api.telegram.org/bot{TOKEN}/setWebhook \
  -d url=https://api.goalgpt.com/webhook/telegram

# Polling'i başlat (geliştirme için)
npm run bot:polling
```

---

## 📊 Örnek Kullanım

### Kullanıcı Akışı

1. **Kullanıcı botu başlatır**: `/start`
2. **Ana menü gösterilir**: Inline keyboard
3. **"Günlük Listeler" seçilir**: Alt menü açılır
4. **"BTTS" seçilir**: Günün BTTS listesi gösterilir
5. **Maç detayı istenirse**: `/analiz {match_id}` ile detay gösterilir

### Admin Komutları

```
/publish_all - Tüm günlük listeleri yayınla
/stats - Bot istatistikleri
/users - Kullanıcı sayısı
/broadcast - Toplu mesaj gönder
```

---

## 🎨 Emoji Kullanımı

```
⚽️ - Futbol/Maçlar
🤖 - AI/Bot
📋 - Listeler
📊 - İstatistikler
⚡️ - Canlı
✅ - Başarılı/Kazanan
❌ - Başarısız/Kaybeden
⭐️ - Güven skoru
🏆 - Lig
⏰ - Saat
🚩 - Korner
🟨 - Kart
🤝 - BTTS
📈 - Trend yukarı
📉 - Trend aşağı
💰 - Para/Kazanç
👥 - Kullanıcılar
🔔 - Bildirim
⚙️ - Ayarlar
🔙 - Geri
```

---

## ✅ Checklist

Bot profili için:
- [ ] Description ayarlandı
- [ ] About text ayarlandı
- [ ] Komutlar eklendi
- [ ] Profil fotosu yüklendi
- [ ] Inline mode aktif edildi

Kod implementasyonu için:
- [ ] Bot handler oluşturuldu
- [ ] Webhook route eklendi
- [ ] Menü builder hazırlandı
- [ ] Komut handler'lar yazıldı
- [ ] Inline keyboard callback'leri eklendi

Test için:
- [ ] /start komutu test edildi
- [ ] Ana menü çalışıyor
- [ ] Günlük listeler gösteriliyor
- [ ] Callback'ler çalışıyor
- [ ] Webhook/polling aktif

---

**Hazırlayan**: Claude Code
**Tarih**: 2026-02-03
**Versiyon**: 1.0
**Status**: Ready for implementation
