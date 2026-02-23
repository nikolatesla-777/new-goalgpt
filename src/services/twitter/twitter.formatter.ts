/**
 * Twitter Trend Formatter
 * Formats FootyStats Turkish trends into the confirmed tweet template:
 *
 * ⚡️ TREND ANALİZİ ⚡️
 *
 * 🏠 TAKIM ADI
 * ──────────────────
 * 👉 trend 1
 * 👉 trend 2
 * ...
 *
 *  ✈️  TAKIM ADI
 * ──────────────────
 * 👉 trend 1
 * 👉 trend 2
 * ...
 */

export interface TrendItem {
  text: string;
  sentiment?: string;
}

export interface MatchTrendsInput {
  homeName: string;
  awayName: string;
  homeTrends: TrendItem[];
  awayTrends: TrendItem[];
  leagueName?: string;
}

const SEPARATOR = '──────────────────';

/**
 * Formats match trends into the standard tweet template.
 * Returns a single tweet string (Twitter Premium — no 280 char limit concern).
 */
export function formatTrendsTweet(input: MatchTrendsInput): string {
  const { homeName, awayName, homeTrends, awayTrends, leagueName } = input;

  const lines: string[] = [];

  // Header
  lines.push('⚡️ TREND ANALİZİ ⚡️');
  if (leagueName) {
    lines.push(`📍 ${leagueName}`);
  }
  lines.push('');

  // Home team
  lines.push(`🏠 ${homeName.toUpperCase()}`);
  lines.push(SEPARATOR);
  if (homeTrends.length === 0) {
    lines.push('👉 Trend verisi bulunamadı.');
  } else {
    for (const trend of homeTrends) {
      lines.push(`👉 ${trend.text}`);
    }
  }

  lines.push('');

  // Away team
  lines.push(` ✈️  ${awayName.toUpperCase()}`);
  lines.push(SEPARATOR);
  if (awayTrends.length === 0) {
    lines.push('👉 Trend verisi bulunamadı.');
  } else {
    for (const trend of awayTrends) {
      lines.push(`👉 ${trend.text}`);
    }
  }

  return lines.join('\n');
}

/**
 * Preview formatter — prints the tweet to console exactly as it will appear on Twitter.
 */
export function previewTrendsTweet(input: MatchTrendsInput): void {
  const tweet = formatTrendsTweet(input);
  const border = '═'.repeat(60);
  console.log(`\n╔${border}╗`);
  console.log(`║  TWITTER TREND ANALİZİ ÖNİZLEME`);
  console.log(`╠${border}╣`);
  tweet.split('\n').forEach((line: string) => {
    console.log(`  ${line}`);
  });
  console.log(`╚${border}╝`);
  console.log(`\n  Karakter sayısı: ${tweet.length}\n`);
}
