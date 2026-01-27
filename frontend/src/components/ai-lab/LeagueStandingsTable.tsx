import { useEffect, useState } from 'react';
import { getLeagueStandings } from '../../api/telegram';
import { Trophy } from '@phosphor-icons/react';

interface TeamStanding {
  id: string;
  name: string;
  position: number;
  points: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  form: string;
  zone: string | null;
  corrections: number;
}

interface GroupTable {
  name: string;
  table: TeamStanding[];
}

interface SpecificTable {
  round: string;
  groups: GroupTable[];
}

interface LeagueStandingsTableProps {
  seasonId: string;
  leagueName?: string;
}

export default function LeagueStandingsTable({ seasonId, leagueName }: LeagueStandingsTableProps) {
  const [leagueTable, setLeagueTable] = useState<TeamStanding[]>([]);
  const [specificTables, setSpecificTables] = useState<SpecificTable[]>([]);
  const [hasGroups, setHasGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStandings();
  }, [seasonId]);

  async function loadStandings() {
    try {
      setLoading(true);
      setError(null);
      const data = await getLeagueStandings(seasonId);
      setLeagueTable(data.league_table || []);
      setSpecificTables(data.specific_tables || []);
      setHasGroups(data.has_groups || false);
    } catch (err: any) {
      console.error('Failed to load standings:', err);
      setError(err.message || 'Failed to load standings');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || (leagueTable.length === 0 && specificTables.length === 0)) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <div className="text-gray-400 mb-2">
          {error || 'Puan durumu bulunamadı'}
        </div>
        <button
          onClick={loadStandings}
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
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-yellow-400" weight="fill" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Puan Durumu</h3>
          {leagueName && <p className="text-sm text-gray-400">{leagueName}</p>}
        </div>
      </div>

      {/* Main League Table (for standard leagues) */}
      {!hasGroups && leagueTable.length > 0 && (
        <StandingsTable table={leagueTable} />
      )}

      {/* Group Tables (for cups/tournaments) */}
      {hasGroups && specificTables.map((specificTable, idx) => (
        <div key={idx} className="mb-6 last:mb-0">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">{specificTable.round}</h4>
          {specificTable.groups.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-4 last:mb-0">
              <h5 className="text-xs font-semibold text-gray-400 mb-2 ml-2">{group.name}</h5>
              <StandingsTable table={group.table} compact />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface StandingsTableProps {
  table: TeamStanding[];
  compact?: boolean;
}

function StandingsTable({ table, compact = false }: StandingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs border-b border-gray-700">
            <th className="text-left py-2 px-2">#</th>
            <th className="text-left py-2 px-2">Takım</th>
            <th className="text-center py-2 px-2">O</th>
            <th className="text-center py-2 px-2 hidden md:table-cell">G</th>
            <th className="text-center py-2 px-2 hidden md:table-cell">B</th>
            <th className="text-center py-2 px-2 hidden md:table-cell">M</th>
            <th className="text-center py-2 px-2">A</th>
            <th className="text-center py-2 px-2">Y</th>
            <th className="text-center py-2 px-2 hidden md:table-cell">AV</th>
            <th className="text-right py-2 px-2 font-semibold">P</th>
            {!compact && <th className="text-center py-2 px-2 hidden lg:table-cell">Form</th>}
          </tr>
        </thead>
        <tbody>
          {table.map((team) => (
            <tr
              key={team.id}
              className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                getZoneBorderClass(team.zone)
              }`}
            >
              <td className="py-3 px-2 text-gray-400">{team.position}</td>
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  {team.zone && (
                    <div className={`w-1 h-8 rounded ${getZoneColor(team.zone)}`}></div>
                  )}
                  <span className="text-white font-medium">{team.name}</span>
                </div>
              </td>
              <td className="py-3 px-2 text-center text-gray-300">{team.matches_played}</td>
              <td className="py-3 px-2 text-center text-gray-300 hidden md:table-cell">{team.wins}</td>
              <td className="py-3 px-2 text-center text-gray-300 hidden md:table-cell">{team.draws}</td>
              <td className="py-3 px-2 text-center text-gray-300 hidden md:table-cell">{team.losses}</td>
              <td className="py-3 px-2 text-center text-gray-300">{team.goals_for}</td>
              <td className="py-3 px-2 text-center text-gray-300">{team.goals_against}</td>
              <td className="py-3 px-2 text-center text-gray-300 hidden md:table-cell">
                <span className={team.goal_difference >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {team.goal_difference >= 0 ? '+' : ''}{team.goal_difference}
                </span>
              </td>
              <td className="py-3 px-2 text-right font-bold text-white">{team.points}</td>
              {!compact && (
                <td className="py-3 px-2 text-center hidden lg:table-cell">
                  {team.form && <FormString form={team.form} />}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      {table.some(t => t.zone) && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {getUniqueZones(table).map(zone => (
            <div key={zone} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${getZoneColor(zone)}`}></div>
              <span className="text-gray-400">{getZoneLabel(zone)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormString({ form }: { form: string }) {
  const results = form.toLowerCase().split('').slice(-5); // Last 5 matches

  return (
    <div className="flex gap-0.5 justify-center">
      {results.map((result, idx) => (
        <div
          key={idx}
          className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold ${
            result === 'w' ? 'bg-green-500/20 text-green-400' :
            result === 'd' ? 'bg-yellow-500/20 text-yellow-400' :
            result === 'l' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-700 text-gray-500'
          }`}
        >
          {result === 'w' ? 'W' : result === 'd' ? 'D' : result === 'l' ? 'L' : '-'}
        </div>
      ))}
    </div>
  );
}

function getZoneColor(zone: string): string {
  const lowerZone = zone.toLowerCase();
  if (lowerZone.includes('champions') || lowerZone.includes('ucl')) return 'bg-blue-500';
  if (lowerZone.includes('europa') || lowerZone.includes('uel')) return 'bg-orange-500';
  if (lowerZone.includes('conference') || lowerZone.includes('uecl')) return 'bg-green-500';
  if (lowerZone.includes('promotion')) return 'bg-green-400';
  if (lowerZone.includes('playoff')) return 'bg-yellow-500';
  if (lowerZone.includes('relegation')) return 'bg-red-500';
  return 'bg-gray-500';
}

function getZoneBorderClass(zone: string | null): string {
  if (!zone) return '';
  return 'border-l-2 border-l-transparent';
}

function getZoneLabel(zone: string): string {
  const lowerZone = zone.toLowerCase();
  if (lowerZone.includes('champions') || lowerZone.includes('ucl')) return 'Şampiyonlar Ligi';
  if (lowerZone.includes('europa') || lowerZone.includes('uel')) return 'Avrupa Ligi';
  if (lowerZone.includes('conference') || lowerZone.includes('uecl')) return 'Konferans Ligi';
  if (lowerZone.includes('promotion')) return 'Yükselme';
  if (lowerZone.includes('playoff')) return 'Play-off';
  if (lowerZone.includes('relegation')) return 'Düşme';
  return zone;
}

function getUniqueZones(table: TeamStanding[]): string[] {
  const zones = new Set<string>();
  table.forEach(team => {
    if (team.zone) zones.add(team.zone);
  });
  return Array.from(zones);
}
