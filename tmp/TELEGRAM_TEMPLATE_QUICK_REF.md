# FootyStats → Telegram Template - Quick Reference

## 🎯 ÖNERILEN TEMPLATE (Kompakt - 12 Satır)

```
🔵 {HOME_TEAM} vs {AWAY_TEAM} 🟢
🏆 {LEAGUE} | ⏰ {TIME}

📊 BETTING SIGNALS
• BTTS: {btts}% ⚽⚽
• O2.5: {over25}% | O1.5: {over15}%
• xG Total: {xg.total} (Home {xg.home} | Away {xg.away})

📈 FORM
{home}: {home.ppg} PPG | {away}: {away.ppg} PPG

🎯 H2H ({h2h.total_matches} games)
{h2h.home_wins}W-{h2h.draws}D-{h2h.away_wins}L | Avg {h2h.avg_goals} goals | BTTS {h2h.btts_pct}%

💰 Odds: {odds.home} | {odds.draw} | {odds.away}
```

---

## 📋 FIELD MAPPING (API → Template)

### ✅ ZORUNLU (Her zaman var)
```javascript
{
  home_name: data.home_name,              // ✓ Always
  away_name: data.away_name,              // ✓ Always
  league_name: data.league_name,          // ✓ Usually
  date_unix: data.date_unix,              // ✓ Always

  xg: {
    home: data.xg.home,                   // ✓ Always
    away: data.xg.away,                   // ✓ Always
    total: data.xg.total                  // ✓ Always (calculated)
  },

  odds: {
    home: data.odds.home,                 // ✓ Always
    draw: data.odds.draw,                 // ✓ Always
    away: data.odds.away                  // ✓ Always
  },

  form: {
    home_ppg: data.form.home.ppg,         // ✓ Always
    away_ppg: data.form.away.ppg          // ✓ Always
  }
}
```

### ⚠️ KOŞULLU (NULL olabilir - fallback gerekli)
```javascript
{
  potentials: {
    btts: data.potentials?.btts || null,        // ⚠️ 33% NULL
    over25: data.potentials?.over25 || null,    // ⚠️ 33% NULL
    over15: data.potentials?.over15 || null,    // ⚠️ 33% NULL
    corners: data.potentials?.corners || null,  // ⚠️ 33% NULL
    cards: data.potentials?.cards || null       // ⚠️ 33% NULL
  },

  h2h: data.h2h ? {                            // ⚠️ Bazen NULL
    total_matches: data.h2h.total_matches,
    home_wins: data.h2h.home_wins,
    draws: data.h2h.draws,
    away_wins: data.h2h.away_wins,
    btts_pct: data.h2h.btts_pct,
    avg_goals: data.h2h.avg_goals
  } : null,

  trends: {
    home: data.trends?.home || [],              // ⚠️ Bazen []
    away: data.trends?.away || []               // ⚠️ Bazen []
  }
}
```

### ❌ KULLANMA (Her zaman NULL)
```javascript
// ASLA KULLANMA - Her zaman NULL!
data.form.home.overall        // ❌ NULL
data.form.away.overall        // ❌ NULL
data.form.home.home_only      // ❌ NULL
data.form.away.away_only      // ❌ NULL
```

---

## 🔧 NULL-SAFE FORMATTER

```javascript
function formatTelegramMessage(data) {
  // Base message (ALWAYS available)
  let msg = `🔵 ${data.home_name} vs ${data.away_name} 🟢\n`;
  msg += `🏆 ${data.league_name || 'Match'} | ⏰ ${formatTime(data.date_unix)}\n\n`;

  // Betting signals (CHECK NULL)
  if (data.potentials?.btts && data.potentials?.over25) {
    msg += `📊 BETTING SIGNALS\n`;
    msg += `• BTTS: ${data.potentials.btts}% ⚽⚽\n`;
    msg += `• O2.5: ${data.potentials.over25}% | O1.5: ${data.potentials.over15}%\n`;
    msg += `• xG Total: ${data.xg.total} (Home ${data.xg.home} | Away ${data.xg.away})\n\n`;
  } else {
    // Fallback: Show only xG
    msg += `⚡ xG: ${data.xg.home} - ${data.xg.away} (Total: ${data.xg.total})\n\n`;
  }

  // Form (ALWAYS available)
  msg += `📈 FORM\n`;
  msg += `${data.home_name}: ${data.form.home.ppg} PPG | `;
  msg += `${data.away_name}: ${data.form.away.ppg} PPG\n\n`;

  // H2H (CHECK NULL)
  if (data.h2h && data.h2h.total_matches > 0) {
    msg += `🎯 H2H (${data.h2h.total_matches} games)\n`;
    msg += `${data.h2h.home_wins}W-${data.h2h.draws}D-${data.h2h.away_wins}L | `;
    msg += `Avg ${data.h2h.avg_goals} goals | BTTS ${data.h2h.btts_pct}%\n\n`;
  }

  // Odds (ALWAYS available)
  msg += `💰 Odds: ${data.odds.home} | ${data.odds.draw} | ${data.odds.away}`;

  return msg;
}

function formatTime(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
```

