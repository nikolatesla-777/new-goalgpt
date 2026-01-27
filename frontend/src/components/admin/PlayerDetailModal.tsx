import { useEffect, useState } from 'react';
import { X, ChartBar, Lightning, ShieldCheck, Target } from '@phosphor-icons/react';
import { getPlayerStats } from '../../api/telegram';

interface PlayerStats {
  id: number;
  full_name: string;
  known_as: string;
  position: string;
  nationality: string;
  age: number;
  club_team_id: number;
  appearances: number;
  minutes_played: number;
  goals: number;
  assists: number;
  goals_per_90: number;
  assists_per_90: number;
  xg_per_90: number;
  xa_per_90: number;
  shots_per_90: number;
  shot_accuracy: number;
  passes_per_90: number;
  pass_accuracy: number;
  key_passes_per_90: number;
  tackles_per_90: number;
  interceptions_per_90: number;
  yellow_cards: number;
  red_cards: number;
}

interface PlayerDetailModalProps {
  playerId: number;
  onClose: () => void;
}

export default function PlayerDetailModal({ playerId, onClose }: PlayerDetailModalProps) {
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayerStats();
  }, [playerId]);

  async function loadPlayerStats() {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlayerStats(playerId.toString());
      setPlayer(data.player);
    } catch (err: any) {
      console.error('Failed to load player stats:', err);
      setError(err.message || 'Failed to load player stats');
    } finally {
      setLoading(false);
    }
  }

  const getPositionColor = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('forward')) return 'from-red-500 to-orange-500';
    if (pos.includes('midfielder')) return 'from-blue-500 to-cyan-500';
    if (pos.includes('defender')) return 'from-green-500 to-emerald-500';
    if (pos.includes('goalkeeper')) return 'from-yellow-500 to-amber-500';
    return 'from-gray-500 to-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="p-12 text-center">
            <div className="text-white">Yükleniyor...</div>
          </div>
        )}

        {error && (
          <div className="p-12 text-center">
            <div className="text-red-400 mb-4">{error}</div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Kapat
            </button>
          </div>
        )}

        {player && (
          <div>
            {/* Header */}
            <div className={`bg-gradient-to-r ${getPositionColor(player.position)} p-6 relative`}>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" weight="bold" />
              </button>

              <div className="text-white">
                <h2 className="text-3xl font-bold mb-2">{player.known_as}</h2>
                <div className="flex items-center gap-4 text-sm opacity-90">
                  <span>{player.position}</span>
                  <span>•</span>
                  <span>{player.nationality}</span>
                  <span>•</span>
                  <span>{player.age} yaş</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatBox label="Maç" value={player.appearances} color="cyan" />
                <StatBox label="Gol" value={player.goals} color="green" />
                <StatBox label="Asist" value={player.assists} color="purple" />
                <StatBox label="Dakika" value={player.minutes_played} color="blue" />
              </div>

              {/* Per 90 Stats */}
              <Section icon={<ChartBar className="w-5 h-5" />} title="90 Dakika Ortalamaları">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatItem label="Gol/90" value={player.goals_per_90.toFixed(2)} />
                  <StatItem label="Asist/90" value={player.assists_per_90.toFixed(2)} />
                  <StatItem label="xG/90" value={player.xg_per_90.toFixed(2)} tooltip="Expected Goals per 90" />
                  <StatItem label="xA/90" value={player.xa_per_90.toFixed(2)} tooltip="Expected Assists per 90" />
                  <StatItem label="Şut/90" value={player.shots_per_90.toFixed(2)} />
                  <StatItem label="Anahtar Pas/90" value={player.key_passes_per_90.toFixed(2)} />
                </div>
              </Section>

              {/* Shooting Stats */}
              <Section icon={<Target className="w-5 h-5" />} title="Şut İstatistikleri">
                <div className="grid grid-cols-2 gap-4">
                  <StatItem label="Şut/90" value={player.shots_per_90.toFixed(2)} />
                  <StatItem label="Şut İsabet %" value={`${player.shot_accuracy.toFixed(1)}%`} />
                </div>
              </Section>

              {/* Passing Stats */}
              <Section icon={<Lightning className="w-5 h-5" />} title="Pas İstatistikleri">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatItem label="Pas/90" value={player.passes_per_90.toFixed(1)} />
                  <StatItem label="Pas İsabet %" value={`${player.pass_accuracy.toFixed(1)}%`} />
                  <StatItem label="Anahtar Pas/90" value={player.key_passes_per_90.toFixed(2)} />
                </div>
              </Section>

              {/* Defensive Stats */}
              <Section icon={<ShieldCheck className="w-5 h-5" />} title="Savunma İstatistikleri">
                <div className="grid grid-cols-2 gap-4">
                  <StatItem label="Top Çalma/90" value={player.tackles_per_90.toFixed(2)} />
                  <StatItem label="Topa Müdahale/90" value={player.interceptions_per_90.toFixed(2)} />
                </div>
              </Section>

              {/* Discipline */}
              <Section icon={<span className="text-yellow-400">⚠️</span>} title="Disiplin">
                <div className="grid grid-cols-2 gap-4">
                  <StatItem label="Sarı Kart" value={player.yellow_cards} color="yellow" />
                  <StatItem label="Kırmızı Kart" value={player.red_cards} color="red" />
                </div>
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className={`${colors[color as keyof typeof colors]} rounded-lg p-4 border text-center`}>
      <div className="text-sm opacity-75 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 text-white font-semibold mb-3">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        {children}
      </div>
    </div>
  );
}

function StatItem({ label, value, color = 'white', tooltip }: { label: string; value: string | number; color?: string; tooltip?: string }) {
  const textColor = color === 'yellow' ? 'text-yellow-400' :
                    color === 'red' ? 'text-red-400' :
                    'text-white';

  return (
    <div className="flex items-center justify-between" title={tooltip}>
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`font-semibold ${textColor}`}>{value}</span>
    </div>
  );
}
