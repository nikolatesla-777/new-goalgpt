# FootyStats RAW Data Analysis Report

**Date:** 2026-01-25
**Total Matches Analyzed:** 3
**Samples:** Gimnasia vs Racing (8419232), Aris vs Levadiakos (8280495), Alavés vs Betis (8200594)

---

## A) ÖRNEK JSON FIELD MAP

### 1. **Match 8419232 - Gimnasia La Plata vs Racing Club** (Low Data Quality)
```
Path                          Value         Notes
────────────────────────────────────────────────────────────
status                        "incomplete"  Match not started
date_unix                     1769293800    Unix timestamp
score                         "0-0"         Pre-match

✗ potentials.btts             NULL          Missing!
✗ potentials.over25           NULL          Missing!
✗ potentials.over15           NULL          Missing!
✗ potentials.corners          NULL          Missing!
✗ potentials.cards            NULL          Missing!

✓ xg.home                     1.09          Available
✓ xg.away                     1.51          Available
✓ xg.total                    2.6           Calculated

✓ odds.home                   3.55          Bookmaker odds
✓ odds.draw                   2.9
✓ odds.away                   2.25

✗ form.home.overall           NULL          Missing (form string)
✓ form.home.ppg               2.4           Points per game
✓ form.home.btts_pct          20            BTTS % (season)
✓ form.home.over25_pct        40            O2.5 % (season)

✓ h2h.total_matches           11            H2H history exists
✓ h2h.home_wins               4
✓ h2h.away_wins               5
✓ h2h.btts_pct                36            BTTS % in H2H
✓ h2h.avg_goals               2.09          Avg goals in H2H

✗ trends.home                 []            No trend data
✗ trends.away                 []            No trend data
```

### 2. **Match 8280495 - Aris vs Levadiakos** (Good Data Quality)
```
Path                          Value         Notes
────────────────────────────────────────────────────────────
✓ potentials.btts             63            Available!
✓ potentials.over25           32
✓ potentials.over15           70            Calculated
✓ potentials.corners          11.26         Avg corners expected
✓ potentials.cards            4.88          Avg cards expected

✓ xg.home                     1.54
✓ xg.away                     1.31
✓ xg.total                    2.85

✓ odds.home                   2.75
✓ odds.draw                   3.1
✓ odds.away                   2.8

✓ form.home.ppg               1.4
✓ form.away.ppg               3.0           Good away form!

✓ h2h.total_matches           11
✓ h2h.btts_pct                64            High BTTS in H2H!
✓ h2h.avg_goals               2.91          High-scoring H2H

✓ trends.home                 4 items       "Unbeaten in 6 home games"
✓ trends.away                 8 items       "Unbeaten in 6 away games"
```

### 3. **Match 8200594 - Deportivo Alavés vs Real Betis** (Excellent Data)
```
Path                          Value         Notes
────────────────────────────────────────────────────────────
✓ potentials.btts             75            High! Both scoring likely
✓ potentials.over25           45            Medium probability
✓ potentials.over15           74            Very high for O1.5

✓ xg.home                     1.38          Balanced xG
✓ xg.away                     1.49          Betis slight edge
✓ xg.total                    2.87

✓ odds.home                   2.64          Balanced odds
✓ odds.draw                   2.99
✓ odds.away                   2.55

✓ form.home.ppg               0.8           Poor home form!
✓ form.away.ppg               1.4           Better away form

✓ h2h.total_matches           20            Large sample
✓ h2h.home_wins               6
✓ h2h.away_wins               8             Away advantage
✓ h2h.btts_pct                50            50/50 BTTS
✓ h2h.avg_goals               2.2

✓ trends.home                 6 items       "Scored in last 3 home games"
✓ trends.away                 7 items       "2 games unbeaten"
```

---

## B) TELEGRAM PRE-MATCH TEMPLATE v2

