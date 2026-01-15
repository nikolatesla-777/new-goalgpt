# FootyStats & TheSports Mapping ve Veritabanı Stratejisi

İki farklı veri sağlayıcısını (TheSports ve FootyStats) birbirine bağlamak için **"Rosetta Stone"** mimarisi kullanacağız. Bu, veritabanını kirletmeden, iki farklı ID setini birbirine çeviren merkezi bir haritalama tablosu ve FootyStats'a özel ayrılmış veri tabloları anlamına gelir.

## 1. Veritabanı Şeması (PostgreSQL)

Mevcut tabloları (`ts_matches`, `ts_teams`) değiştirmek yerine, FootyStats verilerini izole eden yeni bir şema kullanacağız.

### A. Mapping Tablosu (`integration_mappings`)
Bu tablo, TheSports ID'si ile FootyStats ID'si arasındaki köprüdür.

```sql
CREATE TABLE integration_mappings (
    id SERIAL PRIMARY KEY,
    
    -- Eşleşme Türü (team, league, competition_stage, referee)
    entity_type VARCHAR(50) NOT NULL, 
    
    -- TheSports (Bizim Ana Sistem)
    ts_id VARCHAR(100) NOT NULL,
    ts_name VARCHAR(255), -- Doğrulama için isim
    
    -- FootyStats (Yeni Kaynak)
    fs_id INT NOT NULL,
    fs_name VARCHAR(255), -- Doğrulama için isim
    
    -- Güven Skoru ve Durum
    confidence_score DECIMAL(5,2), -- 0.00 ile 100.00 arası (String benzerliği)
    is_verified BOOLEAN DEFAULT FALSE, -- Admin onayı/Otomatik güvenli eşleşme
    
    -- Meta
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Hızlı sorgu için index
    UNIQUE(entity_type, ts_id),
    UNIQUE(entity_type, fs_id)
);
```

### B. FootyStats Veri Tabloları (`fs_*`)
FootyStats'tan gelen değerli verileri saklayacağımız tablolar. `match_id` olarak bizim sistemin ID'sini (TheSports ID) kullanarak JOIN işlemlerini kolaylaştırırız.

**1. `fs_match_stats` (Maç Öncesi Analiz Verileri)**
```sql
CREATE TABLE fs_match_stats (
    id SERIAL PRIMARY KEY,
    match_id VARCHAR(100) NOT NULL REFERENCES ts_matches(id), -- TheSports Match ID
    
    -- AI Kritik Veriler
    btts_potential INT, -- % Olarak
    over25_potential INT, -- % Olarak
    corners_potential DECIMAL(5,2),
    xg_home_prematch DECIMAL(4,2),
    xg_away_prematch DECIMAL(4,2),
    
    -- Trendler (JSON olarak saklamak esneklik sağlar)
    trends JSONB, -- Örn: {"home": ["Son 5 maç kazandı"], "away": ["Deplasmanda gol atamıyor"]}
    
    -- Oran Karşılaştırması
    odds_comparison JSONB,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**2. `fs_team_form` (Detaylı Takım Formu)**
```sql
CREATE TABLE fs_team_form (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(100) NOT NULL REFERENCES ts_teams(id), -- TheSports Team ID
    season_id VARCHAR(50), 
    
    -- FootyStats Form Stringi (AI için çok değerli)
    form_string VARCHAR(20), -- "WDLWW"
    
    -- İleri İstatistikler
    ppg_overall DECIMAL(4,2),
    xg_for_avg DECIMAL(4,2),
    xg_against_avg DECIMAL(4,2),
    btts_percentage INT,
    
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Eşleştirme Algoritması (The Matching Logic)

ID'ler farklı olduğu için **"Fuzzy String Matching" (Bulanık Eşleşme)** kullanacağız.

### Adım 1: Normalizasyon
İsimleri karşılaştırmadan önce temizleyeceğiz.
*   `Manchester United FC` -> `manchester united`
*   `Man Utd` -> `manchester united` (Dictionary replacement gerekebilir)
*   `Fenerbahçe SK` -> `fenerbahce`

### Adım 2: Algoritma Akışı (Typescript Script)
Lig başına çalışacak bir script yazacağız.

```typescript
// Pseudo-code
async function mapLeagueTeams(leagueId) {
    // 1. Bizim takımları çek (TheSports)
    const tsTeams = await db.query('SELECT id, name FROM ts_teams WHERE league_id = ?', [leagueId]);
    
    // 2. FootyStats takımlarını çek
    const fsTeams = await footyStatsApi.getLeagueTeams(mappedFootyStatsLeagueId);
    
    for (const tsTeam of tsTeams) {
        let bestMatch = null;
        let highestScore = 0;
        
        // 3. Her takımla karşılaştır (Levenshtein Distance)
        for (const fsTeam of fsTeams) {
            const score = stringSimilarity(normalize(tsTeam.name), normalize(fsTeam.name));
            if (score > highestScore) {
                highestScore = score;
                bestMatch = fsTeam;
            }
        }
        
        // 4. Karar Ver ve Kaydet
        if (highestScore > 0.90) {
            // Kesin Eşleşme (%90+)
            await saveMapping(tsTeam.id, bestMatch.id, highestScore, true); // Auto-verify
        } else if (highestScore > 0.60) {
            // Olası Eşleşme (İnceleme Gerekli)
            await saveMapping(tsTeam.id, bestMatch.id, highestScore, false); // Pending review
        } else {
            // Eşleşme Bulunamadı
            logError(`No match found for ${tsTeam.name}`);
        }
    }
}
```

---

## 3. Yönetim ve Operasyon

### Admin Paneli Entegrasyonu
Veritabanı otomatik olarak dolacak olsa da, operasyonel kontrol için Admin paneline (Backoffice) bir sayfa eklenmesi gerekir.

1.  **"Integration -> Mapping Review" Sayfası:**
    *   `is_verified = false` olan eşleşmeleri listeler.
    *   Admin, sol tarafta TheSports takımını, sağ tarafta önerilen FootyStats takımını görür.
    *   "Onayla" veya "Düzenle" diyerek doğru FootyStats ID'sini manuel girebilir.

### Veri Akışı (Data Flow)
1.  **Sorgu:** Kullanıcı bir maç detayına girdiğinde (MatchController).
2.  **Lookup:** Sistem `match.id` -> `integration_mappings` -> `fs_id` dönüşümü yapar mı? **HAYIR.**
    *   *Optimizasyon:* Verileri zaten `fs_match_stats` tablosuna, `ts_match_id` referansıyla kaydettik.
    *   **Doğrudan Join:** `SELECT * FROM fs_match_stats WHERE match_id = ?` diyerek doğrudan veriyi çekeriz. Mapping sadece *yazma* aşamasında (Sync Jobs) kullanılır. Okuma aşaması çok hızlıdır.
