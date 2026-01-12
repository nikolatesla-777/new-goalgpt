# 📱 GOALGPT MOBİL UYGULAMA GELİŞTİRME PLANI

**Tarih:** 2026-01-11 20:00 UTC
**Kapsam:** React Native mobil uygulama (iOS + Android)
**Hedef:** Canlı maç takibi + AI tahminleri + Admin özellikleri

---

## 📊 PROJE ÖZET

**Teknoloji Stack**
- **Framework:** React Native (Expo Managed Workflow)
- **Platformlar:** iOS + Android
- **Hedef Kitle:** Son kullanıcı + Admin
- **Backend:** Mevcut GoalGPT backend API (http://142.93.103.128:3000)

**MVP Özellikleri (Phase 1-3)**
1. ✅ **Canlı Maç Skorları:** Real-time WebSocket updates
2. ✅ **AI Tahminleri:** VIP/FREE filtreleme
3. ✅ **Maç Detayları:** H2H, istatistikler, lineup, trend
4. ✅ **Push Notifications:** Gol bildirimleri, tahmin sonuçları

**Ek Özellikler (Gelecek Fazlar)**
- Admin panel (tahmin yönetimi, bot stats)
- Favoriler sistemi
- Kullanıcı profili ve ayarlar
- Monetization (RevenueCat, AdMob, Goal Credit)
- Gamification (XP, Badges, Daily Spin)

---

## 🏗️ MİMARİ KARARLAR

### 1. Frontend Reusability Analysis
**Doğrudan Kullanılabilir (Copy-Paste):**
- ✅ `src/api/matches.ts` (API Layer) - 100% reusable
- ✅ `src/hooks/useSocket.ts` (WebSocket Logic) - 95% reusable (adapter needed)
- ✅ `src/context/*` (Context Providers) - 90% reusable (AsyncStorage adapter needed)
- ✅ `src/utils/*` (Helpers) - 100% reusable

**Yeniden Yazılması Gereken:**
- ❌ UI Components (Tailwind → StyleSheet)
- ❌ Routing (React Router → Expo Router)
- ❌ Icons (Phosphor → Vector Icons)
- ❌ Storage (localStorage → AsyncStorage)

### 2. Backend API Summary
- **GET /api/matches/unified:** Günün maçları + canlı maçlar
- **GET /api/matches/:id/detail-live:** Canlı maç detayı
- **WS /ws:** Real-time updates (SCORE_CHANGE, MINUTE_UPDATE)

---

## 📐 MOBİL UYGULAMA MİMARİSİ

**Klasör Yapısı:**
```
mobile-app/
├── app/                          # Expo Router (file-based routing)
│   ├── (tabs)/                   # Bottom tab group
│   │   ├── index.tsx             # Home (Livescore)
│   │   ├── matches.tsx           # All Matches
│   │   ├── ai.tsx                # AI Predictions
│   │   └── profile.tsx           # Profile
│   ├── match/[id].tsx            # Match Detail
│   └── _layout.tsx               # Root layout
├── src/
│   ├── api/                      # Backend API client
│   ├── components/               # React components ({shared, match, prediction})
│   ├── constants/                # Colors, Typography, Config
│   ├── context/                  # Global state (Auth, Favorites)
│   ├── hooks/                    # Custom hooks (useSocket)
│   └── utils/                    # Helper functions
└── assets/                       # Images/Fonts
```

---

## 📋 IMPLEMENTATION ROADMAP

### PHASE 1: Setup & Infrastructure (1-2 Gün)
- [ ] Expo Project Initialization
- [ ] Folder Structure Setup
- [ ] Design System Implementation (Colors, Typography)
- [ ] API Client Setup

### PHASE 2: Core UI & Navigation (2-3 Gün)
- [ ] Bottom Tab Navigation
- [ ] Shared Components (Card, Badge, Button)
- [ ] Basic Screens Skeleton (Home, Matches, AI, Profile)

### PHASE 3: Livescore Feature (MVP Core) (3-4 Gün)
- [ ] Home Screen with WebSocket Integration
- [ ] Match Card Component (Real-time updates)
- [ ] Match Detail Screen (Stats, Events, H2H)
- [ ] League Grouping & Lazy Loading

### PHASE 4: AI Predictions (2-3 Gün)
- [ ] Predictions Screen (VIP/FREE filters)
- [ ] Prediction Card Component
- [ ] VIP Lock/Unlock Logic

### PHASE 5: Push Notifications (2-3 Gün)
- [ ] Firebase Setup (FCM)
- [ ] Notification Service Implementation
- [ ] Deep Linking Configuration

---

## 🔧 TEKNİK DETAYLAR & BEST PRACTICES

**1. State Management**
- **Remote Data:** `useEffect` + API Client (Simple fetching)
- **Real-time:** WebSocket Context + Optimistic Updates
- **Local Settings:** `AsyncStorage` (Favorites, Preferences)

**2. Performance Optimization**
- **Lists:** `FlatList` with `windowSize`, `removeClippedSubviews`
- **Images:** `expo-image` with disk caching
- **Memoization:** `React.memo` for heavy components (MatchCard)

**3. Design System**
- **Colors:** Defined in `src/constants/colors.ts`
- **Typography:** Validated styles in `src/constants/typography.ts`
- **Responsive:** Flexbox + Safe Area Context

---

## 🚀 DEPLOYMENT STRATEGY (Production)

**Staging:**
- Expo Go (Rapid testing)
- Expo Development Build (Native modules testing)

**Production:**
- **iOS:** TestFlight → App Store
- **Android:** Internal Testing → Play Store

---

## 🚨 DATABASE MIGRATION STRATEGY (50K+ Active Users)

**Risk Mitigation:**
- **Zero-Downtime:** New features use NEW tables (no locking existing tables).
- **Compatibility:** Existing tables (`customer_users`, `customer_subscriptions`) remain untouched schema-wise.
- **Rollout:** Canary deployment (1% -> 100% traffic).

**New Tables (Optional/Future):**
- `user_credits`, `user_badges`, `partner_api_keys`

---

## 🎨 UI/UX DESIGN PLAN

**Style:** Modern, Clean, Dark/Light Mode Adaptive
**Core Components:**
- **Match Card:** Compact, information-dense, real-time indicators.
- **Prediction Card:** Clear "Won/Lost" badging, VIP obfuscation.
- **Charts:** Minimalist usage for trends/possession.

**Animations:**
- Score update pulse
- Page transitions (Native stack)
- Interactive press feedback
