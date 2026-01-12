# 🏗️ GOALGPT MOBİL UYGULAMA - MİMARİ BLUEPRINT (v2.0)

**Hedef:** Claude/AI Ajanı için "Eksiksiz" Uygulama Rehberi
**Kapsam:** React Native (Expo) iOS + Android Uygulaması
**Statü:** KESİNLEŞMİŞ MİMARİ - DEĞİŞİKLİK YAPILMAZ

---

## 1. 📂 TAM DOSYA MANİFESTOSU (FILE MANIFEST)

Bu yapı **BİREBİR** uygulanmalıdır.

```text
goalgpt-mobile/
├── app/                                  # Expo Router (Filesystem Routing)
│   ├── (tabs)/
│   │   ├── _layout.tsx                   # Bottom Tab Config
│   │   ├── index.tsx                     # 🏠 HOME (Canlı Akış)
│   │   ├── matches.tsx                   # ⚽ MATCHES (Fikstür)
│   │   ├── ai.tsx                        # 🤖 AI PREDICTIONS
│   │   └── profile.tsx                   # 👤 PROFILE
│   ├── match/
│   │   └── [id].tsx                      # 📄 Maç Detay Sayfası
│   ├── auth/
│   │   ├── login.tsx                     # Giriş Ekranı
│   │   └── register.tsx                  # Kayıt Ekranı
│   ├── _layout.tsx                       # Root Layout (Providers)
│   └── +not-found.tsx                    # 404
│
├── src/
│   ├── api/                              # Backend Entegrasyonu
│   │   ├── client.ts                     # Axios/Fetch Wrapper + Interceptors
│   │   ├── endpoints.ts                  # API URL Sabitleri
│   │   ├── services/
│   │       ├── authService.ts            # Login/Register/Token
│   │       ├── matchService.ts           # Live/Unified Matches
│   │       └── predictionService.ts      # AI Tahminleri
│   │   └── types/
│   │       ├── api.types.ts              # Generic API Responses
│   │       └── models.types.ts           # User, Match, Team Interface'leri
│   │
│   ├── components/
│   │   ├── shared/                       # Reusable UI Atoms
│   │   │   ├── Button.tsx
│   │   │   ├── Typography.tsx
│   │   │   ├── Container.tsx
│   │   │   └── Loader.tsx
│   │   ├── match/                        # Maç Özel Bileşenleri
│   │   │   ├── MatchCard.tsx
│   │   │   ├── MatchStatusBadge.tsx
│   │   │   └── ScoreBoard.tsx
│   │   ├── prediction/                   # Tahmin Bileşenleri
│   │   │   ├── PredictionCard.tsx
│   │   │   └── VIPLockOverlay.tsx
│   │   └── navigation/
│   │       └── TabBarIcon.tsx
│   │
│   ├── constants/                        # Global Sabitler
│   │   ├── Colors.ts                     # Design Tokens (Renk)
│   │   ├── Typography.ts                 # Fontlar
│   │   ├── Spacing.ts                    # Padding/Margin
│   │   └── Config.ts                     # Env Variables
│   │
│   ├── context/                          # Global State (React Context)
│   │   ├── AuthContext.tsx               # User Session
│   │   ├── SocketContext.tsx             # WebSocket Connection
│   │   └── ThemeContext.tsx              # Dark/Light Mode
│   │
│   ├── hooks/                            # Custom Logic Hooks
│   │   ├── useLiveMatches.ts             # Maç verisi + WS update
│   │   ├── useMatchDetail.ts             # Detay verisi
│   │   └── useDebounce.ts                # UI Optimizasyon
│   │
│   └── utils/
│       ├── date.ts                       # Tarih Formatlama (UTC+3)
│       ├── storage.ts                    # AsyncStorage Wrapper
│       └── validation.ts                 # Form Validasyonları
│
├── assets/
│   ├── fonts/                            # Custom Fontlar
│   └── images/                           # Statik Görseller
└── app.json                              # Expo Config
```

---

## 2. 🔌 VERİ KATMANI (DATA LAYER) SPEC

### 2.1 API Modelleri (`src/api/types/models.types.ts`)

Veri tipleri backend ile %100 uyumlu olmalı.

```typescript
// Temel Maç Modeli
export interface Match {
  id: string;
  external_id: number;
  slug: string;
  competition_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status_id: number; // 2=Live, 3=HT, 8=FT
  match_time: string; // ISO String
  minute: number | null;
  
  // İlişkisel Veriler
  home_team: Team;
  away_team: Team;
  competition: Competition;
}

export interface Team {
  id: string;
  name: string;
  logo_url: string;
  short_code?: string;
}

export interface Prediction {
  id: string;
  match_id: string;
  bot_id: string;
  prediction_type: string; // "HT_OV_05", "FT_1"
  status: 'pending' | 'won' | 'lost';
  is_vip: boolean;
  confidence: number;
}
```

### 2.2 WebSocket Servisi (`src/context/SocketContext.tsx`)

WebSocket bağlantısı uygulama açıldığında kurulmalı ve background/foreground geçişlerinde yönetilmeli.

**Event Protocol:**

| Event Name | Payload | Action |
| :--- | :--- | :--- |
| `SCORE_CHANGE` | `{ matchId, home, away, minute }` | `matches` listesini güncelle |
| `MATCH_STATUS` | `{ matchId, status }` | Icon/Badge güncelle (Live -> HT) |
| `PREDICTION_RESULT` | `{ predictionId, status }` | Toast Notification göster |

