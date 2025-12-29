import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Icons
const ArrowLeft = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);

const User = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const Calendar = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);

const MapPin = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);

const Ruler = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>
);

const Trophy = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);

const TrendingUp = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);

interface Player {
  id: string;
  external_id: string;
  name: string;
  short_name?: string;
  logo?: string;
  team_id?: string;
  team_name?: string;
  team_logo?: string;
  country_id?: string;
  country_name?: string;
  nationality?: string;
  position?: string;
  shirt_number?: number;
  age?: number;
  birthday?: number;
  height?: number;
  weight?: number;
  market_value?: number;
  market_value_currency?: string;
  preferred_foot?: number;
  season_stats?: SeasonStats;
}

interface SeasonStats {
  matches_played?: number;
  starts?: number;
  goals?: number;
  assists?: number;
  minutes_played?: number;
  yellow_cards?: number;
  red_cards?: number;
  shots?: number;
  shots_on_target?: number;
  passes?: number;
  passes_accuracy?: number;
  tackles?: number;
  interceptions?: number;
  duels?: number;
  duels_won?: number;
  rating_avg?: number;
  [key: string]: number | undefined;
}

interface PlayerMatch {
  id: string;
  external_id: string;
  home_team_name: string;
  away_team_name: string;
  home_team_logo?: string;
  away_team_logo?: string;
  home_score?: number;
  away_score?: number;
  match_time: string;
  competition_name?: string;
  player_stats?: {
    goals?: number;
    assists?: number;
    minutes_played?: number;
    rating?: number;
  };
}

type TabType = 'info' | 'matches' | 'stats';

