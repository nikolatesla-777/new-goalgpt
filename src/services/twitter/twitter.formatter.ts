/**
 * Twitter Formatter
 *
 * Formats football trend data into a 4-tweet thread (Turkish).
 * Each tweet max 280 characters.
 *
 * Thread structure:
 *   Tweet 0 — Header (date, match count, trend count)
 *   Tweet 1 — Goal Trends (top 5, confidence ≥ TWITTER_MIN_CONFIDENCE)
 *   Tweet 2 — Form Trends (top 5, xG advantage)
 *   Tweet 3 — Corner + Card Trends (top 3 each)
 *   Tweet 4 — CTA + Hashtags
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

const TWEET_MAX_CHARS = 280;
const MIN_CONFIDENCE = parseInt(process.env.TWITTER_MIN_CONFIDENCE || '65', 10);
const TEAM_NAME_MAX = 15;

// ============================================================================
// INPUT TYPES (matching TrendsAnalysisResponse from FootyStats)
// ============================================================================

export interface FormatterGoalTrend {
  home_name: string;
  away_name: string;
  league_name: string;
  btts: number;
  over25: number;
  confidence: number;
}

export interface FormatterFormTrend {
  home_name: string;
  away_name: string;
  home_xg: number;
  away_xg: number;
  xg_diff: number;
  favorite_name: string;
  confidence: number;
}

export interface FormatterCornerTrend {
  home_name: string;
  away_name: string;
  corners: number;
  confidence: number;
}

export interface FormatterCardTrend {
  home_name: string;
  away_name: string;
  cards: number;
  confidence: number;
}

export interface TrendsInput {
  goalTrends: FormatterGoalTrend[];
  formTrends: FormatterFormTrend[];
  cornerTrends: FormatterCornerTrend[];
  cardsTrends: FormatterCardTrend[];
  totalMatches: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncate team name to max length
 */
function truncName(name: string, maxLen = TEAM_NAME_MAX): string {
  if (name.length <= maxLen) return name;
  return name.substring(0, maxLen - 1) + '.';
}

/**
 * Ensure tweet fits within 280 characters.
 * Uses surrogate-pair-safe truncation.
 */
function ensureLimit(text: string): string {
  if (text.length <= TWEET_MAX_CHARS) return text;
  let cutAt = TWEET_MAX_CHARS - 3;
  // Don't split a surrogate pair (high surrogate is 0xD800–0xDBFF)
  if ((text.charCodeAt(cutAt - 1) & 0xFC00) === 0xD800) {
    cutAt -= 1;
  }
  return text.substring(0, cutAt) + '...';
}

/**
 * Turkish date string for Europe/Istanbul timezone
 */
function turkishDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
}

/**
 * Number emoji for list positions
 */
const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

// ============================================================================
// TWEET BUILDERS
// ============================================================================

function buildTweet0(input: TrendsInput, date: Date): string {
  const dateStr = turkishDate(date);
  const highConfidenceCount = [
    ...input.goalTrends.filter(t => t.confidence >= MIN_CONFIDENCE),
    ...input.formTrends.filter(t => t.confidence >= MIN_CONFIDENCE),
    ...input.cornerTrends.filter(t => t.confidence >= MIN_CONFIDENCE),
    ...input.cardsTrends.filter(t => t.confidence >= MIN_CONFIDENCE),
  ].length;

  const text = [
    `⚽ GoalGPT Günlük Trend Raporu`,
    `📅 ${dateStr}`,
    `🔍 ${input.totalMatches} maç analiz edildi`,
    `🎯 ${highConfidenceCount} yüksek güven trendi`,
    `Detaylar aşağıda 👇`,
  ].join('\n');

  return ensureLimit(text);
}

