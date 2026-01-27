import { useEffect, useState } from 'react';
import { getRefereeAnalysis } from '../../api/telegram';
import { Flag, Warning, CheckCircle } from '@phosphor-icons/react';

interface RefereeData {
  id: number;
  name: string;
  nationality: string;
  cards_per_match: number;
  penalties_given_per_match: number;
  btts_percentage: number;
  goals_per_match: number;
  matches_officiated: number;
  is_stern: boolean;
  is_lenient: boolean;
}

interface RefereeAnalysisCardProps {
  matchId: string;
}

export default function RefereeAnalysisCard({ matchId }: RefereeAnalysisCardProps) {
  const [referee, setReferee] = useState<RefereeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReferee();
  }, [matchId]);

  async function loadReferee() {
    try {
      setLoading(true);
      setError(null);
      const data = await getRefereeAnalysis(matchId);
      setReferee(data.referee);
    } catch (err: any) {
      console.error('Failed to load referee:', err);
      setError(err.message || 'Failed to load referee data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  if (error || !referee) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <div className="text-gray-400 mb-2">
          {error || 'Hakem bilgisi mevcut değil'}
        </div>
        <button
          onClick={loadReferee}
          className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Flag className="w-6 h-6 text-purple-400" weight="fill" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{referee.name}</h3>
          <p className="text-sm text-gray-400">{referee.nationality}</p>
        </div>
        {referee.is_stern && (
          <div className="ml-auto">
            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full flex items-center gap-1">
              <Warning className="w-3 h-3" weight="fill" />
              Sert Hakem
            </span>
          </div>
        )}
        {referee.is_lenient && (
          <div className="ml-auto">
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" weight="fill" />
              Yumuşak Hakem
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Kart/Maç"
          value={referee.cards_per_match.toFixed(1)}
          color={referee.is_stern ? 'red' : referee.is_lenient ? 'green' : 'yellow'}
        />
        <StatCard
          label="Penaltı/Maç"
          value={referee.penalties_given_per_match.toFixed(2)}
          color="purple"
        />
        <StatCard
          label="Gol/Maç"
          value={referee.goals_per_match.toFixed(1)}
          color="blue"
        />
        <StatCard
          label="BTTS %"
          value={`${referee.btts_percentage}%`}
          color="cyan"
        />
      </div>

      {/* Betting Insights */}
      <div className="bg-gray-700/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Bahis İçgörüleri</h4>
        <div className="space-y-2 text-sm text-gray-400">
          {referee.is_stern && (
            <div className="flex items-start gap-2">
              <Warning className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" weight="fill" />
              <p>Bu hakem ortalamadan daha fazla kart gösteriyor. Kart bahisleri için yüksek potansiyel.</p>
            </div>
          )}
          {referee.is_lenient && (
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" weight="fill" />
              <p>Bu hakem ortalamadan daha az kart gösteriyor. Düşük kart sayısı beklenebilir.</p>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="text-purple-400">⚽</span>
            <p>Maçlarda ortalama <strong>{referee.goals_per_match.toFixed(1)}</strong> gol atılıyor.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-cyan-400">🎯</span>
            <p>Maçların <strong>%{referee.btts_percentage}</strong>'inde karşılıklı gol oluyor.</p>
          </div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        {referee.matches_officiated} maç yönetti
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-3 text-center border`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
