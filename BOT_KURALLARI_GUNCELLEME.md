# Bot Kuralları Güncelleme

**Tarih:** 2026-01-05  
**Amaç:** Yeni bot eşleştirme kurallarını uygulamak

---

## 📋 Yeni Bot Eşleştirme Kuralları

| Dakika Aralığı | Bot Adı | Priority | Period | Type |
|---------------|---------|----------|--------|------|
| 10-14 | ALERT D | 50 | IY | ÜST |
| 15 | CODE: 35 | 100 | IY | ÜST |
| 20-24 | Code Zero | 50 | IY | ÜST |
| 65-69 | BOT 007 | 50 | MS | ÜST |
| 70-75 | Algoritma: 01 | 50 | MS | ÜST |
| 0-90 | BOT 007 (fallback) | 1 | AUTO | ÜST |

---

## 🎯 Priority Mantığı

**Yüksek Priority = Daha Spesifik**

1. **CODE: 35** (15. dakika, tek dakika) → Priority 100
2. **ALERT D, Code Zero, BOT 007, Algoritma: 01** (5-6 dakika aralıkları) → Priority 50
3. **BOT 007** (0-90, fallback) → Priority 1

**Eşleştirme Sırası:**
1. Priority'ye göre sıralama (DESC)
2. Dakika aralığına göre kontrol
3. İlk eşleşen kural kullanılır

---

## 📊 Örnek Eşleştirmeler

### 10. Dakika
```
Priority 100: CODE: 35 (15) ❌
Priority 50: ALERT D (10-14) ✅ Eşleşir
→ Sonuç: "ALERT D"
```

### 15. Dakika
```
Priority 100: CODE: 35 (15) ✅ Eşleşir
→ Sonuç: "CODE: 35"
```

### 20. Dakika
```
Priority 100: CODE: 35 (15) ❌
Priority 50: ALERT D (10-14) ❌
Priority 50: Code Zero (20-24) ✅ Eşleşir
→ Sonuç: "Code Zero"
```

### 65. Dakika
```
Priority 100: CODE: 35 (15) ❌
Priority 50: ALERT D (10-14) ❌
Priority 50: Code Zero (20-24) ❌
Priority 50: BOT 007 (65-69) ✅ Eşleşir
→ Sonuç: "BOT 007"
```

### 70. Dakika
```
Priority 100: CODE: 35 (15) ❌
Priority 50: ALERT D (10-14) ❌
Priority 50: Code Zero (20-24) ❌
Priority 50: BOT 007 (65-69) ❌
Priority 50: Algoritma: 01 (70-75) ✅ Eşleşir
→ Sonuç: "Algoritma: 01"
```

### 25. Dakika (Aralıkta değil)
```
Priority 100: CODE: 35 (15) ❌
Priority 50: ALERT D (10-14) ❌
Priority 50: Code Zero (20-24) ❌
Priority 50: BOT 007 (65-69) ❌
Priority 50: Algoritma: 01 (70-75) ❌
Priority 1: BOT 007 (0-90) ✅ Eşleşir (fallback)
→ Sonuç: "BOT 007"
```

---

## 🛠️ Uygulama

### Migration Dosyası

`src/database/migrations/update-bot-rules-new-schedule.ts`

**Yapılan İşlemler:**
1. Eski bot kuralları silindi
2. Yeni bot kuralları eklendi
3. Priority değerleri ayarlandı

### Çalıştırma

```bash
# Migration'ı çalıştır
npx tsx src/database/migrations/update-bot-rules-new-schedule.ts up
```

---

## ✅ Doğrulama

Migration sonrası kontrol:

```sql
-- Tüm aktif bot kuralları
SELECT bot_display_name, minute_from, minute_to, priority, prediction_period
FROM ai_bot_rules
WHERE is_active = true
ORDER BY priority DESC, minute_from ASC;
```

**Beklenen Sonuç:**
```
CODE: 35      | 15  | 15  | 100 | IY
ALERT D       | 10  | 14  | 50  | IY
Code Zero     | 20  | 24  | 50  | IY
BOT 007       | 65  | 69  | 50  | MS
Algoritma: 01 | 70  | 75  | 50  | MS
BOT 007       | 0   | 90  | 1   | AUTO
```

---

**Güncelleme Tamamlandı** ✅

