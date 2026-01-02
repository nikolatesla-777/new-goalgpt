# FAZ 3.2: Database Write Optimization

**Tarih:** 2026-01-02 23:30 UTC  
**Durum:** 🚧 PLAN HAZIRLANIYOR  
**Hedef:** Database write'ları optimize etmek, batch write ve write queue eklemek

---

## 🎯 HEDEF

### Ana Hedef
- **Batch write:** Birden fazla event'i birleştirip tek bir database write yapmak
- **Write queue:** Event'leri queue'ya ekleyip batch olarak işlemek
- **Latency azaltma:** Database write latency'sini minimize etmek
- **Throughput artırma:** Daha fazla event'i daha hızlı işlemek

---

## 📊 MEVCUT DURUM ANALİZİ

### Mevcut Database Write Mekanizması

**Her event için ayrı write:**
1. `updateMatchInDatabase()` - Score events
2. `updateMatchIncidentsInDatabase()` - Incidents events
3. `updateMatchStatisticsInDatabase()` - Stats events
4. `updateMatchStatusInDatabase()` - Status events

**Sorunlar:**
- ❌ Her event için ayrı database connection
- ❌ Her event için ayrı optimistic locking check
- ❌ Her event için ayrı UPDATE query
- ❌ Latency artıyor (her write ~10-50ms)
- ❌ Database connection pool pressure

---

## 🔍 ANALİZ EDİLECEK ALANLAR

### 1. Write Frequency Analysis
- Kaç event/dakika geliyor?
- Aynı maç için kaç event geliyor?
- Batch write için fırsatlar neler?

### 2. Write Queue Design
- Queue size limit?
- Batch size?
- Flush interval?
- Error handling?

### 3. Batch Write Strategy
- Aynı maç için event'leri birleştir?
- Farklı maçlar için batch write?
- Optimistic locking nasıl handle edilir?

---

## 🎯 YAPILACAKLAR

### FAZ 3.2.1: Write Queue Implementation
- [ ] Write queue class oluştur
- [ ] Event batching logic
- [ ] Flush mechanism
- [ ] Error handling

### FAZ 3.2.2: Batch Write Implementation
- [ ] Batch UPDATE query'leri
- [ ] Optimistic locking batch check
- [ ] Transaction management

### FAZ 3.2.3: Integration
- [ ] WebSocketService'e write queue entegre et
- [ ] Mevcut write metodlarını queue'ya yönlendir
- [ ] Performance monitoring

### FAZ 3.2.4: Testing & Optimization
- [ ] Latency ölçümü
- [ ] Throughput testi
- [ ] Error scenario testi

---

## 📋 IMPLEMENTATION PLAN

### 1. Write Queue Class

```typescript
class MatchWriteQueue {
  private queue: Map<string, MatchUpdateBatch>;
  private flushInterval: NodeJS.Timeout | null;
  private batchSize: number;
  private flushIntervalMs: number;

  // Add update to queue
  enqueue(matchId: string, update: MatchUpdate): void;

  // Flush queue to database
  async flush(): Promise<void>;

  // Batch write to database
  private async batchWrite(batches: MatchUpdateBatch[]): Promise<void>;
}
```

### 2. Batch Update Structure

```typescript
interface MatchUpdateBatch {
  matchId: string;
  updates: {
    score?: ParsedScore;
    incidents?: any[];
    statistics?: Record<string, any>;
    status?: number;
  };
  providerUpdateTime: number | null;
  ingestionTs: number;
}
```

### 3. Batch Write Query

```sql
-- Batch UPDATE for multiple matches
UPDATE ts_matches
SET 
  status_id = CASE external_id 
    WHEN $1 THEN $2
    WHEN $3 THEN $4
    ...
  END,
  home_score_display = CASE external_id
    WHEN $1 THEN $5
    WHEN $3 THEN $6
    ...
  END,
  ...
WHERE external_id IN ($1, $3, ...)
```

---

## 🎯 BAŞARI KRİTERLERİ

- ✅ Database write latency %50 azaldı
- ✅ Throughput %200 arttı
- ✅ Connection pool pressure azaldı
- ✅ Error handling iyileştirildi

---

**Son Güncelleme:** 2026-01-02 23:30 UTC  
**Durum:** 🚧 PLAN HAZIRLANIYOR

