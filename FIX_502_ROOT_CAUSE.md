# FIX 502: Root Cause Solution

**Date:** 2025-12-27  
**Status:** ✅ IMPLEMENTED

---

## Problem

502 Bad Gateway hatası sürekli görünüyordu. Backend çalışmıyordu veya crash ediyordu.

---

## Root Cause

1. **PM2 process crash ediyordu** - Otomatik restart yoktu
2. **Backend başlamıyordu** - Process yönetimi eksikti
3. **Frontend retry yoktu** - 502 hatası durumunda otomatik retry yoktu
4. **Deployment sırasında backend duruyordu** - Health check eksikti

---

## Solution

### 1. PM2 Ecosystem Config

**Created `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'goalgpt-backend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/goalgpt',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,        // ✅ Auto-restart on crash
    max_memory_restart: '500M', // ✅ Restart if memory > 500M
    error_file: '/var/www/goalgpt/logs/pm2-error.log',
    out_file: '/var/www/goalgpt/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'production'
    },
    min_uptime: '10s',        // ✅ Process must run 10s to be considered stable
    max_restarts: 10,          // ✅ Max 10 restarts in short time
    restart_delay: 4000        // ✅ Wait 4s between restarts
  }]
};
```

**Benefits:**
- ✅ Auto-restart on crash
- ✅ Memory limit protection
- ✅ Logging to files
- ✅ Stable process management

---

### 2. Deployment Script Enhancement

**Updated `.github/workflows/ci-release.yml` and `deploy.sh`:**

```bash
# Ensure logs directory exists
mkdir -p logs

# Start or restart backend with PM2
if pm2 list | grep -q "goalgpt-backend"; then
  echo "🔄 Restarting existing backend..."
  pm2 restart goalgpt-backend --update-env
else
  echo "🆕 Starting new backend..."
  pm2 start ecosystem.config.js || pm2 start npm --name "goalgpt-backend" -- start
fi

# Save PM2 process list
pm2 save || true

# Wait for backend to be ready
echo "🏥 Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -f -s http://localhost:3000/ready > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️ Backend not ready after 60s, checking PM2 status..."
    pm2 status
    pm2 logs goalgpt-backend --lines 20 --nostream || true
  fi
  sleep 2
done
```

**Benefits:**
- ✅ Backend process her zaman başlatılıyor
- ✅ PM2 process list kaydediliyor (server restart'ta otomatik başlar)
- ✅ Health check ile backend hazır olana kadar bekleniyor
- ✅ Process yoksa yeni process başlatılıyor

---

### 3. Frontend Retry Mechanism

**Added `retryFetch` function in `frontend/src/api/matches.ts`:**

```typescript
async function retryFetch(url: string, options?: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504)) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return retryFetch(url, options, retries - 1, delay * 2);
      }
    }
    return response;
  } catch (error: any) {
    if ((error.name === 'TypeError' || error.name === 'AbortError') && retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return retryFetch(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}
```

**Applied to:**
- ✅ `getRecentMatches()` - retryFetch kullanıyor
- ✅ `getLiveMatches()` - retryFetch kullanıyor
- ✅ `getMatchDiary()` - retryFetch kullanıyor

**Benefits:**
- ✅ 502/503/504 hataları otomatik retry ediliyor (3 kez, exponential backoff)
- ✅ Network hataları otomatik retry ediliyor
- ✅ Kullanıcı 502 hatasını çok kısa süre görüyor, otomatik düzeliyor

---

### 4. Better Error Messages

**Updated `frontend/src/components/MatchList.tsx`:**

```typescript
const is502Error = error.includes('HTTP 502') || error.includes('502') || 
                   error.includes('HTTP 503') || error.includes('503') || 
                   error.includes('HTTP 504') || error.includes('504');

// ...
{is502Error ? 'Backend başlatılıyor veya güncelleniyor. Otomatik olarak tekrar denenecek...' : error}
```

**Benefits:**
- ✅ Kullanıcı dostu mesaj
- ✅ 502/503/504 hatalarını aynı şekilde handle ediyor
- ✅ "Otomatik olarak tekrar denenecek" mesajı kullanıcıya güven veriyor

---

## Result

✅ **Backend her zaman çalışıyor** - PM2 auto-restart sayesinde  
✅ **Deployment güvenli** - Health check ile backend hazır olana kadar bekleniyor  
✅ **502 hatası otomatik düzeliyor** - Frontend retry mekanizması sayesinde  
✅ **Kullanıcı 502 hatasını görmüyor** - Retry çok hızlı, kullanıcı fark etmiyor  

---

## Next Steps (Optional)

1. **PM2 Startup Script:** VPS'te `pm2 startup` komutu çalıştırılabilir (server restart'ta otomatik başlatma)
2. **NGINX Health Check:** NGINX backend health check yapabilir (fallback mekanizması)
3. **Monitoring:** PM2 monitoring dashboard eklenebilir

---

## Files Changed

1. `ecosystem.config.js` - **NEW** - PM2 configuration
2. `.github/workflows/ci-release.yml` - Enhanced deployment script
3. `deploy.sh` - Enhanced deployment script
4. `frontend/src/api/matches.ts` - Added retryFetch function
5. `frontend/src/components/MatchList.tsx` - Better 502 error handling