function buildTweet1(input: TrendsInput): string {
  const filtered = input.goalTrends
    .filter(t => t.confidence >= MIN_CONFIDENCE)
    .slice(0, 5);

  if (filtered.length === 0) {
    return ensureLimit(`🟢 GOL TRENDLERİ\n\nBugün yeterli güven seviyesinde gol trendi bulunamadı.\n\n#GoalGPT`);
  }

  const lines = [`🟢 GOL TRENDLERİ (KG & 2.5 Üst)\n`];
  for (let i = 0; i < filtered.length; i++) {
    const t = filtered[i];
    const home = truncName(t.home_name);
    const away = truncName(t.away_name);
    lines.push(`${NUM_EMOJI[i]} ${home} - ${away}`);
    lines.push(`   KG: %${Math.round(t.btts ?? 0)} | 2.5Ü: %${Math.round(t.over25 ?? 0)} | 🎯%${Math.round(t.confidence)}`);
  }

  return ensureLimit(lines.join('\n'));
}

function buildTweet2(input: TrendsInput): string {
  const filtered = input.formTrends
    .filter(t => t.confidence >= MIN_CONFIDENCE)
    .slice(0, 5);

  if (filtered.length === 0) {
    return ensureLimit(`📊 FORM TRENDLERİ\n\nBugün yeterli güven seviyesinde form trendi bulunamadı.\n\n#GoalGPT`);
  }

  const lines = [`📊 FORM TRENDLERİ (xG Avantajı)\n`];
  for (let i = 0; i < filtered.length; i++) {
    const t = filtered[i];
    const home = truncName(t.home_name);
    const away = truncName(t.away_name);
    const homeXg = (t.home_xg ?? 0);
    const awayXg = (t.away_xg ?? 0);
    const xgDiff = (t.xg_diff ?? 0);
    const diff = xgDiff >= 0 ? `+${xgDiff.toFixed(1)}` : xgDiff.toFixed(1);
    lines.push(`${NUM_EMOJI[i]} ${home} - ${away}`);
    lines.push(`   🏆 ${truncName(t.favorite_name ?? home)} | xG: ${homeXg.toFixed(1)}-${awayXg.toFixed(1)} (${diff}) | 🎯%${Math.round(t.confidence)}`);
  }

  return ensureLimit(lines.join('\n'));
}

function buildTweet3(input: TrendsInput): string {
  const corners = input.cornerTrends
    .filter(t => t.confidence >= MIN_CONFIDENCE)
    .slice(0, 3);

  const cards = input.cardsTrends
    .filter(t => t.confidence >= MIN_CONFIDENCE)
    .slice(0, 3);

  const lines = [`🚩 KORNER & 🟨 KART TRENDLERİ\n`];

  if (corners.length > 0) {
    lines.push(`KORNER (Yüksek):`);
    for (let i = 0; i < corners.length; i++) {
      const t = corners[i];
      const home = truncName(t.home_name, 12);
      const away = truncName(t.away_name, 12);
      lines.push(`${NUM_EMOJI[i]} ${home}-${away} | ${(t.corners ?? 0).toFixed(1)} ort.`);
    }
    lines.push('');
  }

  if (cards.length > 0) {
    lines.push(`KART (Yüksek):`);
    for (let i = 0; i < cards.length; i++) {
      const t = cards[i];
      const home = truncName(t.home_name, 12);
      const away = truncName(t.away_name, 12);
      lines.push(`${NUM_EMOJI[i]} ${home}-${away} | ${(t.cards ?? 0).toFixed(1)} ort.`);
    }
  }

  if (corners.length === 0 && cards.length === 0) {
    lines.push(`Bugün korner/kart trendi bulunamadı.`);
  }

  return ensureLimit(lines.join('\n'));
}

function buildTweet4(date: Date): string {
  const dateStr = date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const text = [
    `🤖 GoalGPT — Yapay Zeka Destekli Futbol Tahmin Platformu`,
    `📅 ${dateStr} tarihli günlük analiz`,
    ``,
    `#GoalGPT #Futbol #Tahmin #Maç #Analiz`,
  ].join('\n');
  return ensureLimit(text);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Format trends data into a 4-tweet thread
 * @returns Array of 4 tweet strings, each max 280 chars
 */
export function formatTrendsThread(input: TrendsInput): string[] {
  const now = new Date();
  return [
    buildTweet0(input, now),
    buildTweet1(input),
    buildTweet2(input),
    buildTweet3(input),
    buildTweet4(now),
  ];
}
