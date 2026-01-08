/**
 * AI Tab
 *
 * Displays AI predictions for the match.
 * Uses MatchDetailContext for data - no duplicate fetch.
 */

import { useMemo } from 'react';
import { Robot, Trophy, WarningCircle } from '@phosphor-icons/react';
import { useMatchDetail } from '../MatchDetailContext';

interface Prediction {
  id: string;
  match_id: string;
  prediction: string;
  prediction_type: string;
  prediction_value: string;
  overall_confidence: number;
  bot_name: string;
  minute_at_prediction: number;
  score_at_prediction: string;
  result: string | null;
  prediction_result: string | null;
  created_at: string;
  access_type?: 'VIP' | 'FREE';
}

export function AITab() {
  const { tabData, tabDataLoading } = useMatchDetail();

  // Use predictions from MatchDetailContext (already fetched via eager loading)
  const predictions = useMemo(() => {
    if (!tabData.ai?.predictions) return [];
    return tabData.ai.predictions.map((p: any) => ({
      id: p.id,
      match_id: p.match_id,
      prediction: p.prediction || p.prediction_value || p.prediction_type,
      prediction_type: p.prediction_type || p.prediction,
      prediction_value: p.prediction_value || p.prediction,
      overall_confidence: p.overall_confidence || p.confidence || 80,
      bot_name: p.bot_name || p.canonical_bot_name,
      minute_at_prediction: p.minute_at_prediction,
      score_at_prediction: p.score_at_prediction,
      result: p.result,
      prediction_result: p.prediction_result || (p.result === 'won' ? 'winner' : p.result === 'lost' ? 'loser' : null),
      created_at: p.created_at,
      access_type: p.access_type,
    })) as Prediction[];
  }, [tabData.ai]);

  const loading = tabDataLoading;

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-12 text-center border border-gray-200/50 shadow-lg">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
          </div>
          <div>
            <p className="text-gray-700 font-semibold text-lg mb-1">Yapay zeka analizi yükleniyor...</p>
            <p className="text-gray-500 text-sm">Tahminler hazırlanıyor</p>
          </div>
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-12 text-center border border-gray-200/50 shadow-lg">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center shadow-inner">
              <Robot size={40} weight="duotone" className="text-gray-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full border-4 border-white"></div>
          </div>
          <h3 className="text-2xl font-black text-gray-800 mb-3 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Tahmin Bulunamadı
          </h3>
          <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
            Bu maç için henüz yapay zeka tarafından oluşturulmuş güvenilir bir tahmin bulunmuyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {predictions.map((prediction) => {
          const isWinner = prediction.prediction_result === 'winner';
          const isLoser = prediction.prediction_result === 'loser';
          const isPending = !prediction.prediction_result || prediction.prediction_result === 'pending';
          const scoreAtPrediction = prediction.score_at_prediction || '0-0';

          return (
            <div
              key={prediction.id}
              className="p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150"
            >
              <div className="flex items-center justify-between gap-3 md:gap-4 flex-wrap sm:flex-nowrap">
                {/* Left Side: Bot Info */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Robot size={14} weight="fill" className="text-white sm:w-[18px] sm:h-[18px]" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 md:gap-2 flex-wrap text-xs sm:text-sm">
                      <span className="font-bold text-gray-900 truncate">
                        {prediction.bot_name || 'GoalGPT AI'}
                      </span>
                      {prediction.minute_at_prediction && (
                        <>
                          <span className="text-gray-300">-</span>
                          <span className="text-gray-600 font-medium whitespace-nowrap">
                            {prediction.minute_at_prediction}. Dakika
                          </span>
                        </>
                      )}
                      {scoreAtPrediction && (
                        <>
                          <span className="text-gray-300">-</span>
                          <span className="text-gray-500 font-medium whitespace-nowrap">Skor</span>
                          <span className="font-semibold text-gray-700 whitespace-nowrap">{scoreAtPrediction}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: Prediction Detail */}
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 order-3 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
                  <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200/50">
                    <span className="text-xs sm:text-sm font-bold text-gray-800 whitespace-nowrap">
                      {prediction.prediction || prediction.prediction_value || prediction.prediction_type}
                    </span>
                  </div>
                  {prediction.access_type && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${prediction.access_type === 'VIP' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {prediction.access_type}
                    </span>
                  )}
                </div>

                {/* Right Side: Status Badge */}
                <div className="flex-shrink-0 order-2 sm:order-3">
                  {isPending && (
                    <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] sm:text-xs font-bold text-amber-700 whitespace-nowrap">BEKLİYOR</span>
                    </div>
                  )}
                  {isWinner && (
                    <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <Trophy size={12} weight="fill" className="text-emerald-600 sm:w-[14px] sm:h-[14px]" />
                      <span className="text-[10px] sm:text-xs font-bold text-emerald-700 whitespace-nowrap">KAZANDI</span>
                    </div>
                  )}
                  {isLoser && (
                    <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-red-50 rounded-lg border border-red-200">
                      <WarningCircle size={12} weight="fill" className="text-red-600 sm:w-[14px] sm:h-[14px]" />
                      <span className="text-[10px] sm:text-xs font-bold text-red-700 whitespace-nowrap">KAYBETTİ</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AITab;
