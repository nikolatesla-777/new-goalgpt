# GitHub Actions Setup Guide

**Otomatik Deployment için GitHub Actions Kurulumu**

---

## 📋 GEREKLI SECRETS

GitHub repository ayarlarında şu secrets'ları eklemen gerekiyor:

### Staging Environment

1. **STAGING_HOST**
   - Value: `staging.goalgpt.com`
   - Staging sunucu adresi

2. **STAGING_USER**
   - Value: `root` (veya SSH kullanıcı adın)
   - SSH kullanıcı adı

3. **STAGING_SSH_KEY**
   - Value: SSH private key (tüm içeriği)
   - SSH ile bağlanmak için gerekli

### Production Environment

1. **PRODUCTION_HOST**
   - Value: `production.goalgpt.com`
   - Production sunucu adresi

2. **PRODUCTION_USER**
   - Value: `root`
   - SSH kullanıcı adı

3. **PRODUCTION_SSH_KEY**
   - Value: SSH private key (tüm içeriği)
   - Production SSH key

4. **REDIS_URL**
   - Value: `redis://your-redis-host:6379`
   - Redis connection URL

---

## 🔑 SECRETS NASIL EKLENİR?

### Adım 1: GitHub Repository Ayarları

1. GitHub'da repository'ne git
2. Settings → Secrets and variables → Actions
3. "New repository secret" butonuna tık

### Adım 2: SSH Key Oluştur (Eğer yoksa)

```bash
# SSH key oluştur
ssh-keygen -t ed25519 -C "github-actions@goalgpt.com" -f ~/.ssh/goalgpt_deploy

# Public key'i sunucuya ekle
ssh-copy-id -i ~/.ssh/goalgpt_deploy.pub root@staging.goalgpt.com
ssh-copy-id -i ~/.ssh/goalgpt_deploy.pub root@production.goalgpt.com

# Private key içeriğini kopyala
cat ~/.ssh/goalgpt_deploy
# Bu çıktıyı GitHub secrets'a ekle
```

### Adım 3: Her Secret için

**Name**: `STAGING_HOST`
**Secret**: `staging.goalgpt.com`

**Name**: `STAGING_USER`
**Secret**: `root`

**Name**: `STAGING_SSH_KEY`
**Secret**:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
... (tüm key içeriği)
-----END OPENSSH PRIVATE KEY-----
```

**Name**: `PRODUCTION_HOST`
**Secret**: `production.goalgpt.com`

**Name**: `PRODUCTION_USER`
**Secret**: `root`

**Name**: `PRODUCTION_SSH_KEY**
**Secret**: (production SSH key içeriği)

**Name**: `REDIS_URL`
**Secret**: `redis://your-redis-cloud-url:6379`

---

## 🚀 WORKFLOW'LARI ÇALIŞTIRMA

### 1. Otomatik Staging Deployment

**Ne zaman çalışır**: Her `main` branch'e push edildiğinde

**Manuel çalıştırma**:
1. GitHub → Actions → "Deploy to Staging"
2. "Run workflow" → "Run workflow"
3. ✅ Otomatik test ve deploy başlar

**Ne yapar**:
- ✅ Kodu staging'e deploy eder
- ✅ PR-P1B testlerini çalıştırır
- ✅ PR-P1C testlerini çalıştırır
- ✅ Başarısız olursa otomatik rollback

---

### 2. Manuel Production Deployment

**Workflow**: "Deploy to Production"

**Adımlar**:
1. GitHub → Actions → "Deploy to Production"
2. "Run workflow" butonuna tıkla
3. **deployment_stage** seç:
   - `week1-day1-pr-p1a` → PR-P1A indexes
   - `week1-day4-pr-p1b-partial` → Daily rewards only
   - `week1-day5-pr-p1b-full` → Full PR-P1B
   - `week2-pr-p1c-conservative` → Conservative limits
   - `week2-pr-p1c-optimized` → Optimized limits
   - `week3-pr-p1d-indexes` → PR-P1D indexes
   - `week3-pr-p1d-caching` → Full caching
4. **confirm** alanına `DEPLOY` yaz
5. "Run workflow"

**Örnek Kullanım**:

**Week 1, Day 1 (Pazartesi)**:
- Stage: `week1-day1-pr-p1a`
- Confirm: `DEPLOY`
- → PR-P1A indexes deploy edilir

**Week 1, Day 4 (Perşembe)**:
- Stage: `week1-day4-pr-p1b-partial`
- Confirm: `DEPLOY`
- → Daily rewards optimization aktif olur

**Week 1, Day 5 (Cuma)**:
- Stage: `week1-day5-pr-p1b-full`
- Confirm: `DEPLOY`
- → Tüm PR-P1B optimizasyonları aktif olur

---

### 3. Acil Rollback

