/**
 * Settlement Monitoring Dashboard
 * Displays settlement metrics and performance tracking for daily lists
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SettlementMetrics {
  aggregated: {
    totalLists: number;
    settledLists: number;
    partialLists: number;
    totalMatches: number;
    wonMatches: number;
    lostMatches: number;
    voidMatches: number;
    unmappedMatches: number;
    winRate: number;
    mappingRate: number;
    settlementRate: number;
  };
  history: Array<{
    date: string;
    totalLists: number;
    settledLists: number;
    wonMatches: number;
    lostMatches: number;
    voidMatches: number;
    totalMatches: number;
    unmappedMatches: number;
    winRate: number;
  }>;
  period: {
    days: number;
    start: string;
    end: string;
  };
}

async function fetchSettlementMetrics(days: number): Promise<SettlementMetrics> {
  const response = await fetch(`/api/admin/settlement/metrics?days=${days}`);
  if (!response.ok) {
    throw new Error('Failed to fetch settlement metrics');
  }
  return response.json();
}

function KPICard({ title, value, subtitle, color = 'blue' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    red: 'bg-red-50 border-red-200 text-red-600',
  };

  return (
    <div className={`border-2 rounded-xl p-6 ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-75 mb-2">{title}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      {subtitle && <div className="text-xs opacity-60">{subtitle}</div>}
    </div>
  );
}

export function SettlementMonitor() {
  const [days, setDays] = useState(7);

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['settlement-metrics', days],
    queryFn: () => fetchSettlementMetrics(days),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Error loading metrics</p>
          <p className="text-gray-600 mt-2">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const agg = metrics.aggregated;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-5xl">📊</span>
            Settlement Monitoring
          </h1>
          <p className="text-gray-600 text-lg">
            Performance tracking for daily prediction lists
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 mb-6">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                days === d
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Win Rate"
            value={`${agg.winRate}%`}
            subtitle={`${agg.wonMatches}W / ${agg.lostMatches}L`}
            color={agg.winRate >= 60 ? 'green' : agg.winRate >= 50 ? 'yellow' : 'red'}
          />
          <KPICard
            title="Mapping Rate"
            value={`${agg.mappingRate}%`}
            subtitle={`${agg.totalMatches - agg.unmappedMatches}/${agg.totalMatches} mapped`}
            color={agg.mappingRate >= 90 ? 'green' : agg.mappingRate >= 80 ? 'yellow' : 'red'}
          />
          <KPICard
            title="Settlement Rate"
            value={`${agg.settlementRate}%`}
            subtitle={`${agg.settledLists}/${agg.totalLists} settled`}
            color={agg.settlementRate >= 90 ? 'green' : 'yellow'}
          />
          <KPICard
            title="Total Lists"
            value={agg.totalLists}
            subtitle={`${agg.totalMatches} total matches`}
            color="blue"
          />
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600">
            <h2 className="text-2xl font-bold text-white">Daily History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Lists</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Settled</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Won</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Lost</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Void</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unmapped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.history.map((day) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {day.totalLists}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {day.settledLists}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600 font-medium">
                      {day.wonMatches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-medium">
                      {day.lostMatches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                      {day.voidMatches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          day.winRate >= 60
                            ? 'bg-green-100 text-green-800'
                            : day.winRate >= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {day.winRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                      {day.unmappedMatches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
