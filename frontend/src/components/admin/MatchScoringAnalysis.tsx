/**
 * Phase-3A.1: Single Match Scoring Analysis Component
 *
 * Admin screen for analyzing a single match scoring preview
 * Shows all 7 markets with probability, confidence, and publishability
 *
 * UPDATED (Phase-3A.1):
 * - Now uses Week-2A deterministic scoring endpoint: GET /api/matches/:id/scoring?locale=tr
 * - Displays clear error if Week-2A is not merged yet (503 status)
 * - Backward compatible with Phase-3A response format
 */

import { useState, useEffect } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

interface MatchInfo {
  home_team: string;
  away_team: string;
  league: string;
  kickoff_time: number;
}

interface DataQuality {
  has_xg: boolean;
  has_potentials: boolean;
  has_odds: boolean;
  has_trends: boolean;
}

interface DataSource {
  xg?: { home: number; away: number; total: number };
  potential?: number;
  odds?: { home: number; draw: number; away: number };
}

interface MarketPreview {
  market_id: string;
  market_name: string;
  market_name_tr: string;
  emoji: string;
  probability: number;
  confidence: number;
  pick: 'YES' | 'NO' | 'SKIP';
  can_publish: boolean;
  reason: string;
  data_source: DataSource;
}

interface ScoringPreview {
  match_id: string;
  fs_match_id: number;
  match_info: MatchInfo;
  markets: MarketPreview[];
  data_quality: DataQuality;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MatchScoringAnalysis() {
  const [fsMatchId, setFsMatchId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoringData, setScoringData] = useState<ScoringPreview | null>(null);

  const handleAnalyze = async () => {
    if (!fsMatchId.trim()) {
      setError('Please enter a FootyStats match ID');
      return;
    }

    setLoading(true);
    setError(null);
    setScoringData(null);

    try {
      // Phase-3A.1: Use Week-2A deterministic scoring endpoint
      const response = await fetch(
        `/api/matches/${fsMatchId}/scoring?locale=tr`
      );

      if (response.status === 503) {
        // Week-2A not merged yet
        const errorData = await response.json();
        throw new Error(
          '⚠️ Week-2A Scoring Pipeline Not Available\n\n' +
          'The deterministic scoring system (Week-2A) has not been merged yet. ' +
          'This admin panel requires Week-2A to function properly.\n\n' +
          'Status: ' + (errorData.week_2a_status || 'NOT_MERGED')
        );
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch scoring data');
      }

      const data = await response.json();

      // Week-2A returns data directly (no wrapper)
      // If it has a "data" property (backward compatibility), use it
      const scoringResult = data.data || data;

      setScoringData(scoringResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatKickoffTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getPickColor = (pick: string) => {
    if (pick === 'YES') return 'text-green-700 bg-green-50 border-green-300';
    if (pick === 'NO') return 'text-red-700 bg-red-50 border-red-300';
    return 'text-gray-700 bg-gray-50 border-gray-300';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-700';
    if (confidence >= 55) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📊 Tek Maç Scoring Analizi
        </h1>
        <p className="text-gray-600">
          FootyStats Match ID girerek tek maç için 7 market analizi yapın
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              FootyStats Match ID
            </label>
            <input
              type="text"
              value={fsMatchId}
              onChange={(e) => setFsMatchId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAnalyze();
              }}
              placeholder="örn: 12345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Analiz Ediliyor...' : 'Analiz Et'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-medium">⚠️ Hata: {error}</p>
        </div>
      )}

      {/* Results Display */}
      {scoringData && (
        <div className="space-y-6">
          {/* Match Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Maç Bilgisi</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ev Sahibi</p>
                <p className="font-medium text-gray-900">
                  {scoringData.match_info.home_team}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Deplasman</p>
                <p className="font-medium text-gray-900">
                  {scoringData.match_info.away_team}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Lig</p>
                <p className="font-medium text-gray-900">
                  {scoringData.match_info.league}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Başlangıç</p>
                <p className="font-medium text-gray-900">
                  {formatKickoffTime(scoringData.match_info.kickoff_time)}
                </p>
              </div>
            </div>

            {/* Data Quality Badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  scoringData.data_quality.has_xg
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {scoringData.data_quality.has_xg ? '✅' : '❌'} xG Data
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  scoringData.data_quality.has_potentials
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {scoringData.data_quality.has_potentials ? '✅' : '❌'} Potentials
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  scoringData.data_quality.has_odds
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {scoringData.data_quality.has_odds ? '✅' : '❌'} Odds
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  scoringData.data_quality.has_trends
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {scoringData.data_quality.has_trends ? '✅' : '❌'} Trends
              </span>
            </div>
          </div>

          {/* Markets Grid */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Market Analizleri ({scoringData.markets.length} Market)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scoringData.markets.map((market) => (
                <div
                  key={market.market_id}
                  className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500"
                >
                  {/* Market Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{market.emoji}</span>
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {market.market_name_tr}
                        </h3>
                        <p className="text-xs text-gray-500">{market.market_id}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-md text-xs font-bold border ${getPickColor(
                        market.pick
                      )}`}
                    >
                      {market.pick}
                    </span>
                  </div>

                  {/* Probability & Confidence */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Olasılık</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(market.probability * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Güven</p>
                      <p
                        className={`text-2xl font-bold ${getConfidenceColor(
                          market.confidence
                        )}`}
                      >
                        {market.confidence}/100
                      </p>
                    </div>
                  </div>

                  {/* Publish Status */}
                  <div className="mb-3">
                    {market.can_publish ? (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded">
                        <span className="font-bold">✅ Yayınlanabilir</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded">
                        <span className="font-bold">❌ Yayınlanamaz</span>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-gray-600 mb-3">{market.reason}</p>

                  {/* Data Source */}
                  <div className="border-t pt-3 text-xs text-gray-500 space-y-1">
                    {market.data_source.xg && (
                      <div>
                        <span className="font-medium">xG:</span> {market.data_source.xg.home.toFixed(2)} - {market.data_source.xg.away.toFixed(2)}
                        {market.data_source.xg.total > 0 && ` (Total: ${market.data_source.xg.total.toFixed(2)})`}
                      </div>
                    )}
                    {market.data_source.potential !== undefined && (
                      <div>
                        <span className="font-medium">Potential:</span> {market.data_source.potential}%
                      </div>
                    )}
                    {market.data_source.odds && (
                      <div>
                        <span className="font-medium">Odds:</span> 1:{market.data_source.odds.home.toFixed(2)} X:{market.data_source.odds.draw.toFixed(2)} 2:{market.data_source.odds.away.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Publishable Summary */}
          <div className="bg-green-50 border border-green-300 rounded-lg p-6">
            <h3 className="text-lg font-bold text-green-900 mb-2">
              📢 Yayınlanabilir Market Özeti
            </h3>
            <p className="text-green-700">
              <span className="font-bold">
                {scoringData.markets.filter((m) => m.can_publish).length}
              </span>{' '}
              / {scoringData.markets.length} market yayınlanabilir durumda
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scoringData.markets
                .filter((m) => m.can_publish)
                .map((m) => (
                  <span
                    key={m.market_id}
                    className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium"
                  >
                    {m.emoji} {m.market_name_tr}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
