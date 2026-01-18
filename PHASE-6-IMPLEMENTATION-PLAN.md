# FAZ 6: MOBİL APP - AUTHENTICATION
## Detaylı İmplementasyon Planı

**Faz:** 6 / 13
**Modül:** Mobil Uygulama - Kimlik Doğrulama
**Bağımlılıklar:** Faz 5 (Proje Kurulum) ✅
**Tahmini Süre:** 5-7 gün (1 hafta)
**Kompleksite:** 🔴 YÜKSEK (OAuth entegrasyonları, güvenlik kritik)

---

## 📋 YÖNETİCİ ÖZETİ

Faz 6, GoalGPT mobil uygulaması için eksiksiz kimlik doğrulama sistemini implement eder. Üç farklı auth metodu desteklenir:

### Desteklenen Auth Metodları
1. **Google Sign In** - OAuth 2.0 ile
2. **Apple Sign In** - iOS için Sign In with Apple
3. **Telefon Doğrulama** - Firebase Phone Auth + SMS OTP

### Başarı Kriterleri
- ✅ Her üç auth metodu iOS ve Android'de çalışıyor
- ✅ JWT token'lar güvenli şekilde SecureStore'da
- ✅ Otomatik token yenileme (401 hataları)
- ✅ Auth durumu uygulama yeniden başlatmada korunuyor
- ✅ Korumalı route'lar login'e yönlendiriyor
- ✅ Yeni kullanıcılar için onboarding akışı
- ✅ Kullanıcı profil verisi başarılı login sonrası çekiliyor
- ✅ Sıfır auth kaynaklı crash

---

## 🎯 GÖREVLER (10 Görev)

### Görev 6.1: Firebase Yapılandırması
**Süre:** 30 dakika
**Öncelik:** KRİTİK

**Yapılacaklar:**
1. Firebase Console'da proje oluştur
2. Google Sign In provider'ı aktif et
3. Phone Authentication provider'ı aktif et
4. `google-services.json` (Android) indir
5. `GoogleService-Info.plist` (iOS) indir
6. OAuth consent screen yapılandır
7. Firebase config'i `app.json`'a ekle

**Çıktılar:**
- ✅ Firebase projesi hazır
- ✅ OAuth providers aktif
- ✅ Config dosyaları indirildi

---

### Görev 6.2: Auth Dependencies Kurulumu
**Süre:** 20 dakika
**Öncelik:** KRİTİK

**Kurulacak Paketler:**
```bash
# Firebase
npm install --legacy-peer-deps firebase

# Google Sign In
npm install --legacy-peer-deps @react-native-google-signin/google-signin

# Apple Sign In
npm install --legacy-peer-deps @invertase/react-native-apple-authentication

# Expo Auth Session (OAuth alternative)
npm install --legacy-peer-deps expo-auth-session expo-crypto expo-web-browser

# Zaten kurulu: expo-secure-store, @react-native-async-storage/async-storage
```

**Platform Yapılandırması:**
- iOS: `CFBundleURLTypes` ekle
- Android: Google Play Services meta-data

---

### Görev 6.3: Firebase Service Wrapper
**Süre:** 45 dakika
**Öncelik:** YÜKSEK

**Dosya:** `src/services/firebase.service.ts` (~200 satır)

**Fonksiyonlar:**
```typescript
// Firebase başlatma
export function initializeFirebase(): void

// Google Sign In
export async function signInWithGoogleCredential(idToken: string): Promise<FirebaseUser>

// Phone Auth
export function initializeRecaptcha(containerId: string): RecaptchaVerifier
export async function sendPhoneVerificationCode(phoneNumber: string): Promise<ConfirmationResult>
export async function verifyPhoneCode(confirmationResult: ConfirmationResult, code: string): Promise<FirebaseUser>

// Token işlemleri
export async function getFirebaseIdToken(): Promise<string | null>
export async function firebaseSignOut(): Promise<void>
```

**Özellikler:**
- Firebase SDK initialization
- Google credential sign-in
- Phone OTP gönderimi ve doğrulama
- ID token yönetimi

---

### Görev 6.4: Auth Context Provider
**Süre:** 1 saat
**Öncelik:** KRİTİK

**Dosya:** `src/context/AuthContext.tsx` (~300 satır)

**Auth State Interface:**
```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboardingComplete: boolean;
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (idToken: string, email?: string, name?: string) => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}
```

**Özellikler:**
- Global auth state yönetimi
- User data caching (AsyncStorage)
- Onboarding durumu takibi
- Token persistence (SecureStore)
- Auto token refresh

---

### Görev 6.5: Google Sign In UI
**Süre:** 1.5 saat
**Öncelik:** YÜKSEK

**Dosya:** `app/(auth)/google-signin.tsx` (~200 satır)

