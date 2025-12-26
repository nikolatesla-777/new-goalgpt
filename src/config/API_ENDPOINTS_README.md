# TheSports API Endpoints Configuration

## 📋 Genel Bakış

Bu dosya (`api-endpoints.ts`), tüm TheSports API endpoint'lerinin merkezi yapılandırmasını içerir. **"Hata Payı 0"** hedefiyle, tüm API linklerini tek bir kaynakta toplar ve tip güvenliği sağlar.

## 🎯 Kullanım

### Endpoint'e Erişim

```typescript
import { API_ENDPOINTS, getEndpointUrl, getEndpointConfig } from './config/api-endpoints';

// Endpoint URL'ini al
const url = getEndpointUrl('matchRecent');
// => 'https://api.thesports.com/v1/football/match/recent/list'

// Endpoint konfigürasyonunu al
const config = getEndpointConfig('matchRecent');
// => { url: '/match/recent/list', frequency: { value: 1, unit: 'minute' }, ... }
```

### Frequency Hesaplama

```typescript
import { getFrequencyInMs } from './config/api-endpoints';

// Cron job için milisaniye cinsinden frequency
const frequencyMs = getFrequencyInMs('matchRecent');
// => 60000 (1 dakika)
```

## 📊 Endpoint Kategorileri

### A - Basic Info Endpoints (11 endpoint)

Temel bilgi endpoint'leri (kategori, ülke, lig, takım, oyuncu, vb.):

- `category` - Kategoriler (1 gün/1 kez)
- `country` - Ülkeler (1 gün/1 kez)
- `competition` - Ligler (1 dakika/1 kez, incremental)
- `team` - Takımlar (1 dakika/1 kez, incremental)
- `player` - Oyuncular (1 dakika/1 kez, incremental)
- `coach` - Teknik Direktörler (1 dakika/1 kez, incremental)
- `referee` - Hakemler (1 dakika/1 kez, incremental)
- `venue` - Stadyumlar (1 dakika/1 kez, incremental)
- `season` - Sezonlar (1 dakika/1 kez, incremental)
- `stage` - Aşamalar (1 dakika/1 kez, incremental)
- `dataUpdate` - Veri güncellemeleri (20 saniye/1 kez)

### B - Basic Data Endpoints (20 endpoint)

Maç verisi ve istatistik endpoint'leri:

- `matchRecent` - Son maçlar (1 dakika/1 kez, incremental)
- `matchDiary` - Günlük bülten (10 dakika/1 kez, bugün için)
- `matchSeasonRecent` - Sezon maçları (1 saat/1 kez)
- `matchDetailLive` - Canlı maç detayı (2 saniye/1 kez, realtime)
- `matchTrendLive` - Canlı trend (1 dakika/1 kez, realtime)
- `matchTrendDetail` - Trend detayı (1 saat/1 kez)
- `matchLineupDetail` - Kadro detayı (1 dakika/1 kez)
- `matchPlayerStatsList` - Oyuncu istatistikleri (1 dakika/1 kez)
- `matchTeamStatsList` - Takım istatistikleri (1 dakika/1 kez)
- `matchTeamHalfStatsList` - Devre arası istatistikleri (1 dakika/1 kez)
- `matchAnalysis` - H2H analizi (1 saat/1 kez)
- `seasonStandingDetail` - Puan durumu (5 dakika/1 kez)
- `matchLiveHistory` - Geçmiş maçlar (1 saat/1 kez)
- `matchPlayerStatsDetail` - Oyuncu istatistik detayı (1 saat/1 kez)
- `matchTeamStatsDetail` - Takım istatistik detayı (1 saat/1 kez)
- `matchTeamHalfStatsDetail` - Devre arası istatistik detayı (1 saat/1 kez)
- `compensationList` - Tarihsel karşılaştırma (1 dakika/1 kez, incremental)
- `tableLive` - Canlı puan durumu (1-5 dakika/1 kez)
- `matchGoalLineDetail` - Gol çizgisi (1 dakika/1 kez)
- `deleted` - Silinen veriler (1-5 dakika/1 kez)

## 🔧 Sync Method'ları

- **`static`**: Veri nadiren değişir (kategori, ülke)
- **`full`**: Her seferinde tam veri çekilir (günlük bülten, sezon maçları)
- **`incremental`**: Sadece değişen veriler çekilir (lig, takım, maç)
- **`realtime`**: Gerçek zamanlı güncellemeler (canlı skor, istatistikler)

## 📝 Önemli Notlar

1. **Pagination**: `supportsPagination: true` olan endpoint'ler için sayfa sayfa veri çekilmelidir.
2. **Time Increment**: `supportsTimeIncrement: true` olan endpoint'ler için `time` parametresi kullanılmalıdır.
3. **Rate Limits**: Bazı endpoint'lerde `rateLimit` tanımlıdır (örn: 120 req/min).
4. **Time Limits**: Bazı endpoint'lerde `timeLimit` tanımlıdır (örn: 30 gün öncesi/sonrası).

## 🚀 Entegrasyon Örneği

```typescript
import { API_ENDPOINTS, getEndpointUrl, getFrequencyInMs } from './config/api-endpoints';
import { TheSportsClient } from './services/thesports/client/thesports-client';

const client = new TheSportsClient();

// Endpoint konfigürasyonunu kullan
const endpoint = API_ENDPOINTS.matchRecent;
const url = getEndpointUrl('matchRecent');
const frequency = getFrequencyInMs('matchRecent');

// API çağrısı
const response = await client.get(endpoint.url, {
  page: 1,
  limit: 100,
  time: lastSyncTimestamp,
});
```

## ✅ Type Safety

Tüm endpoint key'leri TypeScript ile tip güvenliği sağlar:

```typescript
import { ApiEndpointKey } from './config/api-endpoints';

function fetchData(endpoint: ApiEndpointKey) {
  // TypeScript otomatik olarak geçerli endpoint key'lerini önerir
  const config = getEndpointConfig(endpoint);
  // ...
}
```









