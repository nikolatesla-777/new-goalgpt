# Zero-Downtime Deployment Architecture

**Date:** 2025-12-27  
**Status:** ✅ IMPLEMENTED

---

## Problem

502 Bad Gateway hatası deployment sırasında görünüyordu. Bu, kullanıcı deneyimini bozuyordu.

---

## Root Cause

1. **PM2 `restart` kullanımı:** Backend'i durduruyor, yeni instance'ı başlatıyor - downtime oluşuyor
2. **Health check yok:** Backend hazır olmadan deployment tamamlanıyor
3. **Frontend'te retry yok:** 502 hatası durumunda otomatik retry mekanizması yok

---

## Solution: Zero-Downtime Deployment Architecture

### 1. PM2 Reload (Zero-Downtime)

**Before:**
```bash
pm2 restart goalgpt-backend  # ❌ Causes downtime
```

**After:**
```bash
pm2 reload goalgpt-backend --update-env  # ✅ Zero-downtime
```

**How it works:**
- `reload` yeni instance'ı başlatır
- Eski instance çalışmaya devam eder
- Yeni instance hazır olduğunda, trafik yeni instance'a yönlendirilir
- Eski instance graceful shutdown yapar
- **Zero downtime!**

---

### 2. Health Check During Deployment

**Implementation:**
- Deployment sonrası `/ready` endpoint'ini kontrol eder
- Backend hazır olana kadar bekler (max 60 saniye)
- Backend hazır değilse deployment başarısız sayılır

**Code:**
```bash
# Wait for backend to be ready (health check)
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s http://localhost:3000/ready > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 2
done
```

---

### 3. Frontend Graceful Error Handling

**502 Bad Gateway Handling:**
- 502 hatası kullanıcı dostu mesajla gösterilir
- "Backend Hazır Değil" başlığı
- "Sistem güncelleniyor. Lütfen birkaç saniye bekleyin" mesajı
- Otomatik retry (her 3 saniye)
- "Tekrar Dene" butonu

**Code:**
```typescript
// API layer
if (response.status === 502) {
  throw new Error(`HTTP 502: Backend hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.`);
}

// UI layer
const is502Error = error.includes('HTTP 502') || error.includes('502');
// Show friendly message and auto-retry every 3 seconds
```

---

## Deployment Flow

### GitHub Actions Workflow

1. **TypeCheck** ✅
2. **Git Pull** ✅
3. **npm install --production** ✅
4. **PM2 Reload** (zero-downtime) ✅
5. **Health Check** (wait for `/ready`) ✅
6. **Frontend Build** ✅
7. **Frontend Deploy** ✅

### Manual Deploy Script (`deploy.sh`)

Same flow as GitHub Actions, with additional PM2 status checks.

---

## Benefits

1. **Zero Downtime:** Kullanıcılar deployment sırasında hizmet kesintisi yaşamaz
2. **Automatic Recovery:** Backend hazır olana kadar otomatik retry
3. **User-Friendly:** 502 hatası durumunda kullanıcı dostu mesaj
4. **Reliable:** Health check ile deployment doğrulaması

---

## Testing

1. **Deployment Test:**
   ```bash
   # Deploy while monitoring logs
   pm2 logs goalgpt-backend --lines 0 &
   bash deploy.sh
   ```

2. **502 Error Simulation:**
   ```bash
   # Temporarily stop backend
   pm2 stop goalgpt-backend
   # Frontend should show friendly 502 message
   # Restart backend
   pm2 start goalgpt-backend
   # Frontend should automatically recover
   ```

---

## Files Changed

1. `.github/workflows/ci-release.yml` - PM2 reload + health check
2. `deploy.sh` - PM2 reload + health check
3. `frontend/src/api/matches.ts` - 502 error handling
4. `frontend/src/components/MatchList.tsx` - 502 UI + auto-retry

---

## Future Improvements (Optional)

1. **Nginx Health Check:** Nginx'te backend health check ve fallback
2. **Circuit Breaker:** Backend down olduğunda cached data gösterme
3. **Rolling Deployment:** Multiple instance'lar ile true zero-downtime

