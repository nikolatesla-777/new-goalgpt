# GoalGPT: FootyStats ile Güçlendirilmiş AI Modeli (The Brain)

Bu doküman, FootyStats'tan alınan zenginleştirilmiş verilerin (xG, Potentials, Trends) GoalGPT'nin AI modelini nasıl radikal bir şekilde geliştireceğini ve "Canlı Bir Bahis Uzmanı"na dönüştüreceğini anlatır.

## 1. Mevcut Durum vs. Yeni AI (Fark Nedir?)

| Özellik | Şu Anki GoalGPT (Sadece TheSports) | Gelecek GoalGPT (FootyStats Entegre) |
|---------|------------------------------------|--------------------------------------|
| **Mantık** | "Son 5 maçta 3 galibiyeti var, kazanabilir." (Basit İstatistik) | "Son 5 maçta 3 galibiyeti var ama **xG'si (0.80) çok düşük**, şans eseri kazanıyor. Rakip takımın **xG'si (2.10)** yüksek ve evinde oynuyor." (Derin Analiz) |
| **BTTS** | "İki takım da gol atıyor." | "İki takımın BTTS oranı **%75**. Hakem Michael Oliver yönetiyor ve maç başına **4.5 kart** gösteriyor, maç gergin geçecek." |
| **Tahmin** | %60 Güven | **%85 Güven** (Veri çeşitliliği arttığı için) |

---

## 2. AI "The Brain" Nasıl Çalışacak? (Prompt Engineering)

AI modeline (OpenAI/Claude) gönderilen prompt'u (komutu) FootyStats verileriyle zenginleştireceğiz.

### A. Girdi Verisi (Input Context)
AI'a ham veri yerine işlenmiş "Intelligence" (İstihbarat) vereceğiz.

**Eski Prompt (Örnek):**
> "Fenerbahçe (Sıra 2) vs Galatasaray (Sıra 1). Fenerbahçe son 5 maç: G,B,G,G,G. Tahmin et."

**Yeni Prompt (FootyStats Destekli):**
> "Fenerbahçe vs Galatasaray derbisi.
> **İstatistikler:**
> - **xG (Gol Beklentisi):** FB (1.95 - Çok Yüksek, Yaratıcı), GS (2.10 - Çok Yüksek).
> - **BTTS Olasılığı:** %80 (Algoritma Potansiyeli).
> - **Korner Potansiyeli:** 10.5 Üstü (%70 ihtimal).
> - **Form Durumu:** FB evinde **yenilmedi**, GS deplasmanda **son 3 maçta gol yedi**.
> - **Hakem Faktörü:** Maçın hakemi kart başına **0.3 penaltı** çalıyor (Penaltı ihtimali var).
> - **Trend:** 'Fenerbahçe ligdeki son 5 iç saha maçının 4'ünde ilk yarı gol attı.'
>
> **Görev:** Bu veriler ışığında, risk seven bir bahisçi için 'Yüksek Oranlı' bir kombinasyon öner."

---

## 3. Akıllı Analiz Senaryoları (Use Cases)

FootyStats verileriyle AI şunları yapabilecek:

### Senaryo 1: "Değer (Value) Bahsi" Bulma
*   **Durum:** Bahis şirketi "Deplasman Kazanır"a 1.50 veriyor.
*   **FootyStats Verisi:** Ev sahibi son 5 maçta yenilmiş ama **xG'si (1.8)** çok yüksek. Yani iyi oynuyor ama şanssız. Deplasman takımının **xG'si (0.5)** çok düşük, şansla kazanıyor.
*   **AI Yorumu:** "Dikkat! Oranlar yanıltıcı. Ev sahibi iyi oynuyor ama bitiremiyor (xG 1.8). Deplasman takımı ise istatistiklerin üzerinde performans gösteriyor, düşüş yaşaması an meselesi. **Ev Sahibi Yenilmese (1X)** seçeneği 2.10 oranla büyük bir 'Değer Bahsi'dir."

### Senaryo 2: Canlı Bahis Simülasyonu
*   **Durum:** Maç 0-0 ve DK 60.
*   **FootyStats Verisi:** Bu iki takımın maçlarında gollerin **%70'i 2. yarıda** atılıyor (Goal Timing Stats).
*   **AI Yorumu:** "Maç kilitlenmiş gibi görünse de, iki takım da **'Geç Açılan'** takımlar. İstatistiklere göre 75-90. dakikalar arası gol ihtimali çok yüksek. **0.5 Gol Üstü** canlıdan alınır."

### Senaryo 3: Kart ve Korner Tahminleri
*   **Durum:** Taraf bahsi çok riskli.
*   **FootyStats Verisi:** Hakem kart ortalaması çok düşük ama takımların **'Kart Görme Eğilimi'** yüksek.
*   **Ek Veri:** İki takımın da **'Korner Ortalaması'** 11.5 (Lig ortalamasının çok üstünde).
*   **AI Yorumu:** "Taraf bahsinden uzak durun. İki takım da kanatları çok kullanıyor ve ligin en çok korner kullanan ekipleri. Maçın en güvenli limanı **9.5 Korner Üstü** seçeneğidir."

---

## 4. Teknik Entegrasyon Akışı

1.  **Veri Toplama:** `MatchSyncJob` her sabah çalışır, FootyStats'tan gelen `btts_potential`, `xg`, `trends` verilerini `fs_match_stats` tablosuna yazar.
2.  **Prompt Oluşturma:** `PredictionService` çalışırken, sadece `MatchStats` değil, `fs_match_stats` tablosundan da veri çeker.
3.  **LLM Çağrısı:** Bu zenginleştirilmiş veri seti LLM'e (GPT-4) gönderilir.
4.  **Çıktı:** LLM, bu detaylı verileri işleyerek sadece "Ev Sahibi Kazanır" demekle kalmaz, **"Nedenini"** xG ve Trend verilerine dayandırarak açıklar.

## Sonuç
Evet, üretebileceğiz. FootyStats verileri (özellikle xG ve Potentials), AI'ın **"Sezgisel Zekasını"**, **"Analitik Zekaya"** dönüştürecek. Sadece skora bakan değil, oyunun "ruhunu" (istatistiksel derinliğini) okuyan bir bot olacak.
