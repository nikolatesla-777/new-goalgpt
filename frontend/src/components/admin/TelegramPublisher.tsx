/**
 * Telegram Publisher Page
 *
 * Admin page for publishing match predictions to Telegram channel
 */

import { useState, useEffect } from 'react';
import { getTodaysMatches, publishToTelegram, getTelegramHealth } from '../../api/telegram';
import { TelegramMatchCard } from './TelegramMatchCard';
import { TelegramPreview } from './TelegramPreview';
import './admin.css';

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
  external_id?: string;
}

export function TelegramPublisher() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPicks, setSelectedPicks] = useState<Array<{ market_type: string; odds?: number }>>([]);
  const [botHealth, setBotHealth] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Load matches on mount
  useEffect(() => {
    loadMatches();
    loadBotHealth();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTodaysMatches();
      setMatches(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const loadBotHealth = async () => {
    try {
      const health = await getTelegramHealth();
      setBotHealth(health);
    } catch (err) {
      console.error('Failed to load bot health:', err);
    }
  };

  const handleMatchSelect = (match: Match) => {
    setSelectedMatch(match);
    setSelectedPicks([]);
    setPublishSuccess(false);
  };

  const handlePickToggle = (marketType: string, odds?: number) => {
    const exists = selectedPicks.find(p => p.market_type === marketType);
    if (exists) {
      setSelectedPicks(selectedPicks.filter(p => p.market_type !== marketType));
    } else {
      setSelectedPicks([...selectedPicks, { market_type: marketType, odds }]);
    }
  };

  const handlePublish = async () => {
    if (!selectedMatch || !selectedMatch.external_id) {
      alert('Match must have external_id (TheSports match ID)');
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      await publishToTelegram(selectedMatch.id, selectedMatch.external_id, selectedPicks);
      setPublishSuccess(true);

      // ✅ Allow republishing same match: Don't clear selection, just show success
      setTimeout(() => {
        setPublishSuccess(false);
        // DON'T clear selectedMatch - let user republish if they want
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to publish to Telegram');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1 className="admin-header-title">Telegram Yayın Sistemi</h1>
          <p className="admin-header-subtitle">
            FootyStats Maçlarını Telegram'da Yayınla
            {botHealth && (
              <span style={{ marginLeft: '12px', color: botHealth.configured ? '#10b981' : '#ef4444' }}>
                • Bot {botHealth.configured ? 'Aktif' : 'Pasif'}
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="admin-content">
        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '20px',
            background: '#fee2e2',
            color: '#dc2626',
            borderRadius: '8px',
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        {publishSuccess && (
          <div style={{
            padding: '16px',
            marginBottom: '20px',
            background: '#d1fae5',
            color: '#059669',
            borderRadius: '8px',
            border: '1px solid #a7f3d0'
          }}>
            ✅ Başarıyla Telegram'da yayınlandı!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
          {/* Left: Match List */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
              Bugünün Maçları ({matches.length})
            </h2>

            {loading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Maçlar yükleniyor...
              </div>
            )}

            {!loading && matches.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Bugün için maç bulunamadı
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matches.map(match => (
                <TelegramMatchCard
                  key={match.id}
                  match={match}
                  isSelected={selectedMatch?.id === match.id}
                  onSelect={() => handleMatchSelect(match)}
                />
              ))}
            </div>
          </div>

          {/* Right: Preview & Publish */}
          <div style={{ position: 'sticky', top: '20px', alignSelf: 'start' }}>
            <TelegramPreview
              match={selectedMatch}
              picks={selectedPicks}
              onPickToggle={handlePickToggle}
              onPublish={handlePublish}
              publishing={publishing}
            />
          </div>
        </div>
      </div>
    </>
  );
}