### **Seçenek 1: Kompakt Format (12 satır)**
```
🔵 ALAVES vs REAL BETIS 🟢
🏆 La Liga | ⏰ 18:00

📊 BETTING SIGNALS
• BTTS: 75% ⚽⚽
• O2.5: 45% | O1.5: 74%
• xG Total: 2.87 (Home 1.38 | Away 1.49)

📈 FORM
Alavés: 0.8 PPG | Betis: 1.4 PPG ↗️

🎯 H2H (20 games)
6W-6D-8L | Avg 2.2 goals | BTTS 50%

💰 Odds: 2.64 | 2.99 | 2.55
```

### **Seçenek 2: Detaylı Format (16 satır)**
```
⚽ MATCH PREVIEW ⚽

🏟️ ALAVES (H) vs REAL BETIS (A)
🏆 La Liga • 🕐 25 Jan, 18:00

━━━━━━━━━━━━━━━━━━━━━━━
📊 BETTING POTENTIALS
━━━━━━━━━━━━━━━━━━━━━━━
✅ BTTS: 75% ⭐⭐⭐
✅ Over 1.5: 74% ⭐⭐⭐
🟡 Over 2.5: 45% ⭐⭐
🟡 Corners: ~10.6
🟡 Cards: ~4.1

⚡ xG ANALYSIS
Home: 1.38 | Away: 1.49 | Total: 2.87

📈 RECENT FORM (PPG)
🏠 Alavés: 0.8 (Poor)
✈️ Betis: 1.4 (Decent)

🤝 HEAD-TO-HEAD
20 games: 6W-6D-8L (Away edge)
BTTS: 50% | Avg Goals: 2.2

💰 ODDS
1: 2.64 | X: 2.99 | 2: 2.55

🔥 KEY INSIGHTS
• Alavés scored in last 3 home games
• Betis unbeaten in last 2 games
```

---

## C) METRİK GÜVENİLİRLİK NOTU

| Metrik | Güvenilirlik | Boş Olabilir Mi? | Açıklama |
|--------|--------------|------------------|----------|
| **xG.home** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da mevcut |
| **xG.away** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da mevcut |
| **xG.total** | 🟢 YÜKSEK | Nadiren | Calculated field |
| **potentials.btts** | 🟡 ORTA | Sık Sık | 1/3 maçta NULL |
| **potentials.over25** | 🟡 ORTA | Sık Sık | 1/3 maçta NULL |
| **potentials.over15** | 🟡 ORTA | Sık Sık | 1/3 maçta NULL |
| **potentials.corners** | 🟡 ORTA | Sık Sık | 1/3 maçta NULL |
| **potentials.cards** | 🟡 ORTA | Sık Sık | 1/3 maçta NULL |
| **odds.home** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **odds.draw** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **odds.away** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **form.home.ppg** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **form.away.ppg** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **form.home.btts_pct** | 🟢 YÜKSEK | Nadiren | Season BTTS % |
| **form.home.over25_pct** | 🟢 YÜKSEK | Nadiren | Season O2.5 % |
| **form.away.btts_pct** | 🟢 YÜKSEK | Nadiren | Season BTTS % |
| **form.away.over25_pct** | 🟢 YÜKSEK | Nadiren | Season O2.5 % |
| **form.home.overall** | 🔴 DÜŞÜK | Her Zaman | 0/3 maçta NULL (W-D-L string) |
| **form.away.overall** | 🔴 DÜŞÜK | Her Zaman | 0/3 maçta NULL |
| **h2h.total_matches** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **h2h.home_wins** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **h2h.draws** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **h2h.away_wins** | 🟢 YÜKSEK | Nadiren | Her 3 maçta da var |
| **h2h.btts_pct** | 🟢 YÜKSEK | Nadiren | H2H BTTS % |
| **h2h.avg_goals** | 🟢 YÜKSEK | Nadiren | H2H avg goals |
| **trends.home** | 🟡 ORTA | Bazen | 1/3 maçta boş array |
| **trends.away** | 🟡 ORTA | Bazen | 1/3 maçta boş array |

---

## D) KULLANILMAMASI GEREKEN METRİKLER

❌ **form.home.overall** - Her zaman NULL (W-D-L string bekleniyor ama gelmiyor)
❌ **form.away.overall** - Her zaman NULL
❌ **form.home.home_only** - Her zaman NULL
❌ **form.away.away_only** - Her zaman NULL

