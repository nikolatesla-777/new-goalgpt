/**
 * Telegram Match Card
 *
 * Individual match card for Telegram publisher with selection and expandable details
 */

import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
}

interface MatchDetails {
  potentials: {
    btts: number | null;
    over25: number | null;
    over15: number | null;
    corners: number | null;
    cards: number | null;
  };
  xg: {
    home: number | null;
    away: number | null;
    total: number | null;
  };
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
  } | null;
  form: {
    home: {
      overall: string | null;
      home_only: string | null;
      ppg: number | null;
      btts_pct: number | null;
      over25_pct: number | null;
    } | null;
    away: {
      overall: string | null;
      away_only: string | null;
      ppg: number | null;
      btts_pct: number | null;
      over25_pct: number | null;
    } | null;
  };
  h2h: {
    total_matches: number;
    home_wins: number;
    draws: number;
    away_wins: number;
    btts_pct: number | null;
    avg_goals: number | null;
    over15_pct?: number;
    over25_pct?: number;
    over35_pct?: number;
    home_clean_sheets_pct?: number;
    away_clean_sheets_pct?: number;
  } | null;
  trends: {
    home: Array<{ sentiment: string; text: string }>;
    away: Array<{ sentiment: string; text: string }>;
  };
}

interface Props {
  match: Match;
  isSelected: boolean;
  onSelect: () => void;
}