**Akış:**
1. OAuth button → Google OAuth ekranı
2. User Google hesabı seçer
3. ID token alınır
4. Backend'e gönderilir (`POST /api/auth/google/signin`)
5. User data + JWT tokens dönülür
6. AuthContext güncellenir
7. Onboarding veya ana sayfaya yönlendir

**UI Özellikleri:**
- Google logo'lu buton
- Loading spinner
- Hata mesajları (Alert)
- Geri dön butonu

---

### Görev 6.6: Apple Sign In UI
**Süre:** 1.5 saat
**Öncelik:** YÜKSEK

**Dosya:** `app/(auth)/apple-signin.tsx` (~180 satır)

**Özel Durum - Apple Privacy:**
- Email/name sadece **ilk sign-in'de** gelir
- Sonraki login'lerde sadece ID token
- Backend'de email/name cache'lenir

**Akış:**
1. Apple Sign In button (native)
2. Face ID / Touch ID doğrulama
3. Identity token + email/name (ilk seferde)
4. Backend'e gönder (`POST /api/auth/apple/signin`)
5. User data + JWT tokens
6. AuthContext güncelle
7. Yönlendir

**Platform Check:**
- iOS 13+ kontrolü
- Availability check
- Fallback mesajı (Android için)

---

### Görev 6.7: Phone Authentication UI
**Süre:** 2 saat
**Öncelik:** YÜKSEK

**Dosya:** `app/(auth)/phone-login.tsx` (~300 satır)

**İki Adımlı Akış:**

**Adım 1: Phone Input**
- Telefon numarası gir (0555 123 45 67)
- E.164 formatına çevir (+905551234567)
- "Kod Gönder" butonu
- Firebase SMS gönder

**Adım 2: OTP Verification**
- 6 haneli kod input
- "Doğrula ve Giriş Yap" butonu
- Firebase OTP verify
- Backend login (`POST /api/auth/phone/login`)
- Ana sayfaya yönlendir (onboarding atla - mevcut kullanıcı)

**Özellikler:**
- Phone number formatting
- OTP countdown timer (60 saniye)
- Yeniden gönder butonu
- Hata mesajları

---

### Görev 6.8: Ana Login Ekranı
**Süre:** 1 saat
**Öncelik:** YÜKSEK

**Dosya:** `app/(auth)/login.tsx` (~250 satır) - GÜNCELLENECEK

**Tasarım:**
```
┌─────────────────────────┐
│                         │
│         ⚽ Logo          │
│       GoalGPT           │
│   AI Futbol Tahminleri  │
│                         │
│  [Google ile Devam Et]  │  ← Kırmızı logo
│                         │
│  [Apple ile Devam Et]   │  ← Siyah (iOS only)
│                         │
│  [Telefon ile Giriş]    │  ← Outline
│                         │
│   Terms & Privacy       │
└─────────────────────────┘
```

**Gradient Background:**
- Primary blue → Secondary purple
- LinearGradient component

**Platform Specific:**
- Apple button sadece iOS'ta göster
- Android'de 2 buton (Google + Phone)

---

### Görev 6.9: Protected Routes & Navigation
**Süre:** 1 saat
**Öncelik:** YÜKSEK

**Dosya:** `app/_layout.tsx` (~150 satır) - GÜNCELLENECEK

**Navigation Logic:**
```typescript
// Auth durumuna göre yönlendirme
if (!isAuthenticated) {
  // Giriş yapmamış → Login ekranı
  router.replace('/(auth)/login');

} else if (!isOnboardingComplete) {
  // Yeni kullanıcı → Onboarding
  router.replace('/(onboarding)/welcome');

} else {
  // Mevcut kullanıcı → Ana sayfa
  router.replace('/(tabs)');
}
```

**Özellikler:**
- AuthProvider ile tüm app'i sar
- useSegments ile mevcut route takip
- Automatic redirect
- Deep link koruması

---

### Görev 6.10: Onboarding Akışı
**Süre:** 2 saat
**Öncelik:** ORTA

**3 Ekran:**

#### 1. Welcome Screen
**Dosya:** `app/(onboarding)/welcome.tsx`

```
┌─────────────────────────┐
│      ⚽🤖 Emoji          │
│                         │
│  GoalGPT'ye Hoş Geldiniz│
│                         │
│  ✅ AI tahminleri       │
│  ✅ Canlı skorlar       │
│  ✅ XP & Rozetler       │
│  ✅ Kredi kazan         │
│                         │
│     [Devam Et]          │
└─────────────────────────┘
```

#### 2. Features Screen
**Dosya:** `app/(onboarding)/features.tsx`

**6 Feature Card (Scroll):**
- 🤖 AI Tahminler
- 🎯 XP Sistemi
- 🏅 Rozet Koleksiyonu
- 💎 Kredi Sistemi
- ⚡ Canlı Skorlar
- 🎁 Referans Programı

