# Alert System Bot Eşleştirme Sorunu

**Tarih:** 2026-01-05  
**Sorun:** Dışardan gelen tahminler "Alert System" bot'u ile eşleşiyor (yanlış)

---

## 🔴 Sorun

Dışardan gelen tahminler (20. dakika) "Alert System" bot'u ile eşleşiyor. Bu yanlış çünkü:

- **"Alert System"** sadece **manuel tahminler** için kullanılmalı
- **Dışardan gelen tahminler** için `getBotGroupForMinute()` ile bot belirlenmeli
- 20. dakika için "BOT 007" veya başka bir bot olmalı

---

## 🔍 Root Cause (Kök Neden)

### `deploy-fixes.ts` Scripti

```typescript
// src/scripts/deploy-fixes.ts
INSERT INTO ai_bot_rules (
    id, bot_group_id, bot_display_name, minute_from, minute_to, 
    priority, is_active, prediction_period, base_prediction_type
) VALUES (
    gen_random_uuid(), gen_random_uuid(), 'Alert System', 
    0, 99, 999, true, 'AUTO', 'ÜST'
);
```

**Problem:**
- `minute_from = 0`
- `minute_to = 99`
- `priority = 999` (ÇOK YÜKSEK!)

### `getBotGroupForMinute()` Mantığı

```typescript
// src/services/ai/aiPrediction.service.ts:96-101
const result = await pool.query(`
    SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority, ...
    FROM ai_bot_rules
    WHERE is_active = true
    ORDER BY priority DESC  // ← YÜKSEK ÖNCELİK ÖNCE!
`);

for (const rule of result.rows) {
    if (minute >= minFrom && minute <= minTo) {
        return { botDisplayName: rule.bot_display_name, ... };
    }
}
```

**Sonuç:**
1. Priority'ye göre sıralama yapılıyor (DESC)
2. Priority 999 olan "Alert System" **EN ÖNCE** kontrol ediliyor
3. 20. dakika 0-99 aralığında olduğu için "Alert System" eşleşiyor! ❌

---

## ✅ Çözüm

### Çözüm 1: Alert System Kuralını Kaldır (Önerilen)

**"Alert System" bot'u `ai_bot_rules` tablosunda OLMAMALI**

- Manuel tahminler için `createManualPrediction()` metodunda hardcoded olarak "Alert System" kullanılıyor
- Dışardan gelen tahminler için `getBotGroupForMinute()` kullanılıyor
- İkisi birbirine karışmamalı

**SQL:**
```sql
-- Alert System kuralını devre dışı bırak veya sil
UPDATE ai_bot_rules 
SET is_active = false 
WHERE bot_display_name = 'Alert System';

-- VEYA

DELETE FROM ai_bot_rules 
WHERE bot_display_name = 'Alert System';
```

---

### Çözüm 2: getBotGroupForMinute() Metodunda Filtrele

**"Alert System" bot'unu `getBotGroupForMinute()` metodundan hariç tut**

```typescript
// src/services/ai/aiPrediction.service.ts:96-101
const result = await pool.query(`
    SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority, ...
    FROM ai_bot_rules
    WHERE is_active = true
      AND bot_display_name != 'Alert System'  -- ← FİLTRE EKLE
    ORDER BY priority DESC
`);
```

**Avantaj:**
- Manuel tahminler için "Alert System" kuralı kalabilir (ama kullanılmaz)
- Dışardan gelen tahminler için "Alert System" eşleşmez

---

### Çözüm 3: Priority'yi Düşür (Geçici Çözüm)

**"Alert System" kuralının priority'sini düşür**

```sql
UPDATE ai_bot_rules 
SET priority = 0  -- En düşük priority
WHERE bot_display_name = 'Alert System';
```

**Not:** Bu geçici bir çözüm. "Alert System" kuralı hala aktif ve başka sorunlara yol açabilir.

---

## 📊 Beklenen Davranış

### Dışardan Gelen Tahmin (20. dakika)

**Mevcut (Yanlış):**
```
20. dakika → getBotGroupForMinute(20)
  → Priority 999: Alert System (0-99) ✅ Eşleşir
  → Sonuç: "Alert System" ❌
```

**Beklenen (Doğru):**
```
20. dakika → getBotGroupForMinute(20)
  → Priority 20: 70. Dakika Botu (65-75) ❌ Eşleşmez
  → Priority 10: ALERT: D (1-15) ❌ Eşleşmez
  → Priority 1: BOT 007 (0-90) ✅ Eşleşir
  → Sonuç: "BOT 007" ✅
```

---

## 🛠️ Uygulama

**Önerilen:** Çözüm 1 (Alert System kuralını kaldır)

1. `ai_bot_rules` tablosundan "Alert System" kuralını sil veya `is_active = false` yap
2. Manuel tahminler zaten `createManualPrediction()` metodunda hardcoded "Alert System" kullanıyor
3. Dışardan gelen tahminler `getBotGroupForMinute()` ile doğru bot'u bulacak

---

## ✅ Doğrulama

Uygulama sonrası kontrol:

```sql
-- Alert System kuralı aktif mi?
SELECT bot_display_name, minute_from, minute_to, priority, is_active
FROM ai_bot_rules
WHERE bot_display_name = 'Alert System';

-- Son 24 saatteki tahminlerin bot dağılımı
SELECT bot_name, COUNT(*) as count
FROM ai_predictions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY bot_name
ORDER BY count DESC;
```

**Beklenen:**
- "Alert System" sadece manuel tahminlerde görünmeli
- Dışardan gelen tahminler "BOT 007", "ALERT: D", "70. Dakika Botu" gibi bot'larla eşleşmeli

---

**Rapor Son** ✅