export function TelegramMatchCard({ match, isSelected, onSelect }: Props) {
  const matchDate = new Date(match.date_unix * 1000);
  const timeStr = matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const [isExpanded, setIsExpanded] = useState(false);
  const [detailsData, setDetailsData] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection

    if (!isExpanded && !detailsData && !loading) {
      // Fetch details on first expand
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/footystats/match/${match.id}`);
        if (!response.ok) throw new Error('Failed to fetch match details');
        const data = await response.json();
        setDetailsData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    }

    setIsExpanded(!isExpanded);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'great': return '#10b981'; // green
      case 'good': return '#059669';  // dark green
      case 'neutral': return '#6b7280'; // gray
      case 'bad': return '#ef4444';   // red
      case 'terrible': return '#dc2626'; // dark red
      default: return '#6b7280';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'great':
      case 'good': return '✅';
      case 'neutral': return '➖';
      case 'bad':
      case 'terrible': return '⚠️';
      default: return '•';
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: '8px',
        background: isSelected ? '#eff6ff' : 'white',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#d1d5db';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#e5e7eb';
        }
      }}
    >
      {/* Header - Clickable for selection */}
      <div
        onClick={onSelect}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
      >
        <div style={{ flex: 1 }}>
          {/* League & Time */}
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            {match.competition_name || 'Unknown League'} • {timeStr}
          </div>

          {/* Teams */}
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
            {match.home_name} vs {match.away_name}
          </div>

          {/* Stats Summary */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#4b5563' }}>
            {match.btts_potential && (
              <span>BTTS: %{match.btts_potential}</span>
            )}
            {match.o25_potential && (
              <span>O2.5: %{match.o25_potential}</span>
            )}
            {match.o15_potential && (
              <span>O1.5: %{match.o15_potential}</span>
            )}
            {match.team_a_xg_prematch !== undefined && match.team_b_xg_prematch !== undefined && (
              <span>
                xG: {match.team_a_xg_prematch.toFixed(1)} - {match.team_b_xg_prematch.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Selection Indicator */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `2px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
            background: isSelected ? '#3b82f6' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isSelected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <div
        onClick={handleToggleExpand}
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '13px',
          color: '#3b82f6',
          fontWeight: '500',
          transition: 'color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#2563eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#3b82f6';
        }}
      >
        <span>{isExpanded ? 'Detayları Gizle' : 'Detaylı Analiz Göster'}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              Detaylı analiz yükleniyor...
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px',
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: '6px',
              fontSize: '13px'
            }}>
              ❌ {error}
            </div>
          )}

          {detailsData && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Extra Potentials (Corners & Cards) */}
              {(detailsData.potentials.corners || detailsData.potentials.cards) && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                    🎲 EXTRA POTANSİYELLER
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#4b5563' }}>
                    {detailsData.potentials.corners && (
                      <span>Korner: %{detailsData.potentials.corners}</span>
                    )}
                    {detailsData.potentials.cards && (
                      <span>Kartlar: %{detailsData.potentials.cards}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Team Form */}
              {(detailsData.form.home || detailsData.form.away) && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                    🏅 TAKIM FORMU
                  </div>

                  {detailsData.form.home && (
                    <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                      <div style={{ fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                        {match.home_name} (Ev Sahibi)
                      </div>
                      <div style={{ color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {detailsData.form.home.overall && (
                          <span>Form: {detailsData.form.home.overall}</span>
                        )}
                        {detailsData.form.home.ppg && (
                          <span>PPG: {detailsData.form.home.ppg.toFixed(1)}</span>
                        )}
                        {detailsData.form.home.btts_pct && (
                          <span>BTTS: %{detailsData.form.home.btts_pct}</span>
                        )}
                        {detailsData.form.home.over25_pct && (
                          <span>O2.5: %{detailsData.form.home.over25_pct}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {detailsData.form.away && (
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                        {match.away_name} (Deplasman)
                      </div>
                      <div style={{ color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {detailsData.form.away.overall && (
                          <span>Form: {detailsData.form.away.overall}</span>
                        )}
                        {detailsData.form.away.ppg && (
                          <span>PPG: {detailsData.form.away.ppg.toFixed(1)}</span>
                        )}
                        {detailsData.form.away.btts_pct && (
                          <span>BTTS: %{detailsData.form.away.btts_pct}</span>
                        )}
                        {detailsData.form.away.over25_pct && (
                          <span>O2.5: %{detailsData.form.away.over25_pct}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Head to Head - Enhanced Version */}
              {detailsData.h2h && detailsData.h2h.total_matches > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔄</span>
                    <span>KAFA KAFAYA ANALİZİ</span>
                    <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>
                      (Son {detailsData.h2h.total_matches} Maç)
                    </span>
                  </div>

                  {/* Win/Draw/Loss Stats with Percentages */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                      <span>{match.home_name}</span>
                      <span style={{ color: '#94a3b8' }}>Beraberlik</span>
                      <span>{match.away_name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                      <div style={{
                        flex: detailsData.h2h.home_wins,
                        minWidth: detailsData.h2h.home_wins > 0 ? '30px' : '0',
                        height: '32px',
                        background: '#10b981',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: 'white'
                      }}>
                        {detailsData.h2h.home_wins > 0 && `${detailsData.h2h.home_wins}G`}
                      </div>
                      <div style={{
                        flex: detailsData.h2h.draws,
                        minWidth: detailsData.h2h.draws > 0 ? '30px' : '0',
                        height: '32px',
                        background: '#64748b',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: 'white'
                      }}>
                        {detailsData.h2h.draws > 0 && `${detailsData.h2h.draws}B`}
                      </div>
                      <div style={{
                        flex: detailsData.h2h.away_wins,
                        minWidth: detailsData.h2h.away_wins > 0 ? '30px' : '0',
                        height: '32px',
                        background: '#3b82f6',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: 'white'
                      }}>
                        {detailsData.h2h.away_wins > 0 && `${detailsData.h2h.away_wins}G`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                      <span>{Math.round((detailsData.h2h.home_wins / detailsData.h2h.total_matches) * 100)}%</span>
                      <span>{Math.round((detailsData.h2h.draws / detailsData.h2h.total_matches) * 100)}%</span>
                      <span>{Math.round((detailsData.h2h.away_wins / detailsData.h2h.total_matches) * 100)}%</span>
                    </div>
                  </div>

                  {/* Goal Statistics */}
                  <div style={{ marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                      📊 GOL İSTATİSTİKLERİ
                    </div>

                    {/* Over 1.5 */}
                    {detailsData.h2h.over15_pct !== undefined && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', fontWeight: '500' }}>Over 1.5</span>
                          <span style={{ fontWeight: '700', color: '#1e293b' }}>
                            %{detailsData.h2h.over15_pct}
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>
                              ({Math.round((detailsData.h2h.over15_pct / 100) * detailsData.h2h.total_matches)}/{detailsData.h2h.total_matches})
                            </span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${detailsData.h2h.over15_pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Over 2.5 */}
                    {detailsData.h2h.over25_pct !== undefined && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', fontWeight: '500' }}>Over 2.5</span>
                          <span style={{ fontWeight: '700', color: '#1e293b' }}>
                            %{detailsData.h2h.over25_pct}
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>
                              ({Math.round((detailsData.h2h.over25_pct / 100) * detailsData.h2h.total_matches)}/{detailsData.h2h.total_matches})
                            </span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${detailsData.h2h.over25_pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Over 3.5 */}
                    {detailsData.h2h.over35_pct !== undefined && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', fontWeight: '500' }}>Over 3.5</span>
                          <span style={{ fontWeight: '700', color: '#1e293b' }}>
                            %{detailsData.h2h.over35_pct}
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>
                              ({Math.round((detailsData.h2h.over35_pct / 100) * detailsData.h2h.total_matches)}/{detailsData.h2h.total_matches})
                            </span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${detailsData.h2h.over35_pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* BTTS */}
                    {detailsData.h2h.btts_pct !== undefined && detailsData.h2h.btts_pct !== null && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', fontWeight: '500' }}>BTTS (Karşılıklı Gol)</span>
                          <span style={{ fontWeight: '700', color: '#1e293b' }}>
                            %{detailsData.h2h.btts_pct}
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>
                              ({Math.round((detailsData.h2h.btts_pct / 100) * detailsData.h2h.total_matches)}/{detailsData.h2h.total_matches})
                            </span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${detailsData.h2h.btts_pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Average Goals */}
                    {detailsData.h2h.avg_goals && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        background: '#f1f5f9',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          Ortalama Gol
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                          {detailsData.h2h.avg_goals.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clean Sheets */}
                  {(detailsData.h2h.home_clean_sheets_pct !== undefined || detailsData.h2h.away_clean_sheets_pct !== undefined) && (
                    <div style={{ paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                        🛡️ KALE TEMİZ
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {detailsData.h2h.home_clean_sheets_pct !== undefined && (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '500' }}>
                              {match.home_name}
                            </div>
                            <div style={{
                              padding: '8px',
                              background: '#ecfdf5',
                              borderRadius: '6px',
                              textAlign: 'center',
                              border: '1px solid #a7f3d0'
                            }}>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>
                                %{detailsData.h2h.home_clean_sheets_pct}
                              </div>
                            </div>
                          </div>
                        )}
                        {detailsData.h2h.away_clean_sheets_pct !== undefined && (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '500' }}>
                              {match.away_name}
                            </div>
                            <div style={{
                              padding: '8px',
                              background: '#eff6ff',
                              borderRadius: '6px',
                              textAlign: 'center',
                              border: '1px solid #bfdbfe'
                            }}>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: '#2563eb' }}>
                                %{detailsData.h2h.away_clean_sheets_pct}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trends */}
              {(detailsData.trends.home.length > 0 || detailsData.trends.away.length > 0) && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                    📈 TREND ANALİZİ
                  </div>

                  {detailsData.trends.home.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                        {match.home_name}
                      </div>
                      {detailsData.trends.home.slice(0, 3).map((trend, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '12px',
                            color: getSentimentColor(trend.sentiment),
                            marginBottom: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>{getSentimentIcon(trend.sentiment)}</span>
                          <span>{trend.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailsData.trends.away.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                        {match.away_name}
                      </div>
                      {detailsData.trends.away.slice(0, 3).map((trend, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '12px',
                            color: getSentimentColor(trend.sentiment),
                            marginBottom: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>{getSentimentIcon(trend.sentiment)}</span>
                          <span>{trend.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Odds */}
              {detailsData.odds && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                    💰 ORANLAR
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                    {detailsData.odds.home && (
                      <span>Ev: {detailsData.odds.home.toFixed(2)}</span>
                    )}
                    {detailsData.odds.draw && (
                      <span>Beraberlik: {detailsData.odds.draw.toFixed(2)}</span>
                    )}
                    {detailsData.odds.away && (
                      <span>Deplasman: {detailsData.odds.away.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