**Workflow**: "Emergency Rollback"

**Ne zaman kullanılır**: Production'da sorun olduğunda

**Adımlar**:
1. GitHub → Actions → "Emergency Rollback"
2. "Run workflow"
3. **environment** seç: `staging` veya `production`
4. **confirm** alanına `ROLLBACK` yaz
5. "Run workflow"

**Ne yapar** (30 saniye):
- ❌ Tüm optimizasyonları kapatır
- ❌ Caching'i kapatır
- ✅ API'yi restart eder
- ✅ Health check yapar
- 🔔 Otomatik incident issue oluşturur

---

## 🔍 WORKFLOW DURUMUNU İZLEME

### GitHub Actions Tab'ı

1. Repository → Actions
2. Son workflow run'ları görebilirsin
3. Her step'in loglarını görebilirsin
4. Başarısız step'leri inceleyebilirsin

### Email Notifications

GitHub otomatik email gönderir:
- ✅ Deployment başarılı
- ❌ Deployment başarısız
- 🔄 Rollback tamamlandı

---

## 📊 DEPLOYMENT SUMMARY

Her workflow sonunda GitHub'da "Summary" görürsün:

**Örnek**:
```
## Staging Deployment Report

**Date**: 2026-02-02 11:30:00
**Commit**: abc123...
**Branch**: main

### Status
✅ Deployed successfully

### Tests
✅ PR-P1B tests passed (7/7)
✅ PR-P1C tests passed (8/8)
```

---

## 🐛 TROUBLESHOOTING

### Issue: SSH Connection Failed

**Hata**: `Permission denied (publickey)`

**Çözüm**:
1. SSH key'in doğru oluşturulduğunu kontrol et
2. Public key'in sunucuda olduğunu doğrula:
   ```bash
   ssh -i ~/.ssh/goalgpt_deploy root@staging.goalgpt.com "echo 'Connected'"
   ```
3. Private key'in tam olarak GitHub secrets'a eklendiğini kontrol et (başta/sonda boşluk olmamalı)

---

### Issue: Workflow Permission Denied

**Hata**: `Workflow does not have permission`

**Çözüm**:
1. Settings → Actions → General
2. "Workflow permissions" bölümünde:
   - ✅ "Read and write permissions" seç
   - ✅ "Allow GitHub Actions to create and approve pull requests" işaretle
3. Save

---

### Issue: Environment Not Found

**Hata**: `Environment 'production' not found`

**Çözüm**:
1. Settings → Environments
2. "New environment" → `production` oluştur
3. (Optional) "Required reviewers" ekle (manuel approval için)
4. Save

Aynısını `staging` için de yap.

---

## ✅ SETUP CHECKLIST

Deployment'tan önce:

- [ ] Tüm secrets eklendi (8 adet)
  - [ ] STAGING_HOST
  - [ ] STAGING_USER
  - [ ] STAGING_SSH_KEY
  - [ ] PRODUCTION_HOST
  - [ ] PRODUCTION_USER
  - [ ] PRODUCTION_SSH_KEY
  - [ ] REDIS_URL

- [ ] SSH key'ler test edildi
  ```bash
  ssh -i ~/.ssh/goalgpt_deploy root@staging.goalgpt.com
  ssh -i ~/.ssh/goalgpt_deploy root@production.goalgpt.com
  ```

- [ ] Environments oluşturuldu
  - [ ] staging
  - [ ] production

- [ ] Workflow permissions ayarlandı
  - [ ] Read and write permissions: ✅
  - [ ] Allow create PRs: ✅

- [ ] Test workflow çalıştırıldı
  ```
  Actions → "Run Tests" → Manuel trigger
  ```

---

## 🎯 İLK DEPLOYMENT

Secrets setup'ı tamamlandıktan sonra:

### 1. Test Workflow'u Çalıştır

```
Actions → "Run Tests" → Run workflow
```

Beklenen: ✅ All checks passed

### 2. Staging'e Deploy Et

```
Actions → "Deploy to Staging" → Run workflow
```

Beklenen:
- ✅ Deploy başarılı
- ✅ PR-P1B tests passed
- ✅ PR-P1C tests passed

### 3. Production'a Deploy Et (Week 1, Day 1)

```
Actions → "Deploy to Production" → Run workflow
Stage: week1-day1-pr-p1a
Confirm: DEPLOY
```

Beklenen: ✅ PR-P1A indexes deployed

---

## 📞 DESTEK

Sorun olursa:

1. **Workflow logs**: Actions → Failed workflow → İlgili step
2. **Server logs**: SSH ile bağlan → `tail -100 logs/error.log`
3. **Rollback**: Emergency Rollback workflow'u çalıştır

---

**Son Güncelleme**: 2026-02-02
**Versiyon**: 1.0
**Status**: ✅ Ready for setup

