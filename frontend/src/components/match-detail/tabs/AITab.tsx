/**
 * AI Tab
 *
 * Shows AI predictions for the match
 */

import { useState, useEffect } from 'react';
import { useMatchDetail } from '../MatchDetailContext';

interface Prediction {
  id: string;
  bot_name: string;
  prediction_type: string;
  predicted_outcome: string;
  confidence: number;
  odds: number;
  result: 'pending' | 'win' | 'lose' | 'void';
  reasoning?: string;
  created_at: string;
}

export function AITab() {
  const { matchId, match: _match } = useMatchDetail();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/predictions/match/${matchId}`);
        if (!response.ok) throw new Error('Tahminler yuklenemedi');
        const data = await response.json();
        setPredictions(data.predictions || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [matchId]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        AI tahminleri yukleniyor...
      </div>
    );
  }

  if (error || predictions.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          {error || 'AI Tahmini Bulunamadi'}
        </div>
        <div style={{ fontSize: '14px' }}>
          Bu mac icin henuz AI tahmini yapilmamis.
        </div>
      </div>
    );
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return { bg: '#dcfce7', text: '#16a34a', label: 'Kazandi' };
      case 'lose': return { bg: '#fee2e2', text: '#dc2626', label: 'Kaybetti' };
      case 'void': return { bg: '#f3f4f6', text: '#6b7280', label: 'Iptal' };
      default: return { bg: '#fef3c7', text: '#d97706', label: 'Bekliyor' };
    }
  };

  const getPredictionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'match_result': 'Mac Sonucu',
      'over_under': 'Alt/Ust',
      'both_teams_score': 'KG Var/Yok',
      'correct_score': 'Skor Tahmini',
      'first_half': 'Ilk Yari',
      'half_time_full_time': 'IY/MS',
    };
    return labels[type] || type;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {predictions.map((prediction) => {
        const resultStyle = getResultColor(prediction.result);

        return (
          <div
            key={prediction.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #e5e7eb'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>
                  🤖
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>
                    {prediction.bot_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {getPredictionTypeLabel(prediction.prediction_type)}
                  </div>
                </div>
              </div>
              <div style={{
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: resultStyle.bg,
                color: resultStyle.text,
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {resultStyle.label}
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '16px' }}>
              {/* Prediction */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>
                  {prediction.predicted_outcome}
                </div>
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  @{prediction.odds?.toFixed(2) || '1.00'}
                </div>
              </div>

              {/* Confidence Bar */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  <span>Guven</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>
                    %{Math.round(prediction.confidence * 100)}
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${prediction.confidence * 100}%`,
                    height: '100%',
                    backgroundColor: prediction.confidence >= 0.7 ? '#22c55e' :
                      prediction.confidence >= 0.5 ? '#eab308' : '#ef4444',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Reasoning */}
              {prediction.reasoning && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#4b5563',
                  lineHeight: '1.5'
                }}>
                  {prediction.reasoning}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AITab;