---

## E) TELEGRAM TEMPLATE İÇİN ÖNERİLER

### ✅ ZORUNLU ALANLAR (Her zaman göster)
- **Match Info**: home_name, away_name, league_name, date
- **xG**: home, away, total
- **Odds**: home, draw, away

### ⭐ YÜKSEK ÖNCELİKLİ (Varsa göster, yoksa atla)
- **Potentials**: btts, over25, over15
- **Form PPG**: home.ppg, away.ppg
- **H2H**: total_matches, result summary, btts_pct, avg_goals

### 🟡 ORTA ÖNCELİKLİ (Bonus bilgi)
- **Corners/Cards**: Potentials varsa
- **Form BTTS/O2.5**: Season percentages
- **Trends**: İlk 2-3 trend (eğer varsa)

### 🔴 DÜŞÜK ÖNCELİKLİ (Telegram'da gereksiz)
- **form.overall** string - NULL geliyor
- **Injury data** - Endpoint'te yok
- **Referee stats** - Endpoint'te yok

---

## F) ÖRNEK TELEGRAM MESAJ AKIŞI

```javascript
// Pseudo-code
function buildTelegramMessage(fsData) {
  let msg = `⚽ ${fsData.home_name} vs ${fsData.away_name}\n`;
  msg += `🏆 ${fsData.league_name || 'Unknown League'}\n\n`;

  // xG (ZORUNLU)
  msg += `⚡ xG: ${fsData.xg.home} - ${fsData.xg.away}\n`;
  msg += `   Total: ${fsData.xg.total}\n\n`;

  // Potentials (VARSA)
  if (fsData.potentials.btts) {
    msg += `📊 BETTING SIGNALS\n`;
    msg += `• BTTS: ${fsData.potentials.btts}%\n`;
    msg += `• O2.5: ${fsData.potentials.over25}%\n`;
    msg += `• O1.5: ${fsData.potentials.over15}%\n\n`;
  }

  // Form (PPG her zaman var)
  msg += `📈 FORM (PPG)\n`;
  msg += `🏠 ${fsData.form.home.ppg} | `;
  msg += `✈️ ${fsData.form.away.ppg}\n\n`;

  // H2H
  if (fsData.h2h) {
    msg += `🤝 H2H (${fsData.h2h.total_matches} games)\n`;
    msg += `${fsData.h2h.home_wins}W-${fsData.h2h.draws}D-${fsData.h2h.away_wins}L\n`;
    msg += `Avg ${fsData.h2h.avg_goals} goals | BTTS ${fsData.h2h.btts_pct}%\n\n`;
  }

  // Odds
  msg += `💰 ${fsData.odds.home} | ${fsData.odds.draw} | ${fsData.odds.away}`;

  return msg;
}
```

---

## G) SONUÇ & ÖNERİLER

### ✅ **Kullanılabilir Metrikler (Yüksek Güvenilirlik)**
1. xG (home, away, total)
2. Odds (1X2)
3. Form PPG
4. H2H statistics
5. Season BTTS/O2.5 percentages

### ⚠️ **Dikkatli Kullanılacak Metrikler (Orta Güvenilirlik)**
1. Potentials (btts, over25, over15) - Bazen NULL
2. Corners/Cards - Bazen NULL
3. Trends - Bazen boş array

### ❌ **Kullanılmayacak Metrikler**
1. form.overall (W-D-L string) - Her zaman NULL
2. form.home_only / away_only - Her zaman NULL

### 💡 **Telegram Template Önerisi**
**Kompakt Format (12 satır)** kullanılmalı çünkü:
- Telegram'da okunması kolay
- Kritik bilgileri içeriyor
- NULL check mantığı basit
- Her maç tipi için çalışır (az veri / çok veri)

**Fallback Stratejisi:**
```
IF potentials.btts IS NULL:
  SHOW "⚠️ Limited data - xG & Odds only"
ELSE:
  SHOW full betting signals
```
