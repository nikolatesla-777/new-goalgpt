# CLAUDE.md - GoalGPT Proje Hafiza Karti

> Bu dosya projenin "ana yasasi" olarak kabul edilmelidir.
> Her seferinde sifirdan ogrenmeni engellemek icin bu dosyayi oku!

---

## 1. PROJE OZETI

**GoalGPT** - Canli futbol mac takip ve AI tahmin sistemi.
- Canli skor takibi (TheSports API)
- AI tabanli mac tahminleri (Bot sistemi)
- Admin paneli (Komuta Merkezi)

---

## 2. TECH STACK

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL (Supabase)
- **WebSocket**: Fastify WebSocket
- **API**: TheSports.com

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Routing**: React Router v6 (Nested Routes)
- **Styling**: Tailwind CSS + Inline Styles

### Deployment
- **VPS**: DigitalOcean (142.93.103.128)
- **Database**: Supabase (aws-eu-central-1)
- **Domain**: partnergoalgpt.com

---

## 3. KLASOR YAPISI

```
project/
├── frontend/                    # React Frontend
│   ├── src/
│   │   ├── api/                 # API client fonksiyonlari
│   │   │   └── matches.ts       # Tum API cagrilari
│   │   ├── components/
│   │   │   ├── admin/           # Admin panel componentleri
│   │   │   ├── match-detail/    # Mac detay (modular)
│   │   │   ├── team-detail/     # Takim detay (modular)
│   │   │   ├── competition-detail/ # Lig detay (modular)
│   │   │   ├── player/          # Oyuncu sayfasi
│   │   │   └── ai/              # AI tahmin componentleri
│   │   ├── context/             # React Context
│   │   │   └── AIPredictionsContext.tsx
│   │   ├── hooks/               # Custom hooks
│   │   │   └── useSocket.ts     # WebSocket hook
│   │   └── utils/               # Yardimci fonksiyonlar
│   └── dist/                    # Build output
│
├── src/                         # Backend
│   ├── server.ts                # Ana server (Fastify)
│   ├── routes/                  # API routes
│   ├── controllers/             # Route handlers
│   ├── services/
│   │   ├── thesports/           # TheSports API servisleri
│   │   │   ├── match/           # Mac servisleri
│   │   │   └── client/          # API client
│   │   └── ai/                  # AI tahmin servisleri
│   ├── jobs/                    # Cron jobs
│   │   ├── matchSync.job.ts     # Mac senkronizasyonu
│   │   ├── matchWatchdog.job.ts # Canli mac izleme
│   │   └── dataUpdate.job.ts    # Veri guncelleme
│   └── database/                # Database islemleri
│       └── connection.ts        # PostgreSQL baglantisi
│
└── scripts/archive/             # Arsivlenmis scriptler
```

---

## 4. ONEMLI DOSYALAR

### Frontend
| Dosya | Aciklama |
|-------|----------|
| `frontend/src/App.tsx` | Ana routing (Nested Routes) |
| `frontend/src/api/matches.ts` | Tum API fonksiyonlari |
| `frontend/src/components/MatchList.tsx` | Ana mac listesi |
| `frontend/src/components/MatchCard.tsx` | Tek mac karti |
| `frontend/src/hooks/useSocket.ts` | WebSocket baglantisi |
| `frontend/src/context/AIPredictionsContext.tsx` | AI tahmin state |

### Backend
| Dosya | Aciklama |
|-------|----------|
| `src/server.ts` | Fastify server + WebSocket |
| `src/routes/match.routes.ts` | Mac API endpoints |
| `src/routes/prediction.routes.ts` | Tahmin API endpoints |
| `src/services/thesports/match/matchDetailLive.service.ts` | Canli mac verisi |
| `src/services/ai/aiPrediction.service.ts` | AI tahmin motoru |
| `src/jobs/matchWatchdog.job.ts` | Canli mac izleyici |

---

## 5. API ENDPOINTS

### Mac Endpoints
```
GET /api/matches/live          # Canli maclar
GET /api/matches/diary?date=   # Gunun maclari
GET /api/matches/:id           # Tek mac detay
GET /api/matches/:id/h2h       # Head-to-head
GET /api/matches/:id/lineup    # Kadro
GET /api/matches/:id/live-stats # Canli istatistikler
GET /api/matches/:id/trend     # Dakika dakika veriler
```

### Takim Endpoints
```
GET /api/teams/:id             # Takim bilgisi
GET /api/teams/:id/fixtures    # Takim fiksturu
GET /api/teams/:id/standings   # Takim puan durumu
GET /api/teams/:id/players     # Takim kadrosu
```

### Lig Endpoints
```
GET /api/leagues/:id           # Lig bilgisi
GET /api/leagues/:id/fixtures  # Lig fiksturu
GET /api/leagues/:id/standings # Puan durumu
```

### Tahmin Endpoints
```
GET /api/predictions/matched   # Eslesmis tahminler
GET /api/predictions/match/:id # Mac icin tahminler
```

---

## 6. MAC DURUMLARI (TheSports API)

