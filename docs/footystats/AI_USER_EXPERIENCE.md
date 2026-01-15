# GoalGPT AI Analizi: Kullanıcı Deneyimi ve Akış (UX & User Flow)

FootyStats verileriyle güçlendirilmiş "Brain" modelinin, web sitesindeki son kullanıcıya (bahisçi) nasıl sunulacağını ve kullanıcı deneyimini nasıl değiştireceğini anlatan detaylı akış.

## 1. Yeni Özellik: "GoalGPT Pro Analiz" Kartı

Mevcut basit tahmin kartlarının yerini, derinlemesine analiz sunan, interaktif ve görsel olarak zenginleştirilmiş **"Pro Analiz"** kartları alacak.

---

## 2. Kullanıcı Akışı (User Flow)

### Adım 1: Keşif (Anasayfa / Maç Listesi)
Kullanıcı, maç listesinde gezinirken bazı maçların yanında özel bir **"AI 🔥"** veya **"xG Analizi"** ikonu görür.
*   **Görsel:** Maç kartında küçük bir bar (progress bar) ile "BTTS İhtimali: %78" gibi çarpıcı bir veri gösterilir.
*   **Aksiyon:** Kullanıcı, ilginç bulduğu bu veriye tıklar.

### Adım 2: Maç Detayı - "AI Uzmanı" Sekmesi
Kullanıcı maç detayına girdiğinde, klasik "İstatistikler" sekmesinin yanında yeni bir sekmeyle karşılaşır: **"GoalGPT Analizi"**.

Bu sekme yukarıdan aşağıya şöyle bir hikaye anlatır:

#### A. Özet Kartı (Executive Summary)
Her şeyi okumak istemeyenler için en üstte dev bir kart.
> **AI Tahmini:** **Ev Sahibi Kazanır & 2.5 Üst**
> **Güven:** **%85** (Yüksek)
> **Neden?** "Fenerbahçe'nin xG'si (1.95) lig ortalamasının çok üstünde ve rakip son 3 maçtır deplasmanda gol yiyor."

#### B. xG Savaşları (Görsel Anlatım)
Futbol sahası grafiği üzerinde görselleştirilmiş veri.
*   Sahanın solunda Ev Sahibi xG barı, sağında Deplasman.
*   **Mesaj:** "Ev sahibi (1.85 xG) üretken ama bitiricilik sorunu yaşıyor." (Bu, kullanıcıya 'Sürpriz Olabilir' mesajı verir).

#### C. Altın İstatistikler (Key Insights)
FootyStats'tan gelen en vurucu veriler ikonlarla listelenir.
*   🏁 **Form:** "Burnley son 6 maçtır gol atıyor." (Yeşil tik)
*   🚩 **Hakem:** "M. Oliver bu sezon maç başına 0.4 penaltı çaldı." (Sarı uyarı ikonu)
*   🥅 **BTTS Fırsatı:** "Bu ligde maçların %65'i KG Var bitiyor. Bu maçın potansiyeli %80."

#### D. Yapay Zeka Sohbeti (Interactive Chat)
Burası en can alıcı nokta. Kullanıcı statik veriye bakmakla yetinmez, AI ile konuşabilir.

> **Kullanıcı:** "Bu maça Korner bahsi alınır mı?"
> **GoalGPT:** "Kesinlikle! İki takımın ortalaması 12.5 korner. Lig ortalaması ise 9.2. Ayrıca hakem oyunu çok durdurmuyor, tempo yüksek olacak. **10.5 Üst** mantıklı duruyor."

---

## 3. Web Arayüzü Tasarım Fikirleri (UI Mockup Concepts)

### Kart Tasarımı: "The Confidence Meter"
Ekranda bir hız göstergesi (speedometer) gibi bir grafik.
*   İbre **"Riskli"**, **"Dengeli"**, **"Banko"** arasında oynar.
*   FootyStats'tan gelen `risk` verisi (API'de var) bu ibreyi kontrol eder.

### Kart Tasarımı: "The Trend Timeline"
Yatay bir zaman çizelgesi.
*   Son 5 maçtaki gol dakikaları işaretlenmiş.
*   Özellikle "Gollerin %70'i 2. Yarıda" gibi veriler görsel olarak vurgulanır. **"Canlı Bahis İçin Bekle"** uyarısı çıkar.

---

## 4. Kullanıcı Deneyimi Kazanımları (Why Users Will Love It)

1.  **Güven:** Sadece "Oyna" demiyoruz, "Nedenini" kanıtlarla (xG, Hakem, Form) gösteriyoruz. Kullanıcı kandırılmadığını hissediyor.
2.  **Eğitim:** Kullanıcı, xG veya BTTS Potansiyeli gibi kavramları öğrenerek daha bilinçli bahis yapmaya başlıyor.
3.  **Kişiselleştirme:** "Risk seven biriyim" diyen kullanıcıya, AI yüksek oranlı ama mantıklı (xG destekli) sürpriz maçları öne çıkarıyor.

## 5. Gelir Modeli Etkisi (Business Impact)
Bu detaylı analiz sayfası, **"VIP / Premium"** üyelik için en büyük satış kozu (USP) olur.
*   **Free:** Sadece Tahmin Sonucunu (Ev Sahibi Kazanır) görür.
*   **Premium:** xG analizini, Hakem verisini ve AI Yorumunu görür.

---

**Sonuç:** Web sitesi, bir "veri çöplüğü" olmaktan çıkıp, kullanıcının yanında oturan ve ona maçın röntgenini çeken bir **"Futbol Analisti Asistanına"** dönüşecek.