---

## 📊 ÖRNEK OUTPUT (3 Farklı Veri Kalitesi)

### 1️⃣ MÜKEMMEL VERİ (Alavés vs Betis)
```
🔵 Deportivo Alavés vs Real Betis 🟢
🏆 La Liga | ⏰ 18:00

📊 BETTING SIGNALS
• BTTS: 75% ⚽⚽
• O2.5: 45% | O1.5: 74%
• xG Total: 2.87 (Home 1.38 | Away 1.49)

📈 FORM
Deportivo Alavés: 0.8 PPG | Real Betis: 1.4 PPG

🎯 H2H (20 games)
6W-6D-8L | Avg 2.2 goals | BTTS 50%

💰 Odds: 2.64 | 2.99 | 2.55
```

### 2️⃣ İYİ VERİ (Aris vs Levadiakos)
```
🔵 Aris vs Levadiakos 🟢
🏆 Greece Super League | ⏰ 16:00

📊 BETTING SIGNALS
• BTTS: 63% ⚽⚽
• O2.5: 32% | O1.5: 70%
• xG Total: 2.85 (Home 1.54 | Away 1.31)

📈 FORM
Aris: 1.4 PPG | Levadiakos: 3.0 PPG

🎯 H2H (11 games)
5W-3D-3L | Avg 2.91 goals | BTTS 64%

💰 Odds: 2.75 | 3.10 | 2.80
```

### 3️⃣ KISITLI VERİ (Gimnasia vs Racing) - FALLBACK
```
🔵 Gimnasia La Plata vs Racing Club 🟢
🏆 Argentina Liga | ⏰ 02:30

⚡ xG: 1.09 - 1.51 (Total: 2.6)

📈 FORM
Gimnasia La Plata: 2.4 PPG | Racing Club: 2.0 PPG

🎯 H2H (11 games)
4W-2D-5L | Avg 2.09 goals | BTTS 36%

💰 Odds: 3.55 | 2.90 | 2.25

⚠️ Limited betting data available
```

---

## ⚙️ IMPLEMENTATION CHECKLIST

- [ ] Create `src/services/telegram/footystats.formatter.ts`
- [ ] Implement NULL-safe formatter function
- [ ] Add emoji helpers (team colors, league icons)
- [ ] Create job: `src/jobs/footyStatsPublisher.job.ts`
- [ ] Schedule: Every 30 minutes (check upcoming matches)
- [ ] Filter: Only matches within 2 hours OR live
- [ ] Test with 3 sample JSONs
- [ ] Add error logging for missing fields
- [ ] Deploy to VPS

---

## 🎨 EMOJI MAP (Optional Enhancement)

```javascript
const LEAGUE_EMOJIS = {
  'Premier League': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'La Liga': '🇪🇸',
  'Serie A': '🇮🇹',
  'Bundesliga': '🇩🇪',
  'Ligue 1': '🇫🇷',
  'Champions League': '🏆',
  // ... add more
};

const POTENTIAL_EMOJIS = {
  high: '🔥',    // 70%+
  medium: '⚠️',  // 40-69%
  low: '💤'      // <40%
};

function getPotentialEmoji(percent) {
  if (percent >= 70) return '🔥';
  if (percent >= 40) return '⚠️';
  return '💤';
}
```

---

## 🚀 QUICK START

```bash
# 1. Test formatter locally
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('tmp/footystats-samples/8200594.json', 'utf8'));
// ... paste formatTelegramMessage function ...
console.log(formatTelegramMessage(data));
"

# 2. Create job file
touch src/jobs/footyStatsPublisher.job.ts

# 3. Register in jobManager.ts

# 4. Test job
npm run dev
```
