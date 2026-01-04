# H2H ve Lineup Endpoint Sorunları

## Tespit Edilen Sorunlar

### H2H Endpoint (`/api/matches/:match_id/h2h`)

1. **Çalışma Şekli**:
   - Database'den okuyor (`getH2HFromDb`)
   - Database'de yoksa API'den çekiyor (`syncH2HToDb`)
   - `syncH2HToDb` API'den veri çekip database'e kaydediyor
   - Sonra tekrar database'den okuyor

2. **Olası Sorunlar**:
   - API'den veri geliyor ama parse edilemiyor
   - API'den boş data geliyor ve database'e kaydedilmiyor
   - Cache'de boş data var ve API'den tekrar çekilmiyor

### Lineup Endpoint (`/api/matches/:match_id/lineup`)

1. **Çalışma Şekli**:
   - Sadece API'den çekiyor (`/match/lineup/detail`)
   - Cache kullanıyor (1 saat)
   - Database'den okuma YOK

2. **Olası Sorunlar**:
   - API'den boş data geliyor ve cache'leniyor
   - Database'den okuma desteği yok (getMatchH2H gibi database-first approach yok)
   - Cache'de boş data var ve API'den tekrar çekilmiyor

## Çözüm Önerileri

### H2H Endpoint

1. Log'ları kontrol et - API çağrısı yapılıyor mu?
2. API response'unu kontrol et - veri geliyor mu?
3. Cache'i temizle ve tekrar dene
4. `syncH2HToDb` fonksiyonunda hata yakalama ve log ekle

### Lineup Endpoint

1. **KRİTİK**: Database'den okuma desteği ekle (getMatchH2H gibi)
2. Cache'i temizle ve tekrar dene
3. API response'unu kontrol et - veri geliyor mu?
4. Database'de veri varsa önce database'den oku, yoksa API'den çek

