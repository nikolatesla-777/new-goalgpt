import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIPredictionsProvider } from './context/AIPredictionsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { PredictionToast } from './components/ui/PredictionToast';

// Helper component for match tab redirects (absolute navigation)
function MatchTabRedirect({ tab }: { tab: string }) {
  const { matchId } = useParams<{ matchId: string }>();
  return <Navigate to={`/match/${matchId}?tab=${tab}`} replace />;
}

// EAGER LOAD: Main layout (needed immediately)
import { AdminLayout } from './components/admin';

// LAZY LOAD: Heavy components (load on demand)
const AdminKomutaMerkezi = lazy(() => import('./components/admin').then(m => ({ default: m.AdminKomutaMerkezi })));
const AdminPredictions = lazy(() => import('./components/admin').then(m => ({ default: m.AdminPredictions })));
const AdminLogs = lazy(() => import('./components/admin').then(m => ({ default: m.AdminLogs })));
const AdminBots = lazy(() => import('./components/admin').then(m => ({ default: m.AdminBots })));
const AdminBotDetail = lazy(() => import('./components/admin').then(m => ({ default: m.AdminBotDetail })));
const AdminManualPredictions = lazy(() => import('./components/admin').then(m => ({ default: m.AdminManualPredictions })));
const AIPredictionsPage = lazy(() => import('./components/ai/AIPredictionsPage').then(m => ({ default: m.AIPredictionsPage })));
const AIAnalysisLab = lazy(() => import('./components/ai-lab').then(m => ({ default: m.AIAnalysisLab })));

// Match Detail (heavy page with charts)
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage').then(m => ({ default: m.MatchDetailPage })));

// Team Detail
const TeamDetailLayout = lazy(() => import('./components/team-detail/TeamDetailLayout').then(m => ({ default: m.TeamDetailLayout })));
const OverviewTab = lazy(() => import('./components/team-detail/tabs').then(m => ({ default: m.OverviewTab })));
const FixturesTab = lazy(() => import('./components/team-detail/tabs').then(m => ({ default: m.FixturesTab })));
const TeamStandingsTab = lazy(() => import('./components/team-detail/tabs').then(m => ({ default: m.StandingsTab })));
const StageTab = lazy(() => import('./components/team-detail/tabs').then(m => ({ default: m.StageTab })));
const PlayersTab = lazy(() => import('./components/team-detail/tabs').then(m => ({ default: m.PlayersTab })));

// Competition Detail
const CompetitionDetailLayout = lazy(() => import('./components/competition-detail/CompetitionDetailLayout').then(m => ({ default: m.CompetitionDetailLayout })));
const CompOverviewTab = lazy(() => import('./components/competition-detail/tabs').then(m => ({ default: m.OverviewTab })));
const CompFixturesTab = lazy(() => import('./components/competition-detail/tabs').then(m => ({ default: m.FixturesTab })));
const CompStandingsTab = lazy(() => import('./components/competition-detail/tabs').then(m => ({ default: m.StandingsTab })));

