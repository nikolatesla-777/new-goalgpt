/**
 * Telegram Preview Panel
 *
 * Preview message and pick selection for publishing to Telegram
 */

interface Match {
  id: number;
  home_name: string;
  away_name: string;
  competition_name?: string;
  date_unix: number;
  btts_potential?: number;
  o25_potential?: number;
  o15_potential?: number;
  team_a_xg_prematch?: number;
  team_b_xg_prematch?: number;
  odds_ft_1?: number;
  odds_ft_x?: number;
  odds_ft_2?: number;
}

interface Pick {
  market_type: string;
  odds?: number;
}

interface Props {
  match: Match | null;
  picks: Pick[];
  onPickToggle: (marketType: string, odds?: number) => void;
  onPublish: () => void;
  publishing: boolean;
}

const AVAILABLE_PICKS = [
  { market_type: 'BTTS_YES', label: 'Karşılıklı Gol (BTTS)', emoji: '⚽⚽' },
  { market_type: 'O25_OVER', label: 'Alt/Üst 2.5 Gol', emoji: '🎯' },
  { market_type: 'O15_OVER', label: 'Alt/Üst 1.5 Gol', emoji: '🎯' },
  { market_type: 'HT_O05_OVER', label: 'İlk Yarı 0.5 Üst', emoji: '⏱️' },
];

export function TelegramPreview({ match, picks, onPickToggle, onPublish, publishing }: Props) {
  if (!match) {
    return (
      <div style={{
        padding: '24px',
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        ← Bir maç seçin
      </div>
    );
  }

  const matchDate = new Date(match.date_unix * 1000);
  const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = matchDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

  // Build preview message
  let previewMessage = `⚽ ${match.home_name} vs ${match.away_name}\n`;
  previewMessage += `🏆 ${match.competition_name || 'Bilinmeyen Lig'} | 🕐 ${dateStr} ${timeStr}\n\n`;

  if (match.btts_potential || match.o25_potential || match.o15_potential) {
    previewMessage += `📊 İstatistikler:\n`;
    if (match.btts_potential) previewMessage += `• BTTS: %${match.btts_potential} ⚽⚽\n`;
    if (match.o25_potential) previewMessage += `• Alt/Üst 2.5: %${match.o25_potential}\n`;
    if (match.o15_potential) previewMessage += `• Alt/Üst 1.5: %${match.o15_potential}\n`;
    previewMessage += `\n`;
  }

  if (match.team_a_xg_prematch !== undefined && match.team_b_xg_prematch !== undefined) {
    previewMessage += `⚡ Beklenen Gol (xG):\n`;
    previewMessage += `${match.home_name}: ${match.team_a_xg_prematch.toFixed(2)} | ${match.away_name}: ${match.team_b_xg_prematch.toFixed(2)}\n`;
    previewMessage += `Toplam: ${(match.team_a_xg_prematch + match.team_b_xg_prematch).toFixed(2)}\n\n`;
  }

  // Trends section (always show 3 bullets per team)
  const totalXg = (match.team_a_xg_prematch || 0) + (match.team_b_xg_prematch || 0);

  previewMessage += `🧠 Trendler (Ev):\n`;
  if (totalXg >= 2.5) {
    previewMessage += `• Yüksek gol beklentisi (xG: ${totalXg.toFixed(1)})\n`;
  } else {
    previewMessage += `• Orta gol beklentisi (xG: ${totalXg.toFixed(1)})\n`;
  }
  previewMessage += `• Ev sahibi avantajı mevcut\n`;
  previewMessage += `• Orta seviyede hücum performansı\n`;
  previewMessage += `\n`;

  previewMessage += `🧠 Trendler (Dep):\n`;
  if ((match.team_b_xg_prematch || 0) >= 1.5) {
    previewMessage += `• Deplasmanda ofansif (xG: ${(match.team_b_xg_prematch || 0).toFixed(1)})\n`;
  } else {
    previewMessage += `• Deplasmanda pasif ofans (xG: ${(match.team_b_xg_prematch || 0).toFixed(1)})\n`;
  }
  previewMessage += `• Orta seviye deplasman formu\n`;
  previewMessage += `• Kontra atak potansiyeli var\n`;
  previewMessage += `\n`;

  if (picks.length > 0) {
    previewMessage += `🎯 Tahmini Piyasalar:\n`;
    picks.forEach(pick => {
      const pickDef = AVAILABLE_PICKS.find(p => p.market_type === pick.market_type);
      if (pickDef) {
        const oddsStr = pick.odds ? ` @${pick.odds.toFixed(2)}` : '';
        previewMessage += `• ${pickDef.label}${oddsStr}\n`;
      }
    });
    previewMessage += `\n`;
  }

  if (match.odds_ft_1 && match.odds_ft_x && match.odds_ft_2) {
    previewMessage += `💰 Oranlar: ${match.odds_ft_1.toFixed(2)} | ${match.odds_ft_x.toFixed(2)} | ${match.odds_ft_2.toFixed(2)}`;
  }

  return (
    <div style={{
      padding: '24px',
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
        Mesaj Önizleme
      </h3>

      {/* Message Preview */}
      <div style={{
        padding: '16px',
        background: '#f9fafb',
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '13px',
        lineHeight: '1.6',
        fontFamily: 'monospace',
        color: '#374151',
        whiteSpace: 'pre-wrap',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {previewMessage}
      </div>

      {/* Pick Selection */}
      <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
        Tahmin Seçimi
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {AVAILABLE_PICKS.map(pickDef => {
          const isSelected = picks.some(p => p.market_type === pickDef.market_type);
          return (
            <label
              key={pickDef.market_type}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: isSelected ? '#eff6ff' : 'white',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onPickToggle(pickDef.market_type)}
                style={{ marginRight: '12px' }}
              />
              <span style={{ fontSize: '14px', color: '#1f2937' }}>
                {pickDef.emoji} {pickDef.label}
              </span>
            </label>
          );
        })}
      </div>

      {/* Publish Button */}
      <button
        onClick={onPublish}
        disabled={picks.length === 0 || publishing}
        style={{
          width: '100%',
          padding: '14px',
          background: picks.length === 0 || publishing ? '#d1d5db' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: picks.length === 0 || publishing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {publishing ? 'Yayınlanıyor...' : `Telegram'da Yayınla (${picks.length} tahmin)`}
      </button>

      {picks.length === 0 && (
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', textAlign: 'center' }}>
          En az bir tahmin seçmelisiniz
        </p>
      )}
    </div>
  );
}
