# Bugünün Maçları için H2H/Lineups/Standings Sync

## Durum

Kod implement edildi ama deploy edilmedi. Bugünün maçları için **manuel trigger** gerekiyor.

## Çözüm: Manuel Trigger

### Endpoint
```
POST /api/matches/admin/pre-sync
```

### Curl Komutu
```bash
curl -X POST http://142.93.103.128:3000/api/matches/admin/pre-sync
```

### Sonuç
- Bugünün tüm maçlarının H2H verileri database'e yazılacak
- Bugünün tüm maçlarının Lineups verileri database'e yazılacak  
- Bugünün tüm liglerinin Standings verileri database'e yazılacak

## Otomatik Çalışma

Deploy edildikten sonra, **yarın 00:05'te** otomatik olarak:
- Yeni günün maçları sync edilecek
- NOT_STARTED (status_id = 1) maçlar için H2H/Lineups/Standings pre-sync çalışacak

## Frontend Fallback

Frontend'te zaten API fallback var:
- Kullanıcı H2H sekmesine tıklayınca `/api/matches/:match_id/h2h` çağrılıyor
- Database'de yoksa API'den çekilip database'e yazılıyor
- Ama bu tek tek çalışıyor, toplu sync değil