// Player Card
const PlayerCardPage = lazy(() => import('./components/player/PlayerCardPage').then(m => ({ default: m.PlayerCardPage })));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Yükleniyor...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <FavoritesProvider>
      <AIPredictionsProvider>
        <BrowserRouter>
          <Routes>
            {/* All routes now use AdminLayout with sidebar */}
            <Route element={<AdminLayout />}>
              {/* Komuta Merkezi (Dashboard) is now the homepage */}
              <Route path="/" element={<Suspense fallback={<LoadingFallback />}><AdminKomutaMerkezi /></Suspense>} />

              {/* New Premium AI Page */}
              <Route path="/ai-predictions" element={<Suspense fallback={<LoadingFallback />}><AIPredictionsPage /></Suspense>} />

              {/* AI Analysis Lab (FootyStats Integration Testing) */}
              <Route path="/ai-lab" element={<Suspense fallback={<LoadingFallback />}><AIAnalysisLab /></Suspense>} />

              {/* Admin Panel Routes */}
              <Route path="/admin/predictions" element={<Suspense fallback={<LoadingFallback />}><AdminPredictions /></Suspense>} />
              <Route path="/admin/logs" element={<Suspense fallback={<LoadingFallback />}><AdminLogs /></Suspense>} />
              <Route path="/admin/bots" element={<Suspense fallback={<LoadingFallback />}><AdminBots /></Suspense>} />
              <Route path="/admin/bots/:botName" element={<Suspense fallback={<LoadingFallback />}><AdminBotDetail /></Suspense>} />
              <Route path="/admin/manual-predictions" element={<Suspense fallback={<LoadingFallback />}><AdminManualPredictions /></Suspense>} />

              {/* Match Detail - Single route with query param tabs */}
              <Route
                path="/match/:matchId"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<LoadingFallback />}>
                      <MatchDetailPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />

              {/* Redirects for old bookmarked URLs (backwards compatibility) */}
              {/* CRITICAL FIX: Use absolute navigation to avoid /match/ID/stats?tab=stats double path */}
              <Route path="/match/:matchId/stats" element={<MatchTabRedirect tab="stats" />} />
              <Route path="/match/:matchId/events" element={<MatchTabRedirect tab="events" />} />
              <Route path="/match/:matchId/h2h" element={<MatchTabRedirect tab="h2h" />} />
              <Route path="/match/:matchId/standings" element={<MatchTabRedirect tab="standings" />} />
              <Route path="/match/:matchId/lineup" element={<MatchTabRedirect tab="lineup" />} />
              <Route path="/match/:matchId/trend" element={<MatchTabRedirect tab="trend" />} />
              <Route path="/match/:matchId/ai" element={<MatchTabRedirect tab="ai" />} />

              {/* Team Detail with Nested Routes for Tabs */}
              <Route path="/team/:teamId" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <TeamDetailLayout />
                  </Suspense>
                </ErrorBoundary>
              }>
                {/* Default redirect to overview tab */}
                <Route index element={<Navigate to="overview" replace />} />
                {/* Tab routes */}
                <Route path="overview" element={<Suspense fallback={<LoadingFallback />}><OverviewTab /></Suspense>} />
                <Route path="fixtures" element={<Suspense fallback={<LoadingFallback />}><FixturesTab /></Suspense>} />
                <Route path="standings" element={<Suspense fallback={<LoadingFallback />}><TeamStandingsTab /></Suspense>} />
                <Route path="stage" element={<Suspense fallback={<LoadingFallback />}><StageTab /></Suspense>} />
                <Route path="players" element={<Suspense fallback={<LoadingFallback />}><PlayersTab /></Suspense>} />
              </Route>

              <Route path="/player/:playerId" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <PlayerCardPage />
                  </Suspense>
                </ErrorBoundary>
              } />

              {/* Competition Detail with Nested Routes for Tabs */}
              <Route path="/competition/:id" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <CompetitionDetailLayout />
                  </Suspense>
                </ErrorBoundary>
              }>
                {/* Default redirect to overview tab */}
                <Route index element={<Navigate to="overview" replace />} />
                {/* Tab routes */}
                <Route path="overview" element={<Suspense fallback={<LoadingFallback />}><CompOverviewTab /></Suspense>} />
                <Route path="fixtures" element={<Suspense fallback={<LoadingFallback />}><CompFixturesTab /></Suspense>} />
                <Route path="standings" element={<Suspense fallback={<LoadingFallback />}><CompStandingsTab /></Suspense>} />
              </Route>
            </Route>
          </Routes>
          {/* Real-time prediction settlement notifications */}
          <PredictionToast />
        </BrowserRouter>
      </AIPredictionsProvider>
    </FavoritesProvider>
  );
}

export default App;
