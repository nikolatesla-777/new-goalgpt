# Alert System Bot Eşleştirme Düzeltmesi

**Tarih:** 2026-01-05  
**Sorun:** Dışardan gelen tahminler "Alert System" bot'u ile eşleşiyordu  
**Çözüm:** `getBotGroupForMinute()` metodunda "Alert System" filtrelendi

---

## ✅ Uygulanan Düzeltme

### Değişiklik

**Dosya:** `src/services/ai/aiPrediction.service.ts`

**Önce:**
```typescript
const result = await pool.query(`
    SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority, ...
    FROM ai_bot_rules
    WHERE is_active = true
    ORDER BY priority DESC
`);
```

**Sonra:**
```typescript
const result = await pool.query(`
    SELECT id, bot_group_id, bot_display_name, minute_from, minute_to, priority, ...
    FROM ai_bot_rules
    WHERE is_active = true
      AND bot_display_name != 'Alert System'  -- CRITICAL FIX: Alert System is only for manual predictions
    ORDER BY priority DESC
`);
```

---

## 🎯 Sonuç

### Dışardan Gelen Tahmin (20. dakika)

**Önce (Yanlış):**
```
20. dakika → getBotGroupForMinute(20)
  → Priority 999: Alert System (0-99) ✅ Eşleşir
  → Sonuç: "Alert System" ❌
```

**Sonra (Doğru):**
```
20. dakika → getBotGroupForMinute(20)
  → Alert System filtrelendi ❌
  → Priority 20: 70. Dakika Botu (65-75) ❌ Eşleşmez
  → Priority 10: ALERT: D (1-15) ❌ Eşleşmez
  → Priority 1: BOT 007 (0-90) ✅ Eşleşir
  → Sonuç: "BOT 007" ✅
```

---

## 📝 Notlar

1. **"Alert System" sadece manuel tahminler için:**
   - `createManualPrediction()` metodunda hardcoded olarak "Alert System" kullanılıyor
   - Dışardan gelen tahminler için `getBotGroupForMinute()` kullanılıyor
   - İkisi birbirine karışmamalı

2. **`ai_bot_rules` tablosundaki "Alert System" kuralı:**
   - Kural hala tabloda kalabilir (manuel tahminler için referans olarak)
   - Ama `getBotGroupForMinute()` metodunda filtreleniyor
   - Dışardan gelen tahminler için kullanılmıyor

3. **Alternatif Çözüm:**
   - `ai_bot_rules` tablosundan "Alert System" kuralını silmek veya `is_active = false` yapmak
   - Ama mevcut çözüm daha güvenli (manuel tahminler için referans kalıyor)

---

**Düzeltme Tamamlandı** ✅

