/**
 * Competition Detail Layout
 *
 * Main layout component for competition detail page with header, tabs, and content outlet.
 */

import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { CompetitionDetailProvider, useCompetitionDetail } from './CompetitionDetailContext';

function CompetitionDetailLayoutInner() {
  const navigate = useNavigate();
  const { competitionId, league, standings, loading, error } = useCompetitionDetail();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-2xl mb-2">Yukleniyor...</div>
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">
        <div className="text-center">
          <div className="text-2xl mb-2">{error || 'Lig bulunamadi'}</div>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Geri Don
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', path: 'overview', label: 'Genel Bakis' },
    { id: 'fixtures', path: 'fixtures', label: 'Fikstur' },
    { id: 'standings', path: 'standings', label: 'Puan Durumu' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="max-w-4xl mx-auto relative z-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            Geri
          </button>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center p-4 backdrop-blur-sm border border-white/10 shadow-xl">
              {league.logo_url ? (
                <img src={league.logo_url} alt={league.name} className="w-full h-full object-contain drop-shadow-md" />
              ) : (
                <span className="text-4xl">T</span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1 font-medium tracking-wide uppercase">
                {league.country_name || 'Uluslararasi'}
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{league.name}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                  <span className="text-emerald-400">*</span> Aktif Sezon
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                  {standings.length > 0 ? `${standings.length} Takim` : 'Takimlar yukleniyor'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto flex overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/competition/${competitionId}/${tab.path}`}
              className={({ isActive }) => `
                flex-1 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all relative text-center
                ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              {({ isActive }) => (
                <>
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}

export function CompetitionDetailLayout() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Competition ID gerekli</div>;
  }

  return (
    <CompetitionDetailProvider competitionId={id}>
      <CompetitionDetailLayoutInner />
    </CompetitionDetailProvider>
  );
}

export default CompetitionDetailLayout;