**Implementation Logic:**
1.  `SocketProvider` tüm uygulamayı sarar.
2.  `lastMessage` state'i tutulur.
3.  Komponentler `useSocket()` ile bu state'i dinler.
4.  Heartbeat (Ping/Pong) implemente edilmeli (30sn).

---

## 3. 🎨 DESIGN SYSTEM TOKENS

Tasarım tutarlılığı için bu değerler `src/constants/Colors.ts` içinden çağrılmalı. Hard-coded renk KULLANILMAMALI.

```typescript
export const Colors = {
  light: {
    primary: '#10B981',       // GoalGPT Yeşil
    secondary: '#1F2937',     // Koyu Gri
    background: '#F3F4F6',    // Kirli Beyaz (Zemin)
    surface: '#FFFFFF',       // Kart Zemini
    text: '#111827',          // Ana Metin
    textDim: '#6B7280',       // Silik Metin
    border: '#E5E7EB',
    
    // Status
    live: '#EF4444',          // Kırmızı
    success: '#10B981',
    warning: '#F59E0B',
  },
  dark: {
    primary: '#34D399',
    secondary: '#F9FAFB',
    background: '#111827',    // Koyu Zemin
    surface: '#1F2937',       // Koyu Kart
    text: '#F9FAFB',
    textDim: '#9CA3AF',
    border: '#374151',
    
    live: '#FF6B6B',
  }
};

export const Spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32
};

export const Typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    bold: 'Inter-Bold',
  },
  size: {
    h1: 24,
    h2: 20,
    body: 16,
    caption: 12
  }
};
```

---

## 4. 🧩 CORE COMPONENTS SPEC

### 4.1 MatchCard (`src/components/match/MatchCard.tsx`)

**Props:**
```typescript
interface MatchCardProps {
  match: Match;
  onPress: (id: string) => void;
  showOdds?: boolean;
}
```

**Layout:**
- **Header:** Lig Logosu + Lig Adı (Eğer liste gruplanmamışsa)
- **Body:**
  - Sol: Ev Sahibi (Logo + İsim)
  - Orta: Skor + Dakika (Eğer CANLI ise Kırmızı Badge)
  - Sağ: Deplasman (Logo + İsim)
- **Footer:** Varsa "3 Yeni Tahmin" badge'i.

**Performance:**
- `React.memo` ile sarılmalı. Sadece skor veya dakika değiştiğinde render olmalı.

### 4.2 PredictionCard (`src/components/prediction/PredictionCard.tsx`)

**States:**
1.  **FREE & Pending:** Tüm detaylar açık.
2.  **VIP & Pending & Locked:** Detaylar blur, "KİLİDİ AÇ" butonu.
3.  **Resulted:** "KAZANDI" (Yeşil) veya "KAYBETTİ" (Kırmızı) overlay.

---

## 5. 🚦 NAVİGASYON VE ROUTING AKIŞI

**Expo Router Yapısı:**

1.  **Root (`/`)**:
    - Auth Check yapılır.
    - Login ise `(tabs)/index` yönlendir.
    - Değilse `auth/login` yönlendir.

2.  **Tabs (`(tabs)`)**:
    - `index`: Live Score (Filter: ALL | LIVE | FINISHED)
    - `matches`: Calendar View (Date Picker)
    - `ai`: AI Predictions Feed (Filter: RISK | SAFE)
    - `profile`: User Settings

3.  **Deep Linking:**
    - Scheme: `goalgpt://`
    - `goalgpt://match/123` -> `app/match/123` sayfasını açar.
    - Push Notification payload'ında bu link gönderilir.

---

## 6. 🧪 TEST STRATEJİSİ

**Unit Tests (`jest`):**
- `utils/date.ts`: Timezone (UTC+3) dönüşümleri doğru mu?
- `hooks/useLiveMatches`: Veri birleştirme (API + WS) mantığı kırılamaz olmalı.

**Integration Tests:**
- API Client validasyonu (Mock server ile).

**Manual QA Checklist:**
1.  Uygulamayı aç -> Skeleton loader görünüyor mu?
2.  Data gelince -> Liste render oluyor mu?
3.  Wifi kapat -> "Bağlantı Yok" uyarısı çıkıyor mu?
4.  Maç bitince (Status 8) -> Skor sabitlenip dakika kayboluyor mu? (Ghost Minute kontrolü)

---

## 7. 🚀 FAZ 1 IMPLEMENTATION (SIRALI KOMUTLAR)

Ajan bu sırayı takip etmelidir:

**ADIM 1: Initialize**
```bash
npx create-expo-app@latest goalgpt-mobile -t default
cd goalgpt-mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-gesture-handler react-native-reanimated
```

**ADIM 2: Assets & Config**
- `assets/fonts` klasörüne Inter fontlarını koy.
- `app.json` içine `scheme: "goalgpt"` ekle (Deep link için).

**ADIM 3: Core Layers**
- `src/api/client.ts` oluştur.
- `src/context/AuthContext.tsx` oluştur.

**ADIM 4: UI Development**
- `src/components/shared/*` bileşenlerini yaz.
- `app/(tabs)/_layout.tsx` navigasyonu bağla.
- `index.tsx` (Home) sayfasını API'ye bağla.

**ADIM 5: WebSocket**
- `useSocket` hook'unu yaz ve Home sayfasına entegre et.

---
**BU BELGE, YAZILIM GELİŞTİRME SÜRECİNİN TEK GERÇEK KAYNAĞIDIR (SSOT).**
