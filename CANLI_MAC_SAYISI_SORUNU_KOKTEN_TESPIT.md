# Canlı Maç Sayısı Sorunu - Kökten Tespit

**Tarih:** 4 Ocak 2026  
**Sorun:** Canlı maç sayısı 19 gösteriliyor ama daha fazla olması gerekli. "Saati geçen ama başlamayan o kadar maç var ki"

---

## 🔍 SORUN TESPİTİ

### Browser Test Sonuçları:
- **Canlı Maçlar:** 19 maç gösteriliyor
- **Beklenen:** Daha fazla olmalı (saati geçen ama başlamayan maçlar var)

### Mevcut Sistem Analizi:

#### 1. Backend `getLiveMatches()` Query:

**Dosya:** `src/services/thesports/match/matchDatabase.service.ts`

**Query:**
```sql
WHERE m.status_id IN (2, 3, 4, 5, 7)  -- ONLY strictly live matches
  AND m.match_time >= $1  -- Last 4 hours
  AND m.match_time <= $2  -- Not future
```

**Sonuç:**
- ✅ Sadece **gerçekten canlı** olan maçları getiriyor (status 2,3,4,5,7)
- ❌ **"Should be live" maçları GETİRMİYOR** (status=1 ama match_time geçmiş)

#### 2. MatchWatchdogWorker:

**Dosya:** `src/jobs/matchWatchdog.job.ts`

**Ne Yapıyor:**
- `findShouldBeLiveMatches()` çağrılıyor
- `status_id = 1` ve `match_time <= nowTs` olan maçları buluyor
- Bu maçları reconcile edip status'lerini `1 → 2` (FIRST_HALF) olarak güncellemeye çalışıyor
- Her **10 saniyede** bir çalışıyor

**Sorun:**
- Worker maçları yakalıyor ama reconcile işlemi **başarısız olabiliyor**
- Veya worker **yeterince hızlı çalışmıyor** (10 saniye gecikme)
- Veya bazı maçlar **yakalanmıyor** (limit 1000, ama daha fazla maç olabilir)

---

## 📊 SORUNUN KÖKÜ

### Ana Sorun:

**`getLiveMatches()` query'si sadece `status_id IN (2,3,4,5,7)` olan maçları getiriyor.**

**"Should be live" maçlar (status=1, match_time geçmiş) bu query'de YOK!**

Bu maçlar:
1. MatchWatchdogWorker tarafından yakalanıp status'leri güncellenmeye çalışılıyor
2. Ama bu işlem **zaman alıyor** (10 saniye gecikme + reconcile süresi)
3. Veya **başarısız olabiliyor** (API hatası, rate limit, vb.)
4. Sonuç: Maçlar **status=1'de kalıyor** ve canlı maç listesinde görünmüyor

---

## 🔧 ÇÖZÜM SEÇENEKLERİ

### Seçenek 1: `getLiveMatches()` Query'sine "Should Be Live" Maçları Ekle (ÖNERİLEN)

**Avantajlar:**
- ✅ Kullanıcı **anında** "should be live" maçları görür
- ✅ MatchWatchdogWorker'a bağımlı değil
- ✅ Daha doğru canlı maç sayısı

**Dezavantajlar:**
- ❌ Query biraz daha karmaşık olur
- ❌ Status=1 olan maçlar "CANLI" olarak gösterilir (ama aslında henüz başlamamış olabilir)

**Uygulama:**
```sql
WHERE (
  -- Gerçekten canlı maçlar
  (m.status_id IN (2, 3, 4, 5, 7) AND m.match_time >= $1 AND m.match_time <= $2)
  OR
  -- Should be live maçlar (status=1 ama match_time geçmiş)
  (m.status_id = 1 AND m.match_time <= $2 AND m.match_time >= $1)
)
```

### Seçenek 2: MatchWatchdogWorker'ı Daha Agresif Yap

**Avantajlar:**
- ✅ Mevcut query mantığı korunur
- ✅ Status'ler daha hızlı güncellenir

**Dezavantajlar:**
- ❌ Yine de **gecikme** olur (worker interval'ı kadar)
- ❌ Reconcile başarısız olursa maçlar görünmez
- ❌ API rate limit'e takılabilir

**Uygulama:**
- Interval: 10s → 5s
- Limit: 1000 → 2000
- Retry logic ekle

### Seçenek 3: Hybrid Yaklaşım

**Avantajlar:**
- ✅ En doğru sonuç
- ✅ Kullanıcı anında görür
- ✅ Worker arka planda status'leri günceller

**Dezavantajlar:**
- ❌ Daha karmaşık kod

**Uygulama:**
- `getLiveMatches()` query'sine "should be live" maçları ekle
- MatchWatchdogWorker çalışmaya devam et (status'leri günceller)

---

## ✅ ÖNERİLEN ÇÖZÜM

**Seçenek 1: `getLiveMatches()` Query'sine "Should Be Live" Maçları Ekle**

**Neden:**
- Kullanıcı **anında** tüm canlı olması gereken maçları görür
- MatchWatchdogWorker'a bağımlı değil
- Daha doğru sayı gösterilir
- Worker arka planda status'leri güncellemeye devam eder

---

## 🚨 ÖNEMLİ NOTLAR

1. **"Should be live" maçlar status=1 olarak gösterilecek** (henüz FIRST_HALF'e geçmemiş)
2. **Frontend'de bu durum handle edilmeli** (status=1 olan maçlar için özel gösterim)
3. **MatchWatchdogWorker çalışmaya devam etmeli** (status'leri günceller)
4. **Time filter korunmalı** (4 saatlik pencere)

---

## 📝 SONRAKİ ADIMLAR

1. ✅ Bu analiz kullanıcıya gösterilir
2. ✅ Kullanıcı onaylarsa çözüm uygulanır
3. ✅ Frontend'de status=1 maçları için özel gösterim eklenir (opsiyonel)
4. ✅ Test edilir