export function PlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<PlayerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  useEffect(() => {
    if (playerId) {
      fetchPlayerData();
    }
  }, [playerId]);

  const fetchPlayerData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/players/${playerId}`);
      if (response.ok) {
        const data = await response.json();
        setPlayer(data.player);
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Error fetching player:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatPosition = (pos?: string) => {
    const positions: Record<string, string> = {
      'G': 'Kaleci',
      'GK': 'Kaleci',
      'D': 'Defans',
      'DF': 'Defans',
      'M': 'Orta Saha',
      'MF': 'Orta Saha',
      'F': 'Forvet',
      'FW': 'Forvet',
    };
    return positions[pos || ''] || pos || '-';
  };

  const formatFoot = (foot?: number) => {
    if (foot === 1) return 'Sol';
    if (foot === 2) return 'Sağ';
    if (foot === 3) return 'Her İki Ayak';
    return '-';
  };

  const formatMarketValue = (value?: number, currency?: string) => {
    if (!value) return '-';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M ${currency || '€'}`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K ${currency || '€'}`;
    }
    return `${value} ${currency || '€'}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Oyuncu bulunamadı</p>
          <button
            onClick={() => navigate(-1)}
            className="text-emerald-400 hover:text-emerald-300"
          >
            ← Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a1d] to-[#2d2d30] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Geri</span>
          </button>

          {/* Player Info */}
          <div className="flex items-center gap-6">
            {/* Player Photo */}
            <div className="w-24 h-24 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
              {player.logo ? (
                <img src={player.logo} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={40} className="text-gray-500" />
                </div>
              )}
            </div>

            {/* Player Details */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{player.name}</h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                {/* Team - Clickable */}
                {player.team_name && (
                  <button
                    onClick={() => player.team_id && navigate(`/team/${player.team_id}`)}
                    className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
                  >
                    {player.team_logo && (
                      <img src={player.team_logo} alt="" className="w-5 h-5" />
                    )}
                    <span>{player.team_name}</span>
                  </button>
                )}

                {/* Position */}
                {player.position && (
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                    {formatPosition(player.position)}
                  </span>
                )}

                {/* Nationality */}
                {player.nationality && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {player.nationality}
                  </span>
                )}

                {/* Age */}
                {player.age && (
                  <span>{player.age} yaş</span>
                )}
              </div>
            </div>

            {/* Stats Summary */}
            {player.season_stats?.matches_played && player.season_stats.matches_played > 0 && (
              <div className="hidden md:flex gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {player.season_stats.goals || 0}
                  </div>
                  <div className="text-xs text-gray-500">Gol</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {player.season_stats.assists || 0}
                  </div>
                  <div className="text-xs text-gray-500">Asist</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {player.season_stats.matches_played || 0}
                  </div>
                  <div className="text-xs text-gray-500">Maç</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-[#111113]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'info' as TabType, label: 'Kişisel Bilgi', icon: User },
              { id: 'matches' as TabType, label: 'Geçmiş Maçlar', icon: Calendar },
              { id: 'stats' as TabType, label: 'Sezon İstatistikleri', icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon size={16} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Personal Info Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="bg-[#1a1a1d] rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User size={18} className="text-emerald-400" />
                Temel Bilgiler
              </h3>
              <div className="space-y-3">
                <InfoRow label="Tam İsim" value={player.name} />
                <InfoRow label="Kısa İsim" value={player.short_name || '-'} />
                <InfoRow label="Doğum Tarihi" value={formatDate(player.birthday || 0)} />
                <InfoRow label="Yaş" value={player.age ? `${player.age} yaş` : '-'} />
                <InfoRow label="Uyruk" value={player.nationality || '-'} />
              </div>
            </div>

            {/* Physical Info */}
            <div className="bg-[#1a1a1d] rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Ruler size={18} className="text-blue-400" />
                Fiziksel Özellikler
              </h3>
              <div className="space-y-3">
                <InfoRow label="Boy" value={player.height ? `${player.height} cm` : '-'} />
                <InfoRow label="Kilo" value={player.weight ? `${player.weight} kg` : '-'} />
                <InfoRow label="Tercih Edilen Ayak" value={formatFoot(player.preferred_foot)} />
                <InfoRow label="Pozisyon" value={formatPosition(player.position)} />
                <InfoRow label="Forma No" value={player.shirt_number?.toString() || '-'} />
              </div>
            </div>

            {/* Career Info */}
            <div className="bg-[#1a1a1d] rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-400" />
                Kariyer Bilgisi
              </h3>
              <div className="space-y-3">
                <InfoRow 
                  label="Mevcut Takım" 
                  value={player.team_name || '-'}
                  onClick={() => player.team_id && navigate(`/team/${player.team_id}`)}
                  clickable
                />
                <InfoRow 
                  label="Piyasa Değeri" 
                  value={formatMarketValue(player.market_value, player.market_value_currency)} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Past Matches Tab */}
        {activeTab === 'matches' && (
          <div className="space-y-3">
            {matches.length > 0 ? (
              matches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => navigate(`/match/${match.external_id}`)}
                  className="w-full bg-[#1a1a1d] rounded-lg p-4 hover:bg-[#222225] transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Home Team */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-sm">{match.home_team_name}</span>
                        {match.home_team_logo && (
                          <img src={match.home_team_logo} alt="" className="w-6 h-6" />
                        )}
                      </div>

                      {/* Score */}
                      <div className="bg-[#2a2a2d] px-3 py-1 rounded text-center min-w-[60px]">
                        <span className="font-bold">
                          {match.home_score ?? '-'} - {match.away_score ?? '-'}
                        </span>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-2 flex-1">
                        {match.away_team_logo && (
                          <img src={match.away_team_logo} alt="" className="w-6 h-6" />
                        )}
                        <span className="text-sm">{match.away_team_name}</span>
                      </div>
                    </div>

                    {/* Player Performance */}
                    {match.player_stats && (
                      <div className="flex gap-3 ml-4 text-xs">
                        {match.player_stats.goals !== undefined && match.player_stats.goals > 0 && (
                          <span className="text-emerald-400">⚽ {match.player_stats.goals}</span>
                        )}
                        {match.player_stats.assists !== undefined && match.player_stats.assists > 0 && (
                          <span className="text-blue-400">🅰️ {match.player_stats.assists}</span>
                        )}
                        {match.player_stats.rating !== undefined && (
                          <span className="text-yellow-400">★ {match.player_stats.rating.toFixed(1)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Match Info */}
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{match.competition_name}</span>
                    <span>{new Date(match.match_time).toLocaleDateString('tr-TR')}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>Geçmiş maç verisi bulunamadı</p>
              </div>
            )}
          </div>
        )}

        {/* Season Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {player.season_stats && player.season_stats.matches_played && player.season_stats.matches_played > 0 ? (
              <>
                {/* Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Maç" value={player.season_stats.matches_played || 0} color="yellow" />
                  <StatCard label="Gol" value={player.season_stats.goals || 0} color="emerald" />
                  <StatCard label="Asist" value={player.season_stats.assists || 0} color="blue" />
                  <StatCard 
                    label="Rating" 
                    value={player.season_stats.rating_avg?.toFixed(2) || '-'} 
                    color="purple" 
                  />
                </div>

                {/* Detailed Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Attacking */}
                  <div className="bg-[#1a1a1d] rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-emerald-400">Hücum</h3>
                    <div className="space-y-2">
                      <StatRow label="Gol" value={player.season_stats.goals || 0} />
                      <StatRow label="Asist" value={player.season_stats.assists || 0} />
                      <StatRow label="Şut" value={player.season_stats.shots || 0} />
                      <StatRow label="İsabetli Şut" value={player.season_stats.shots_on_target || 0} />
                    </div>
                  </div>

                  {/* Passing */}
                  <div className="bg-[#1a1a1d] rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-blue-400">Pas</h3>
                    <div className="space-y-2">
                      <StatRow label="Toplam Pas" value={player.season_stats.passes || 0} />
                      <StatRow label="İsabetli Pas" value={player.season_stats.passes_accuracy || 0} />
                      <StatRow label="Kilit Pas" value={player.season_stats.key_passes || 0} />
                    </div>
                  </div>

                  {/* Defensive */}
                  <div className="bg-[#1a1a1d] rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-orange-400">Defans</h3>
                    <div className="space-y-2">
                      <StatRow label="Top Kapma" value={player.season_stats.tackles || 0} />
                      <StatRow label="Kesme" value={player.season_stats.interceptions || 0} />
                      <StatRow label="İkili Mücadele" value={player.season_stats.duels || 0} />
                      <StatRow label="Kazanılan" value={player.season_stats.duels_won || 0} />
                    </div>
                  </div>

                  {/* Discipline */}
                  <div className="bg-[#1a1a1d] rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-red-400">Disiplin</h3>
                    <div className="space-y-2">
                      <StatRow label="Sarı Kart" value={player.season_stats.yellow_cards || 0} />
                      <StatRow label="Kırmızı Kart" value={player.season_stats.red_cards || 0} />
                      <StatRow label="Faul" value={player.season_stats.fouls || 0} />
                      <StatRow label="Oynanan Dakika" value={player.season_stats.minutes_played || 0} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
                <p>Sezon istatistiği bulunamadı</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function InfoRow({ 
  label, 
  value, 
  onClick, 
  clickable 
}: { 
  label: string; 
  value: string; 
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      {clickable && onClick ? (
        <button 
          onClick={onClick}
          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
        >
          {value}
        </button>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: number | string; 
  color: 'emerald' | 'blue' | 'yellow' | 'purple' | 'orange' | 'red';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    red: 'text-red-400 bg-red-500/10',
  };

  return (
    <div className={`rounded-lg p-4 text-center ${colorClasses[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default PlayerProfilePage;

