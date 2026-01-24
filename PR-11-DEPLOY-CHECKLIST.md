# PR-11 Deployment Checklist
**Date**: 2026-01-24
**Branch**: `pr-11-route-dedup` → `main`

---

## 🎯 Pre-Merge Checklist

- [x] All 5 routes updated with deprecation
- [x] Deprecation utilities created and tested
- [x] TypeScript compilation passes (no new errors in PR-11 files)
- [x] No conflicts with PR-12
- [x] Documentation complete:
  - [x] PR-11-ROUTE-ANALYSIS.md
  - [x] PR-11-IMPLEMENTATION-SUMMARY.md
  - [x] PR-11-DEPLOY-CHECKLIST.md
- [x] Smoke test script created (`scripts/PR-11-smoke.sh`)
- [x] Commit created with detailed message
- [x] Changes reviewed

---

## 🚀 Merge & Deploy Steps

### Step 1: Merge to Main
```bash
git checkout main
git pull origin main
git merge pr-11-route-dedup --no-ff
git push origin main
```

**Expected**: Fast-forward or merge commit, no conflicts

---

### Step 2: Deploy to VPS
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt
git pull origin main
npm install
npm run build
pm2 restart goalgpt
pm2 logs goalgpt --lines 50
```

**Expected**:
- Git pull successful
- Build completes without errors
- PM2 restart successful
- Server starts without errors

---

### Step 3: Run Smoke Tests
```bash
# From local machine
API_BASE=http://142.93.103.128:3000 ./scripts/PR-11-smoke.sh
```

**Expected**: All tests pass
- ✅ 5 legacy endpoints return valid responses (200/400/404)
- ✅ Deprecation headers present on all legacy routes
- ✅ Canonical endpoints still work

---

### Step 4: Manual Verification
```bash
# Test deprecation headers manually
curl -i http://142.93.103.128:3000/api/auth/legacy/check \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone": "+905551234567"}'
```

**Look for in response headers**:
```
Deprecation: true
Sunset: 2026-04-24T00:00:00Z
Link: /api/auth/phone/login; rel="alternate"
X-Deprecation-Message: Legacy user check is deprecated...
```

---

## 📊 10-Minute Monitoring Checklist

### Monitor 1: Error Rates (PM2 logs)
```bash
# On VPS
pm2 logs goalgpt --lines 100 | grep -E "error|ERROR|Error"
```

**Expected**: No spike in errors related to deprecation

---

### Monitor 2: Deprecation Logs
```bash
# On VPS
pm2 logs goalgpt | grep "Deprecation"
```

**Expected**:
- Deprecation logs appear when legacy routes are accessed
- Logs are rate-limited (same route+IP logs max once per 60s)
- Format: `[Deprecation] Legacy route accessed`

---

### Monitor 3: Response Times
```bash
# Test a few endpoints for latency
time curl -s http://142.93.103.128:3000/api/matches/live > /dev/null
time curl -s http://142.93.103.128:3000/api/auth/legacy/check \
  -X POST -H "Content-Type: application/json" \
  -d '{"phone": "+905551234567"}' > /dev/null
```

**Expected**: No significant latency increase (<100ms overhead)

---

### Monitor 4: HTTP Status Codes
```bash
# Check for 4xx/5xx spike
pm2 logs goalgpt --lines 200 | grep -oE "HTTP/[0-9.]+ [0-9]{3}" | sort | uniq -c
```

**Expected**: Normal distribution, no unusual spike in 4xx/5xx

---

### Monitor 5: Live Endpoints Still Working
```bash
# Verify critical endpoints
curl -s http://142.93.103.128:3000/api/matches/live | jq '.[] | .id' | head -5
curl -s http://142.93.103.128:3000/api/predictions/matched | jq '.matched | length'
```

**Expected**: All canonical endpoints return valid data

---

## ✅ Success Criteria

After 10 minutes, all of these should be true:

- [ ] No error spike in PM2 logs
- [ ] Deprecation logs appear (rate-limited)
- [ ] Legacy routes return 200 + deprecation headers
- [ ] Canonical routes unchanged and working
- [ ] No significant latency increase
- [ ] No 4xx/5xx spike
- [ ] Smoke tests pass in production

---

## 🔄 Rollback Plan (If Issues Detected)

### Quick Rollback (< 30 seconds)
```bash
# On VPS
cd /var/www/goalgpt
git reset --hard ca6bccf  # Previous commit (Production Hardening)
pm2 restart goalgpt
```

### Verify Rollback
```bash
# Check current commit
git log --oneline -1

# Should show: ca6bccf Production Hardening: Post PR-8B.1 improvements
```

---

## 📝 Post-Deployment Report Template

### Deployment Summary
- **Start Time**: _____
- **End Time**: _____
- **Duration**: _____
- **Status**: ✅ Success / ⚠️ Issues / ❌ Rolled Back

### Smoke Test Results
- **Canonical Endpoints**: PASS / FAIL
- **Legacy Endpoints**: PASS / FAIL
- **Deprecation Headers**: PASS / FAIL

### Monitoring Results (10 min)
- **Error Rate**: Normal / Increased
- **Deprecation Logs**: Present / Missing
- **Latency**: Normal / Increased
- **HTTP Status Codes**: Normal / Spike Detected

### Issues Encountered
_None_ or _List issues here_

### Actions Taken
_None_ or _List actions here_

### Next Steps
- [ ] Update documentation with production URLs
- [ ] Monitor deprecation usage over next 7 days
- [ ] Contact clients using legacy routes (if any)
- [ ] Plan sunset timeline communication

---

**Prepared By**: Claude Sonnet 4.5
**Date**: 2026-01-24
