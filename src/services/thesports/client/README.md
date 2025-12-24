# TheSports API Client Infrastructure

**FAZ 1.1: ✅ COMPLETED**

## 📁 Dosyalar

### 1. `thesports-client.ts` ✅
- Ana API client
- Retry, Circuit Breaker, Rate Limiter entegrasyonu
- Request/Response interceptors
- Authentication handling

### 2. `retry-handler.ts` ✅
- Exponential backoff retry logic
- Max 3 attempts (configurable)
- Retry condition'ları (hangi hatalarda retry yapılacak)
- Configurable delays

### 3. `circuit-breaker.ts` ✅
- Circuit breaker pattern
- Failure threshold: 5
- Half-open state management
- Timeout: 60s
- State tracking (CLOSED, OPEN, HALF_OPEN)

### 4. `rate-limiter.ts` ✅
- Token bucket algorithm
- Per-endpoint rate limiting
- Configurable limits
- Request queuing

### 5. `test-client.ts` ✅
- Test scripti
- API bağlantı testi

## 🎯 Kullanım

```typescript
import { TheSportsClient } from './thesports-client';

const client = new TheSportsClient();

// Client otomatik olarak retry, circuit breaker ve rate limiter kullanır
const data = await client.get('/match/recent/list', { page: 1, limit: 50 });
```

## 🔧 Configuration

Environment variables (`.env`):
```env
THESPORTS_API_BASE_URL=https://api.thesports.com/v1/football
THESPORTS_API_SECRET=your_secret
THESPORTS_API_USER=your_user
```

## ✅ Features

- ✅ Retry logic with exponential backoff
- ✅ Circuit breaker pattern
- ✅ Rate limiting (token bucket)
- ✅ Error handling
- ✅ Request/Response logging
- ✅ Authentication handling

## 🧪 Test

```bash
tsx src/services/thesports/client/test-client.ts
```

## 📋 Next Steps

- FAZ 1.2: Type Definitions (Enums, Response Types)
- FAZ 1.3: Match Recent Service
