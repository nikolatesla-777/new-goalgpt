/**
 * Match Analysis Modal
 *
 * Displays AI-generated match analysis with recommendations
 * Allows copying analysis text to clipboard
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateMatchAnalysis } from '../../api/client';
import type { MatchAnalysisResponse } from '../../api/types';

// ============================================================================
// INTERFACES
// ============================================================================

interface MatchAnalysisModalProps {
  matchId: number;
  matchName: string;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MatchAnalysisModal({ matchId, matchName, onClose }: MatchAnalysisModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate analysis mutation
  const {
    mutate: generateAnalysis,
    data: analysisData,
    isPending,
    isError,
    error,
  } = useMutation<MatchAnalysisResponse, Error>({
    mutationFn: () => generateMatchAnalysis(matchId),
  });

  // Auto-generate on mount
  useState(() => {
    generateAnalysis();
  });

  // Copy to clipboard
  const handleCopy = () => {
    if (!analysisData) return;

    navigator.clipboard.writeText(analysisData.formatted.copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get confidence emoji
  const getConfidenceEmoji = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return '🔥';
      case 'medium': return '⭐';
      case 'low': return '💡';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span className="text-3xl">🍀</span>
              Maç Analizi
            </h2>
            <p className="text-sm text-gray-600">{matchName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isPending && (
            <div className="text-center py-12">
              <div className="inline-block w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Analiz oluşturuluyor...</p>
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 text-red-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-bold text-red-800 mb-2">Analiz Oluşturulamadı</h3>
              <p className="text-red-600">{error?.message || 'Bilinmeyen hata'}</p>
            </div>
          )}

          {analysisData && (
            <div className="space-y-6">
              {/* Title Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-100">
                <div className="whitespace-pre-wrap text-gray-900 font-medium leading-relaxed">
                  {analysisData.analysis.title}
                </div>
              </div>

              {/* Full Analysis */}
              <div className="space-y-4">
                {analysisData.analysis.fullAnalysis.split('\n\n').map((section, idx) => {
                  if (!section.trim()) return null;

                  // Check if it's a header (starts with **)
                  const isHeader = section.startsWith('**');

                  if (isHeader) {
                    const headerMatch = section.match(/\*\*(.+?)\*\*/);
                    const header = headerMatch ? headerMatch[1] : '';
                    const content = section.replace(/\*\*.+?\*\*\n?/, '').trim();

                    return (
                      <div key={idx} className="bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-blue-200 transition-colors">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">{header}</h3>
                        <p className="text-gray-700 leading-relaxed">{content}</p>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                      <p className="text-gray-700 leading-relaxed">{section}</p>
                    </div>
                  );
                })}
              </div>

              {/* Recommendations */}
              {analysisData.analysis.recommendations.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    Öneriler
                  </h3>
                  <div className="space-y-4">
                    {analysisData.analysis.recommendations.map((rec, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-5 border border-green-200">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-2xl">{getConfidenceEmoji(rec.confidence)}</span>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 text-lg mb-1">
                              {rec.market} → {rec.prediction}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              Güven: <span className={`font-semibold ${
                                rec.confidence === 'high' ? 'text-green-600' :
                                rec.confidence === 'medium' ? 'text-blue-600' :
                                'text-yellow-600'
                              }`}>
                                {rec.confidence === 'high' ? 'Yüksek' : rec.confidence === 'medium' ? 'Orta' : 'Düşük'}
                              </span>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{rec.reasoning}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-bold text-yellow-800 mb-1">Risk Uyarısı</h4>
                  <p className="text-sm text-yellow-700">
                    Bu analiz istatistiksel verilere dayanmaktadır. Lütfen kendi araştırmanızı da yapın ve sorumlu bir şekilde bahis oynayın.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {analysisData && (
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
            <button
              onClick={handleCopy}
              className={`flex-1 py-3 px-6 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
                copied
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Kopyalandı!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Analizi Kopyala
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
