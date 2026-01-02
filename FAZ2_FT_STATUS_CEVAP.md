# FAZ 2: FT Status (status=8) - Kısa Cevap

**Soru:** Bundan sonraki süreçte FT statüsüne gelen maçların tüm dataları database'e kaydedilecek mi?

---

## ✅ CEVAP: EVET, ANCAK...

### Kısa Cevap
**Evet, hook'lar çalışacak ve tüm datalar kaydedilmeye çalışılacak.** Ancak maç bitince API'ler data sağlamayabilir, bu yüzden **canlıyken kaydetme mekanizması kritik.**

---

## 📊 NASIL ÇALIŞACAK?

### 1. Canlıyken Kaydetme (Öncelikli) ✅
**Mevcut durum:**
- ✅ WebSocket'ten gelen statistics → `updateMatchStatisticsInDatabase()` → Database'e kaydediliyor
- ✅ WebSocket'ten gelen incidents → `updateMatchIncidentsInDatabase()` → Database'e kaydediliyor
- ✅ `getMatchLiveStats` endpoint'i → `saveCombinedStatsToDatabase()` → Database'e kaydediliyor
- ✅ Trend data → Canlıyken kaydediliyor mu? (kontrol edilmeli)

**Sonuç:** Maç bitmeden önce veriler database'de olacak.

### 2. Maç Bitince Hook'lar (Backup) ✅
**Hook'lar:**
- ✅ WebSocket: `status=8` → `triggerPostMatchPersistence()`
- ✅ DataUpdate: `status=8` → `processor.onMatchEnded()`
- ✅ matchDetailLive: `status=8` → `triggerPostMatchPersistence()`

**PostMatchProcessor yapacaklar:**
1. Statistics → API'den çekmeye çalışacak (maç bitince çalışmayabilir, ama canlıyken kaydedilmişse sorun yok)
2. Incidents → API'den çekmeye çalışacak (maç bitince çalışmayabilir, ama canlıyken kaydedilmişse sorun yok)
3. Trend → API'den çekmeye çalışacak
4. Player Stats → API'den çekmeye çalışacak (API authorization gerekli)

---

## ⚠️ SORUN: API AVAILABILITY

**Problem:**
- Maç bitince `/match/detail_live` API'si data sağlamayabilir
- Historical API'ler boş dönebilir
- PostMatchProcessor API'den data çekemeyebilir

**Çözüm:**
1. **Canlıyken kaydetme mekanizmasını güçlendir** ✅ (zaten çalışıyor)
2. **PostMatchProcessor'ı iyileştir:**
   - Önce database'deki mevcut data'yı kontrol et
   - Sadece eksikse API'den çek
   - API'den gelmezse database'deki mevcut data'yı kullan

---

## 🎯 ÖNERİ: PostMatchProcessor İyileştirmesi

```typescript
// Önce database'deki mevcut data'yı kontrol et
const existingStats = await client.query('SELECT statistics FROM ts_matches WHERE external_id = $1', [matchId]);

if (existingStats.rows[0]?.statistics) {
  // Database'de zaten var, API'ye gitme
  logger.info(`[PostMatch] Statistics already in database for ${matchId}, skipping API call`);
  return;
}

// Sadece eksikse API'den çek
const stats = await this.combinedStatsService.getCombinedMatchStats(matchId);
```

---

## 📋 SONUÇ

### Bundan Sonraki Süreçte:

1. **Canlıyken:** ✅ Veriler database'e kaydediliyor (WebSocket + getMatchLiveStats)
2. **Maç Bitince:** ✅ Hook'lar tetiklenecek ve PostMatchProcessor çalışacak
3. **API'lerden Data Gelmezse:** ⚠️ Database'deki mevcut data kullanılacak (eğer varsa)

### Eksik Olan:
- PostMatchProcessor'ın database'deki mevcut data'yı kontrol etmesi
- Trend data'nın canlıyken kaydedilip kaydedilmediğinin kontrolü

---

**Son Güncelleme:** 2026-01-03 00:25 UTC  
**Durum:** ✅ Hook'lar yerleştirilmiş - ⚠️ PostMatchProcessor iyileştirilmeli