```typescript
status_id = 1  // NOT_STARTED (Baslamadi)
status_id = 2  // FIRST_HALF (Ilk Yari)
status_id = 3  // HALF_TIME (Devre Arasi)
status_id = 4  // SECOND_HALF (Ikinci Yari)
status_id = 5  // OVERTIME (Uzatma)
status_id = 7  // PENALTY (Penaltilar)
status_id = 8  // ENDED (Bitti)
status_id = 9  // POSTPONED (Ertelendi)
status_id = 10 // CANCELLED (Iptal)

// CANLI MACLAR: status_id IN (2, 3, 4, 5, 7)
```

---

## 7. DATABASE TABLOLARI

### Ana Tablolar
- `ts_matches` - Maclar
- `ts_teams` - Takimlar
- `ts_competitions` - Ligler
- `ts_players` - Oyuncular
- `ts_seasons` - Sezonlar
- `ts_standings` - Puan durumlari

### Tahmin Tablolari
- `ts_prediction_group` - Tahmin gruplari
- `ts_prediction_group_item` - Tahmin detaylari
- `ts_prediction_mapped` - Eslesmis tahminler

---

## 8. FRONTEND ROUTING (Nested Routes)

```tsx
// App.tsx
<Route element={<AdminLayout />}>
  <Route path="/" element={<AdminKomutaMerkezi />} />
  <Route path="/livescore" element={<AdminLivescore />} />
  <Route path="/ai-predictions" element={<AIPredictionsPage />} />

  // Mac Detay - Nested Tabs
  <Route path="/match/:matchId" element={<MatchDetailLayout />}>
    <Route index element={<Navigate to="stats" />} />
    <Route path="stats" element={<StatsTab />} />
    <Route path="events" element={<EventsTab />} />
    <Route path="h2h" element={<H2HTab />} />
    <Route path="standings" element={<StandingsTab />} />
    <Route path="lineup" element={<LineupTab />} />
    <Route path="trend" element={<TrendTab />} />
    <Route path="ai" element={<AITab />} />
  </Route>

  // Takim Detay - Nested Tabs
  <Route path="/team/:teamId" element={<TeamDetailLayout />}>
    <Route index element={<Navigate to="overview" />} />
    <Route path="overview" element={<OverviewTab />} />
    <Route path="fixtures" element={<FixturesTab />} />
    <Route path="standings" element={<StandingsTab />} />
    <Route path="players" element={<PlayersTab />} />
  </Route>

  // Lig Detay - Nested Tabs
  <Route path="/competition/:id" element={<CompetitionDetailLayout />}>
    <Route index element={<Navigate to="overview" />} />
    <Route path="overview" element={<OverviewTab />} />
    <Route path="fixtures" element={<FixturesTab />} />
    <Route path="standings" element={<StandingsTab />} />
  </Route>
</Route>
```

---

## 9. MIMARI PATTERN'LER

### Context + Eager Loading
Her detay sayfasi (Match, Team, Competition) icin:
1. `*DetailContext.tsx` - Tum verileri eager load eder
2. `*DetailLayout.tsx` - Header + Tab navigation
3. `tabs/*.tsx` - Her tab ayri component

```tsx
// Ornek: TeamDetailContext.tsx
const fetchData = async () => {
  const [team, standings, fixtures, players] = await Promise.all([
    getTeamById(teamId),
    getTeamStandings(teamId),
    getTeamFixtures(teamId),
    getPlayersByTeam(teamId),
  ]);
  // Hepsi paralel yuklenir
};
```

### WebSocket Pattern
```tsx
// useSocket.ts
const { isConnected, lastEvent, dangerAlerts } = useSocket({
  onScoreChange: (event) => { /* ... */ },
  onMatchStateChange: (event) => { /* ... */ },
});
```

---

## 10. DEVELOPMENT KOMUTLARI

### Frontend
```bash
cd frontend
npm install
npm run dev      # Development server (port 5173)
npm run build    # Production build
```

### Backend
```bash
npm install
npm run dev      # Development server (port 3000)
npm run build    # TypeScript compile
npm start        # Production start
```

### VPS Deployment
```bash
ssh root@142.93.103.128
cd /var/www/goalgpt
git pull
npm install
npm run build
pm2 restart goalgpt
```

---

## 11. ENVIRONMENT VARIABLES

### Backend (.env)
```env
PORT=3000
DATABASE_URL=postgres://...
THESPORTS_API_USER=...
THESPORTS_API_SECRET=...
```

### Frontend (.env)
```env
VITE_API_URL=/api
VITE_WS_URL=ws://localhost:3000/ws
```

---

## 12. BILINEN SORUNLAR & COZUMLER

### Sorun: Duplicate oyuncular
**Cozum**: `getPlayersByTeam` DISTINCT ON kullanir

### Sorun: Mac durumu guncellenmiyorw
**Cozum**: WebSocket baglantisini kontrol et, matchWatchdog.job calistigini dogrula

### Sorun: Chunk size uyarisi (835KB)
**Cozum**: Kritik degil, code-splitting opsiyonel

---

## 13. YAPILACAKLAR (OPSIYONEL)

- [ ] Redis cache implementasyonu
- [ ] Unit test coverage
- [ ] Code-splitting (lazy loading)
- [ ] Excel export (AdminKomutaMerkezi)

---

## 14. ILETISIM

- **VPS**: 142.93.103.128
- **Database**: Supabase (aws-eu-central-1)
- **Domain**: partnergoalgpt.com

---

**Son Guncelleme**: 2026-01-06
**Versiyon**: 1.0
