# GoalGPT Database Schema

## Tablo Yapısı

### Kullanıcı Yönetimi
- **customer_users** - Kullanıcı bilgileri (50,000+ kayıt)
- **customer_sessions** - Kullanıcı oturumları
- **customer_subscriptions** - Abonelikler (aktif/expired/in_grace)
- **subscription_plans** - Abonelik planları (haftalık, aylık, yıllık)

### Admin Paneli
- **admin_users** - Admin kullanıcıları
- **admin_roles** - Roller
- **admin_permissions** - İzinler
- **admin_logs** - Admin işlem logları

### Maç Verileri (TheSports.com)
- **ts_matches** - Maçlar (98,000+ kayıt)
- **ts_recent_matches** - Son maçlar
- **ts_match_live_data** - Canlı maç verileri (JSONB)
- **ts_teams** - Takımlar
- **ts_competitions** - Yarışmalar/Ligler
- **ts_seasons** - Sezonlar
- **ts_venues** - Stadyumlar
- **ts_referees** - Hakemler
- **ts_country** - Ülkeler

### Tahmin Sistemi
- **prediction_bot_groups** - Bot grupları (Alert Code: D1, BOT 007, vb.)
- **prediction_bot_competitions** - Bot yarışma eşleştirmeleri
- **ts_prediction_group** - Tahmin grupları
- **ts_prediction_group_item** - Tahmin öğeleri
- **ts_prediction_mapped** - Eşleştirilmiş tahminler
- **ts_prediction_live_view_active** - Aktif canlı tahmin görünümü

### Bildirimler
- **customer_notification_tokens** - Push notification token'ları
- **customer_push_notifications** - Gönderilen bildirimler
- **notification_outbox** - Bildirim kuyruğu

### Destek
- **support_tickets** - Destek talepleri
- **support_ticket_messages** - Destek mesajları

### Diğer
- **favorite_teams** - Favori takımlar

## Önemli Notlar

### Aktif Abonelikler
Aktif abonelikler `customer_subscriptions` tablosunda:
- `status = 'active'` ve `expired_at > NOW()` olan kayıtlar aktif
- `status = 'in_grace'` - Grace period'da olan abonelikler
- `status = 'expired'` - Süresi dolmuş abonelikler

### Maç Durumları
- `status_id = 8` - Canlı maç
- `status_id = 1` - Planlanmış maç
- `status_id = 4` - Biten maç

### Tahmin Bot Grupları
- Alert Code: D1, D2, 21, 31, vb.
- BOT 007, BOT 777
- Her bot grubu farklı tahmin algoritması kullanır

## Veri Bütünlüğü

Tüm tablolar UUID primary key kullanır ve foreign key constraint'leri ile ilişkilendirilmiştir. CSV import işlemi sırasında:
- Mevcut veriler korunur
- Duplicate kayıtlar `ON CONFLICT DO NOTHING` ile atlanır
- Tüm ilişkiler korunur