#### 3. Referral Code Screen
**Dosya:** `app/(onboarding)/referral-code.tsx`

```
┌─────────────────────────┐
│         🎁              │
│                         │
│  Referans Kodunuz Var mı?│
│                         │
│  ┌─────────────────┐   │
│  │ GOAL-XXXXX      │   │  ← Input (opsiyonel)
│  └─────────────────┘   │
│                         │
│  [Kodu Kullan]          │
│  [Kodsuz Devam Et]      │
└─────────────────────────┘
```

**API Call:**
- `POST /api/referrals/apply` (kod varsa)
- Ödüller: +50 XP, +10 Kredi
- `completeOnboarding()` çağır
- Ana sayfaya yönlendir

---

## 📊 ÇIKTILAR ÖZETİ

### Oluşturulacak/Güncellenecek Dosyalar (15+)

**Servisler:**
1. `src/services/firebase.service.ts` - Firebase wrapper

**Context:**
2. `src/context/AuthContext.tsx` - Global auth state

**Ekranlar:**
3. `app/(auth)/google-signin.tsx` - Google OAuth
4. `app/(auth)/apple-signin.tsx` - Apple Sign In
5. `app/(auth)/phone-login.tsx` - Phone auth
6. `app/(auth)/login.tsx` - Ana login (güncelle)
7. `app/(onboarding)/welcome.tsx` - Hoş geldiniz (güncelle)
8. `app/(onboarding)/features.tsx` - Özellikler
9. `app/(onboarding)/referral-code.tsx` - Referans kodu

**Layout:**
10. `app/_layout.tsx` - Auth navigation (güncelle)

**Config:**
11. `app.json` - Firebase config ekle
12. `.env` - Firebase credentials ekle

### Metrikler

| Metrik | Değer |
|--------|-------|
| **Toplam Kod Satırı** | ~2,500 satır |
| **Dosya Sayısı** | 15 dosya |
| **Yeni Paket** | 4 paket |
| **Auth Metod** | 3 (Google, Apple, Phone) |
| **Onboarding Ekran** | 3 ekran |

---

## 🧪 TEST CHECKLİSTİ

### Google Sign In
- [ ] OAuth redirect iOS'ta çalışıyor
- [ ] OAuth redirect Android'de çalışıyor
- [ ] ID token doğru alınıyor
- [ ] Backend auth başarılı
- [ ] User data çekiliyor
- [ ] Yeni kullanıcı → Onboarding
- [ ] Mevcut kullanıcı → Ana sayfa

### Apple Sign In
- [ ] iOS 13+ availability check
- [ ] Sign In button görünüyor
- [ ] İlk login'de email/name alınıyor
- [ ] Sonraki login'ler çalışıyor
- [ ] Backend auth başarılı

### Phone Auth
- [ ] E.164 formatting (+90555...)
- [ ] OTP SMS geliyor
- [ ] OTP doğrulama çalışıyor
- [ ] Hatalı kod mesajı gösteriliyor
- [ ] Backend auth başarılı
- [ ] Onboarding atlanıyor (mevcut kullanıcı)

### Auth State
- [ ] Token'lar SecureStore'da
- [ ] Auth state app restart'ta korunuyor
- [ ] 401 hatalarında token refresh
- [ ] Sign out tüm data'yı temizliyor
- [ ] Korumalı route'lar redirect ediyor

### Navigation
- [ ] Giriş yapmayan → Login
- [ ] Yeni kullanıcı → Onboarding
- [ ] Mevcut kullanıcı → Ana sayfa
- [ ] Geri tuşu doğru çalışıyor

### Error Handling
- [ ] Network hataları yakalan

ıyor
- [ ] Geçersiz credential mesajı
- [ ] OAuth iptal edilmesi handle ediliyor
- [ ] Token expire otomatik yenileniyor
- [ ] Server hataları user-friendly

---

## ⚠️ OLASI SORUNLAR & ÇÖZÜMLER

### Sorun 1: Google OAuth Android Hatası
**Belirti:** "Developer Error" mesajı
**Sebep:** SHA-1 fingerprint Firebase'e eklenmemiş
**Çözüm:**
```bash
cd android
./gradlew signingReport
# SHA-1'i kopyala → Firebase Console → Android app → Add fingerprint
```

### Sorun 2: Apple Sign In Simulator'de Yok
**Belirti:** Apple button görünmüyor
**Sebep:** Apple Sign In fiziksel cihaz gerektirir (iOS 13+)
**Çözüm:** Fiziksel iOS cihazda test et, simulator'de Google/Phone kullan

### Sorun 3: Phone Auth Sonsuz Döngü
**Belirti:** reCAPTCHA sürekli açılıyor
**Sebep:** Invisible reCAPTCHA init edilmemiş
**Çözüm:** `initializeRecaptcha` önce çağrıldığından emin ol

