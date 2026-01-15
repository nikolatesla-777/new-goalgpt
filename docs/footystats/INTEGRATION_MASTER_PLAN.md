# FootyStats API Entegrasyon ve İş Planı (Master Plan)

Bu belge, oluşturulan API dokümantasyonuna dayanarak, FootyStats verilerinin GoalGPT sistemine nasıl entegre edileceğini, veritabanı yapısını ve AI modelini nasıl besleyeceğini detaylandırır.

## 1. Yönetici Özeti ve Amaç

**Mevcut Durum:** TheSports API (Ana Veri Kaynağı) fikstür, canlı skor ve temel istatistikleri sağlıyor ancak AI tahminleri için kritik olan "derived stats" (türetilmiş istatistikler - örn: BTTS %, xG, Form Run) konusunda zayıf veya eksik.

**Hedef:** FootyStats API'yi **"İstihbarat Katmanı"** olarak kullanmak.
- **TheSports:** İskelet (Fikstür, ID'ler, Canlı Skor).
- **FootyStats:** Beyin (xG, Potentials, Trends, Hakem Analizi).

---

## 2. Veri Boşluk Analizi (Gap Analysis)

| Özellik | TheSports API (Mevcut) | FootyStats API (Hedef) | Kazanç |
|---------|------------------------|------------------------|--------|
| **Form Analizi** | Son 5 maç sonuçları (basit) | `wwdww` stringi, `team-lastx` | 🔥 AI için tam form dizilimi |
| **xG (Gol Beklentisi)** | Sınırlı/Yok | Maç başı, takım ve oyuncu bazlı xG | 🔥 Tahmin doğruluğu artışı |
| **Bahis Potansiyeli** | Yok | `btts_potential`, `corners_potential` | 🔥 Hazır % olasılık verileri |
| **Hakem Verisi** | Sadece isim | Maç başı kart ortalaması, Penaltı % | 🔥 Kart bahisleri için kritik |
| **Trendler** | Yok | Metin bazlı trendler ("Sheffield evinde son 5 maçı kazandı") | 🔥 AI Promutu için hazır metin |

---

## 3. Teknik Mimari ve Veritabanı Stratejisi

FootyStats verilerini saklamak için mevcut TheSports tablolarını kirletmeden, `fs_` ön ekiyle yeni tablolar veya mapping tabloları oluşturulmalıdır.

### 3.1. ID Mapping (En Kritik Aşama)
İki API'nin ID'leri farklıdır. Bunları eşleştirmek için bir "Rosetta Stone" tablosuna ihtiyaç var.

**Tablo:** `integration_mappings`
- `source_a_type`: 'league' | 'team'
- `source_a_id`: TheSports ID
- `source_b_provider`: 'footystats'
- `source_b_id`: FootyStats ID
- `confidence_score`: 0-100 (Eşleşme güven puanı)

### 3.2. Yeni Veri Tabloları
*   `fs_match_stats`: Maç özelinde xG, BTTS potansiyeli, oranlar.
*   `fs_team_stats`: Sezonluk takım verileri (PPG, BTTS %, Clean Sheet %).
*   `fs_referees`: Hakem istatistikleri.

---

## 4. Uygulama Fazları (Step-by-Step)

### FAZ 1: Altyapı ve Eşleştirme (Mapping)
*Hedef: GoalGPT liglerini ve takımlarını FootyStats ile konuşturmak.*

1.  **League Mapping:**
    *   Action: `/league-list` endpoint'ini çek.
    *   Process: Bizim veritabanındaki aktif lig isimleriyle (Fuzzy Matching) eşleştir.
    *   Output: `integration_mappings` tablosuna ligleri kaydet.
2.  **Team Mapping:**
    *   Action: Eşleşen her lig için `/league-teams` çek.
    *   Process: Takım isimlerini normalize et ve eşleştir.
    *   Output: `integration_mappings` tablosuna takımları kaydet.

### FAZ 2: Veri Boru Hattı (Data Pipeline - Cron Jobs)
*Hedef: Günlük maçlar için akıllı veri çekimi.*

**Job: `FootyStatsDailySync` (Her sabah 03:00)**
1.  **Fetch:** `/todays-matches` ile günün maçlarını al.
2.  **Filter:** Sadece bizim sistemde "Takip Edilen" liglerdeki maçları filtrele.
3.  **Details:** Her maç için `/match` (Match Details) endpoint'ine git.
    *   *Neden?* `stats`, `h2h`, `odds`, `trends` hepsi tek bir pakette burada var.
4.  **Save:**
    *   `btts_potential`, `o25_potential`, `corners_potential` verilerini `fs_match_stats` tablosuna yaz.
    *   Maçın `trends` verisini JSON olarak kaydet.

**Job: `FootyStatsFormSync` (Haftalık)**
1.  **Fetch:** `/team-lastx` endpoint'i.
2.  **Save:** Takımların son 5/10 maçlık detaylı form durumlarını güncelle.

### FAZ 3: AI Model Entegrasyonu (The Brain)
*Hedef: AI Prompt'unu zenginleştirmek.*

Mevcut `PredictionService` prompt oluştururken artık şunları ekleyecek:

```text
EK İSTİHBARAT (FootyStats):
- Bu maç için BTTS (Karşılıklı Gol) Olasılığı: %65 (Yüksek)
- Ev Sahibi xG (Gol Beklentisi): 1.75
- Deplasman xG: 0.80
- Hakem Michael Oliver Ortalaması: 3.5 Sarı Kart/Maç (Sert Hakem)
- Form Durumu: Ev Sahibi (W-W-D-W-L), Deplasman (L-L-L-D-L)
- Trend: "Burnley son 6 maçtır gol atıyor."
```

### FAZ 4: Kullanıcı Arayüzü (UI) Geliştirmeleri
*Hedef: Kullanıcıya "Premium" veri sunmak.*

1.  **Maç Detay Sayfası:**
    *   Yeni Tab: **"Yapay Zeka Analizi"** veya **"Gelişmiş İstatistikler"**.
    *   İçerik: FootyStats'tan gelen `trends` metinleri, xG bar chartları, Potansiyel yüzdeleri.
2.  **Günün Tüyoları Sayfası:**
    *   `/stats-data-btts` ve `/stats-data-over25` endpointlerini kullanarak otomatik "Günün Banko BTTS Maçları" listesi oluştur.

---

## 5. Riskler ve Çözümler

*   **Risk:** API Limitleri (Call Budget).
    *   **Çözüm:** Sadece "Active" ligleri ve "Günün" maçlarını çek. Geçmişe dönük devasa sync yapma. Önbellekleme (Caching) stratejisini agresif kullan.
*   **Risk:** İsim Eşleşmeme Sorunu (Mapping Miss).
    *   **Çözüm:** Admin panelinde "Manuel Mapping" arayüzü yap. Otomatik eşleşmeyenleri insan eliyle bağla.

## 6. Sıradaki İlk Adımlar (Action Items)

1.  [ ] `integration_mappings` tablosunu migrate et.
2.  [ ] FootyStats servis katmanını (`src/services/footystats`) oluştur.
3.  [ ] `/league-list` ile ilk eşleştirme denemesi scriptini yaz.
