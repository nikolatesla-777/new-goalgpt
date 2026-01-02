# FAZ 3: WebSocket Integration & Speed Optimization

**Tarih:** 2026-01-02  
**Durum:** 🚧 PLAN HAZIRLANIYOR  
**Hedef:** AiScore/Mackolik hızında gol bilgisi (saniye içinde) ve diğer eventler

---

## 🎯 HEDEF

### Ana Hedef
- **Gol bilgisi:** Saniye içinde (1-2 saniye) hem match detail card'da hem de livescore page'de görünmeli
- **Diğer eventler:** Cards, substitutions, status changes de aynı hızda olmalı
- **Eş zamanlı güncelleme:** Match detail card ve livescore page aynı anda güncellenmeli

---

## 📊 MEVCUT DURUM

### WebSocket Servisi ✅
- `WebSocketService` mevcut ve çalışıyor
- MQTT bağlantısı var
- Event handling var (GOAL, SCORE_CHANGE, MATCH_STATE_CHANGE)

### Frontend WebSocket ✅
- `MatchList.tsx` WebSocket bağlantısı var
- Event handling genişletildi (MATCH_STATE_CHANGE eklendi)
- Reconnection logic var

### Backend WebSocket ⚠️
- Event handling var ama optimize edilmemiş
- Database write'lar optimize edilmemiş
- Event delivery speed optimize edilmemiş

---

## 🔍 ANALİZ EDİLECEK ALANLAR

### 1. WebSocket Event Processing Speed
- **Sorun:** Event'ler işlenirken database write'lar yavaş olabilir
- **Çözüm:** Database write'ları optimize et, batch write kullan

### 2. Frontend Event Delivery
- **Sorun:** WebSocket event'leri frontend'e ulaşmadan önce gecikme olabilir
- **Çözüm:** Event broadcasting'i optimize et

### 3. Database Write Optimization
- **Sorun:** Her event için ayrı database write yapılıyor
- **Çözüm:** Batch write veya write queue kullan

### 4. Match Detail Card Update
- **Sorun:** Match detail card WebSocket event'lerini dinlemiyor olabilir
- **Çözüm:** Match detail card'a WebSocket event handling ekle

---

## 🎯 YAPILACAKLAR

### FAZ 3.1: WebSocket Event Processing Speed Optimization
- [ ] Database write'ları optimize et
- [ ] Batch write kullan (birden fazla event'i birleştir)
- [ ] Write queue implementasyonu
- [ ] Event processing latency ölçümü

### FAZ 3.2: Frontend Event Delivery Optimization
- [ ] WebSocket event broadcasting'i optimize et
- [ ] Event delivery latency ölçümü
- [ ] Frontend event handling'i optimize et

### FAZ 3.3: Match Detail Card WebSocket Integration
- [ ] Match detail card'a WebSocket event handling ekle
- [ ] Goal notification'ları match detail card'da göster
- [ ] Eş zamanlı güncelleme garantisi

### FAZ 3.4: Real-time Update Guarantee
- [ ] Match detail card ve livescore page'de eş zamanlı güncelleme
- [ ] Event delivery latency < 2 saniye garantisi
- [ ] Performance monitoring

---

## 📋 TEST SENARYOLARI

### Senaryo 1: Goal Notification Speed Test
1. Canlı bir maçı izle
2. Gol atıldığında:
   - WebSocket event'inin gelme süresi
   - Database write süresi
   - Frontend update süresi
   - Toplam latency

### Senaryo 2: Match Detail Card Update Test
1. Match detail card'ı aç
2. Gol atıldığında:
   - Card'ın güncellenme süresi
   - Livescore page ile eş zamanlı mı?

### Senaryo 3: Multiple Events Test
1. Kısa sürede birden fazla event (goal, card, substitution)
2. Tüm event'lerin hızlı işlendiğini doğrula

---

## 🎯 BAŞARI KRİTERLERİ

- ✅ Goal notification latency < 2 saniye
- ✅ Match detail card ve livescore page eş zamanlı güncelleniyor
- ✅ Database write'lar optimize edildi
- ✅ Event delivery speed optimize edildi

---

**Son Güncelleme:** 2026-01-02 23:00 UTC  
**Durum:** 🚧 PLAN HAZIRLANIYOR