### Sorun 4: Token'lar Kayboluyeor
**Belirti:** App restart'ta logout oluyor
**Sebep:** SecureStore permission sorunu
**Çözüm:** `app.json`'da expo-secure-store plugin var mı kontrol et, app rebuild

### Sorun 5: Firebase Config Bulunamadı
**Belirti:** "Firebase app not initialized"
**Sebep:** google-services.json veya plist eksik
**Çözüm:** Firebase console'dan indir, doğru dizine koy

---

## 🔐 GÜVENLİK CHECKLİSTİ

- [ ] **Token'lar SecureStore'da** (encrypted)
- [ ] **Hassas data AsyncStorage'da YOK**
- [ ] **Sadece HTTPS** API call'ları
- [ ] **Token expiration** zorlanıyor (1 saat)
- [ ] **Otomatik token refresh** (401 hatası)
- [ ] **Token'lar console'a log edilmiyor**
- [ ] **OAuth state parameter** CSRF koruması
- [ ] **reCAPTCHA** phone auth için
- [ ] **Backend rate limiting** auth endpoint'lerde
- [ ] **Input validation** phone/code için

---

## 🚀 DEPLOYMENT CHECKLİSTİ

### Pre-Deployment
- [ ] Tüm auth akışları iOS/Android test edildi
- [ ] Firebase projesi production için yapılandırıldı
- [ ] OAuth consent screen onaylandı
- [ ] App bundle ID'ler Firebase ile eşleşiyor
- [ ] Environment variables doğru
- [ ] Terms & privacy policy sayfaları canlı

### Deployment
- [ ] EAS Build ile app build et
- [ ] Fiziksel cihazlarda test et
- [ ] App Store'a submit et
- [ ] Google Play'e submit et
- [ ] Crash reports izle (Sentry)
- [ ] Auth metrics izle (Firebase Analytics)

### Post-Deployment
- [ ] Auth success rate izle (hedef: >95%)
- [ ] Onboarding completion rate (hedef: >80%)
- [ ] Auth hataları tespit et ve düzelt
- [ ] User feedback topla

---

## 📈 BAŞARI METRİKLERİ

### Auth Metrics

| Metrik | Hedef | Ölçüm |
|--------|-------|-------|
| **Google Sign In Success** | > %95 | Firebase Analytics |
| **Apple Sign In Success** | > %95 | Firebase Analytics |
| **Phone Auth Success** | > %90 | Firebase Analytics |
| **Token Refresh Success** | > %99 | Backend logs |
| **Onboarding Completion** | > %80 | Firebase Analytics |
| **Auth Crash Rate** | < %0.1 | Sentry |

### UX Metrics

| Metrik | Hedef | Ölçüm |
|--------|-------|-------|
| **Login Süresi** | < 30 saniye | Firebase Analytics |
| **Onboarding Drop-off** | < %20 | Firebase Analytics |
| **Returning User Login** | > %98 | Backend logs |
| **OAuth İptal Oranı** | < %10 | Firebase Analytics |

---

## 🎯 SONRAKİ FAZ ÖNİZLEMESİ

**Faz 7: Mobil App - Core Features**

Auth tamamlandıktan sonra Faz 7 şunları içerir:
1. Ana sayfa - Canlı maç kartları
2. Canlı skorlar ekranı - WebSocket güncellemeleri
3. Maç detay ekranları (istatistik, kadro, H2H)
4. AI tahmin görüntüleme
5. Kullanıcı profil ekranı
6. XP ve kredi gösterimi
7. Maç filtreleme ve arama

**Bağımlılık:** Faz 6 %100 tamamlanmalı

---

## 📝 NOTLAR

### AsyncStorage vs SecureStore
- **SecureStore:** JWT token'lar (şifrelenmiş)
- **AsyncStorage:** User data, onboarding flag (şifrelenmemiş ama hassas değil)

### Token Expiration
- Access token: 1 saat
- Refresh token: 30 gün
- Auto-refresh: 401 hatası yakalandığında

### Firebase vs Backend
- **Firebase:** Sadece ID token verify için
- **Backend:** Asıl authentication, user management, JWT üretimi

### Platform Farklılıkları
- **iOS:** Google + Apple + Phone
- **Android:** Google + Phone (Apple yok)
- Conditional rendering: `Platform.OS === 'ios'`

---

**Hazırlayan:** Claude Code Agent
**Tarih:** 2026-01-12
**Versiyon:** 1.0 (Türkçe - Master Plan Uyumlu)
**Durum:** ✅ ONAYLANDI - UYGULAMAYA HAZIR

**NOT:** Bu plan, master plan belgesindeki Faz 6'nın genişletilmiş versiyonudur. İmplementasyon sırasında güncellenecek, öğrenilen bilgiler eklenecek ve takım feedback'i ile iterate edilecektir.
