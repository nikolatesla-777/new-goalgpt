/**
 * Image Generator Service
 *
 * Generates beautiful PNG images from daily list data
 * for sharing on Telegram channels
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import nodeHtmlToImage from 'node-html-to-image';
import { logger } from '../../utils/logger';
import type { DailyList } from './dailyLists.service';

// ============================================================================
// MARKET CONFIG
// ============================================================================

const MARKET_CONFIG: Record<string, { label: string; icon: string; gradient: string }> = {
  OVER_25: { label: '2.5 ÜST', icon: '📈', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  OVER_15: { label: '1.5 ÜST', icon: '🔥', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  BTTS: { label: 'BTTS', icon: '⚽', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  HT_OVER_05: { label: 'İY 0.5 ÜST', icon: '⏱️', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  CORNERS: { label: 'KORNER', icon: '🚩', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  CARDS: { label: 'KART', icon: '🟨', gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
};

// ============================================================================
// HTML TEMPLATE GENERATOR
// ============================================================================

function generateHTML(list: DailyList): string {
  const config = MARKET_CONFIG[list.market] || MARKET_CONFIG.OVER_25;
  const matches = list.matches.slice(0, 5); // Max 5 matches

  // Calculate confidence badge color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10b981'; // green
    if (confidence >= 70) return '#3b82f6'; // blue
    return '#f59e0b'; // yellow
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return '🔥';
    if (confidence >= 70) return '⭐';
    return '💡';
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: #f3f4f6;
          padding: 0;
          margin: 0;
        }

        .container {
          width: 560px;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
        }

        .header {
          background: ${config.gradient};
          padding: 32px;
          color: white;
          position: relative;
          overflow: hidden;
        }

        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 200px;
          height: 200px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }

        .header::after {
          content: '';
          position: absolute;
          bottom: -30%;
          left: -8%;
          width: 150px;
          height: 150px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }

        .header-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .icon {
          font-size: 48px;
          line-height: 1;
        }

        .header-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 16px;
          opacity: 0.9;
          font-weight: 500;
        }

        .confidence-badge {
          background: rgba(255,255,255,0.25);
          backdrop-filter: blur(10px);
          padding: 16px 24px;
          border-radius: 16px;
          text-align: center;
          border: 2px solid rgba(255,255,255,0.3);
        }

        .confidence-label {
          font-size: 12px;
          opacity: 0.9;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .confidence-value {
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
        }

        .progress-bar {
          margin-top: 20px;
          height: 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: rgba(255,255,255,0.9);
          border-radius: 4px;
          width: ${list.avg_confidence}%;
        }

        .matches {
          padding: 24px;
        }

        .match-card {
          background: #f9fafb;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          border: 2px solid #e5e7eb;
        }

        .match-card:last-child {
          margin-bottom: 0;
        }

        .match-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .match-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .match-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .league-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
        }

        .confidence-score {
          background: ${getConfidenceColor(matches[0]?.confidence || 0)};
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .match-teams {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .match-number {
          font-size: 18px;
          font-weight: 800;
          color: #9ca3af;
        }

        .team-names {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          flex: 1;
        }

        .stats-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .stat-badge {
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          border: 1.5px solid;
        }

        .stat-badge.over {
          background: #dbeafe;
          color: #1e40af;
          border-color: #93c5fd;
        }

        .stat-badge.btts {
          background: #d1fae5;
          color: #065f46;
          border-color: #6ee7b7;
        }

        .stat-badge.xg {
          background: #fed7aa;
          color: #9a3412;
          border-color: #fdba74;
        }

        .footer {
          text-align: center;
          padding: 24px;
          color: #6b7280;
          font-size: 11px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .watermark {
          font-weight: 700;
          color: #111827;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="header-content">
            <div class="header-left">
              <div class="icon">${config.icon}</div>
              <div class="header-title">
                <div class="title">${config.label}</div>
                <div class="subtitle">${list.matches_count} Maç Seçildi</div>
              </div>
            </div>
            <div class="confidence-badge">
              <div class="confidence-label">Ortalama Güven</div>
              <div class="confidence-value">${list.avg_confidence}%</div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>

        <!-- Matches -->
        <div class="matches">
          ${matches.map((match, idx) => `
            <div class="match-card">
              <div class="match-header">
                <div class="match-info">
                  <div class="match-time">
                    ⏰ ${new Date(match.match.date_unix * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div class="league-name">${match.match.league_name}</div>
                </div>
                <div class="confidence-score">
                  ${getConfidenceIcon(match.confidence)} ${match.confidence}
                </div>
              </div>

              <div class="match-teams">
                <div class="match-number">#${idx + 1}</div>
                <div class="team-names">${match.match.home_name} vs ${match.match.away_name}</div>
              </div>

              ${list.market === 'OVER_25' && (match.match.potentials || match.match.xg) ? `
                <div class="stats-badges">
                  ${match.match.potentials?.over25 ? `
                    <div class="stat-badge over">🔥 Ü2.5: ${match.match.potentials.over25}%</div>
                  ` : ''}
                  ${match.match.potentials?.btts ? `
                    <div class="stat-badge btts">💚 BTTS: ${match.match.potentials.btts}%</div>
                  ` : ''}
                  ${match.match.xg && (match.match.xg.home || match.match.xg.away) ? `
                    <div class="stat-badge xg">⚡ xG: ${((match.match.xg.home || 0) + (match.match.xg.away || 0)).toFixed(1)}</div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Footer -->
        <div class="footer">
          <div>İstatistiksel verilere dayanır • Canlıya girmeden önce kontrol edin</div>
          <div class="watermark">⚽ GoalGPT • Akıllı Futbol Tahminleri</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// IMAGE GENERATOR
// ============================================================================

/**
 * Generate PNG image from daily list data
 */
export async function generateDailyListImage(list: DailyList): Promise<Buffer> {
  try {
    logger.info(`[ImageGenerator] Generating image for ${list.market}...`);

    const html = generateHTML(list);

    const image = await nodeHtmlToImage({
      html,
      type: 'png',
      puppeteerArgs: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      quality: 100,
    }) as Buffer;

    logger.info(`[ImageGenerator] ✅ Image generated (${(image.length / 1024).toFixed(1)}KB)`);

    return image;
  } catch (error) {
    logger.error('[ImageGenerator] Failed to generate image:', error);
    throw new Error('Failed to generate image');
  }
}

/**
 * Generate default caption text for daily list
 */
export function generateDefaultCaption(list: DailyList): string {
  const config = MARKET_CONFIG[list.market] || MARKET_CONFIG.OVER_25;
  const date = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `📊 <b>${config.label} TAHMİNLERİ</b>

✅ ${list.matches_count} maç seçildi
🔥 Ortalama güven: ${list.avg_confidence}%
📅 Tarih: ${date}

⚠️ <b>Risk Uyarısı:</b> Bu tahminler istatistiksel verilere dayanır.
Canlıya girmeden önce oran ve kadro kontrolü önerilir.

#GoalGPT #${list.market} #FutbolTahminleri`;
}
