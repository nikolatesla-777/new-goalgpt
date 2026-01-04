# Verilerin Nasıl Geldiği - Detaylı Açıklama

**Tarih:** 3 Ocak 2026  
**Soru:** Eğer auto refresh yoksa, bu veriler (events timeline'daki gol, asist, vs.) nasıl gelmiş?

---

## ✅ VERİLER GELİYOR - AMA SADECE İLK YÜKLEMEDE

### Senaryo: Kullanıcı Maç Detay Sayfasını Açtı

**Adım 1: Sayfa Yüklendi**
```
1. Kullanıcı: https://partnergoalgpt.com/match/x7lm7phjpndkm2w açtı
2. React: MatchDetailPage component mount oldu
3. useEffect çalıştı → fetchMatch() çağrıldı
4. Match bilgisi fetch edildi (skor, takımlar, status)
```

**Kod:**
```typescript
// MatchDetailPage.tsx:49-120
useEffect(() => {
  const fetchMatch = async () => {
    // Match bilgisi fetch ediliyor
    const liveResponse = await getLiveMatches();
    foundMatch = liveResponse.results?.find((m: Match) => m.id === matchId);
    setMatch(foundMatch);
  };
  
  fetchMatch();
}, [matchId]); // ⚠️ Sadece matchId değiştiğinde
```

**Sonuç:** ✅ Match bilgisi geldi (skor: 0-2, dakika: 50', status: 2. Yarı)

---

**Adım 2: Events Tab'ına Tıklandı**
```
1. Kullanıcı: "Etkinlikler" tab'ına tıkladı
2. React: activeTab state'i 'events' oldu
3. useEffect çalıştı → fetchTabData() çağrıldı
4. Events data fetch edildi
```

**Kod:**
```typescript
// MatchDetailPage.tsx:124-254
useEffect(() => {
  const fetchTabData = async () => {
    switch (activeTab) {
      case 'events':
        // ⚠️ SADECE TAB DEĞİŞTİĞİNDE ÇALIŞIYOR
        let eventsData = await getMatchDetailLive(matchId);
        let incidents = eventsData?.incidents || [];
        result = { incidents };
        break;
    }
    setTabData(result);
  };
  
  fetchTabData();
}, [activeTab, matchId]); // ⚠️ Sadece activeTab veya matchId değiştiğinde
```

**Sonuç:** ✅ Events data geldi (gol, asist, kart, vs.)

---

## ❌ SORUN: SONRASINDA GÜNCELLENMİYOR

### Senaryo: Maç Devam Ediyor, Yeni Gol Atıldı

**Durum:**
```
T0: Kullanıcı sayfayı açtı → Events tab'ına tıkladı
    → Veriler fetch edildi → Gösterildi (11' gol, 29' gol)

T1: Maç devam ediyor (50. dakika)
    → Yeni gol atıldı (51. dakika)
    → WebSocket event geldi (backend'de)
    → ❌ Frontend'de events tab güncellenmedi
    → ❌ Yeni gol görünmüyor
```

**Neden?**
```typescript
// MatchDetailPage.tsx:254
}, [activeTab, matchId]); // ⚠️ Sadece tab veya matchId değiştiğinde

// WebSocket event geldiğinde:
// - activeTab değişmedi ('events' hala aktif)
// - matchId değişmedi
// → useEffect çalışmıyor
// → fetchTabData() çağrılmıyor
// → Veriler güncellenmiyor ❌
```

---

## 📊 VERİ AKIŞI DİYAGRAMI

### ✅ İLK YÜKLEME (ÇALIŞIYOR)

```
1. Sayfa Açıldı
   ↓
2. useEffect([matchId]) çalıştı
   ↓
3. fetchMatch() → getLiveMatches()
   ↓
4. Match bilgisi geldi (skor, status, dakika)
   ↓
5. Kullanıcı "Etkinlikler" tab'ına tıkladı
   ↓
6. useEffect([activeTab, matchId]) çalıştı
   ↓
7. fetchTabData() → getMatchDetailLive(matchId)
   ↓
8. Events data geldi (incidents array)
   ↓
9. MatchEventsTimeline component render edildi
   ↓
10. ✅ Veriler gösterildi (11' gol, 29' gol, 47' 2. yarı başladı)
```

---

### ❌ SONRASINDA GÜNCELLENME (ÇALIŞMIYOR)

```
1. Maç Devam Ediyor (50. dakika)
   ↓
2. Yeni gol atıldı (51. dakika)
   ↓
3. Backend: WebSocket event gönderdi
   ↓
4. Frontend: ❌ WebSocket listener YOK
   ↓
5. Frontend: ❌ Polling YOK
   ↓
6. Frontend: ❌ useEffect çalışmıyor (activeTab ve matchId değişmedi)
   ↓
7. ❌ Veriler güncellenmedi
   ↓
8. ❌ Yeni gol görünmüyor
```

---

## 🔍 KOD KANITLARI

### 1. İlk Yükleme (ÇALIŞIYOR)

**Kod:**
```typescript
// MatchDetailPage.tsx:209-222
case 'events':
  // Fetch incidents for events timeline
  let eventsData = await getMatchDetailLive(matchId);
  let incidents = eventsData?.incidents || [];
  
  result = { incidents };
  break;
```

**Ne Zaman Çalışıyor:**
- ✅ Sayfa ilk yüklendiğinde (activeTab değişti)
- ✅ Tab değiştiğinde (activeTab değişti)
- ✅ matchId değiştiğinde

---

### 2. Sonrasında Güncellenme (ÇALIŞMIYOR)

**Kod:**
```typescript
// MatchDetailPage.tsx:250-254
// CRITICAL FIX: Only refetch when activeTab or matchId changes
// match object updates (e.g., WebSocket score changes) should NOT trigger refetch
}, [activeTab, matchId]); // ⚠️ Sadece bu 2 değişken değiştiğinde
```

**Ne Zaman Çalışmıyor:**
- ❌ WebSocket event geldiğinde (activeTab ve matchId değişmedi)
- ❌ Yeni gol atıldığında (activeTab ve matchId değişmedi)
- ❌ Maç durumu değiştiğinde (activeTab ve matchId değişmedi)

---

## 🎯 ÖZET

### ✅ VERİLER GELİYOR:

1. **İlk Yükleme:**
   - Sayfa açıldığında match bilgisi fetch ediliyor
   - Tab'a tıklandığında tab data fetch ediliyor
   - Veriler gösteriliyor

2. **Tab Değişimi:**
   - Başka tab'a tıklandığında o tab'ın data'sı fetch ediliyor
   - Veriler gösteriliyor

### ❌ VERİLER GÜNCELLENMİYOR:

1. **Canlı Maçlarda:**
   - Yeni gol atıldığında events tab güncellenmiyor
   - Yeni olay olduğunda events tab güncellenmiyor
   - İstatistikler değiştiğinde stats tab güncellenmiyor

2. **Match Bilgisi:**
   - Skor değiştiğinde üst kart güncellenmiyor
   - Dakika değiştiğinde üst kart güncellenmiyor
   - Status değiştiğinde üst kart güncellenmiyor

---

## 📋 SONUÇ

**Veriler nasıl geliyor?**
- ✅ İlk yüklemede fetch ediliyor (sayfa açıldığında, tab değiştiğinde)
- ✅ Backend'den API call ile geliyor (`getMatchDetailLive`, `getMatchLiveStats`, vs.)

**Neden güncellenmiyor?**
- ❌ WebSocket entegrasyonu yok
- ❌ Polling yok (kaldırılmış)
- ❌ useEffect sadece `[activeTab, matchId]` değiştiğinde çalışıyor
- ❌ WebSocket event geldiğinde useEffect çalışmıyor

**Çözüm:**
- ✅ WebSocket entegrasyonu ekle
- ✅ WebSocket event geldiğinde tab data'yı yeniden fetch et
- ✅ Match bilgisini WebSocket event'lerine göre güncelle

---

**Rapor Tarihi:** 3 Ocak 2026  
**Hazırlayan:** AI Architect Assistant

