import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIPredictionsProvider } from './context/AIPredictionsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { PredictionToast } from './components/ui/PredictionToast';

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

// Livescore (NEW)
const LivescoreLayout = lazy(() => import('./components/livescore').then(m => ({ default: m.LivescoreLayout })));
const LivescoreDiaryTab = lazy(() => import('./components/livescore').then(m => ({ default: m.DiaryTab })));
const LivescoreLiveTab = lazy(() => import('./components/livescore').then(m => ({ default: m.LiveTab })));
const LivescoreFavoritesTab = lazy(() => import('./components/livescore').then(m => ({ default: m.FavoritesTab })));
const LivescoreFinishedTab = lazy(() => import('./components/livescore').then(m => ({ default: m.FinishedTab })));
const LivescoreUpcomingTab = lazy(() => import('./components/livescore').then(m => ({ default: m.UpcomingTab })));
const LivescoreAITab = lazy(() => import('./components/livescore').then(m => ({ default: m.AITab })));

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

              {/* Livescore with Nested Routes for Tabs (NEW) */}
              <Route path="/livescore" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <LivescoreLayout />
                  </Suspense>
                </ErrorBoundary>
              }>
                {/* Default redirect to diary (bulten) tab */}
                <Route index element={<Navigate to="diary" replace />} />
                {/* Tab routes */}
                <Route path="diary" element={<Suspense fallback={<LoadingFallback />}><LivescoreDiaryTab /></Suspense>} />
                <Route path="live" element={<Suspense fallback={<LoadingFallback />}><LivescoreLiveTab /></Suspense>} />
                <Route path="favorites" element={<Suspense fallback={<LoadingFallback />}><LivescoreFavoritesTab /></Suspense>} />
                <Route path="finished" element={<Suspense fallback={<LoadingFallback />}><LivescoreFinishedTab /></Suspense>} />
                <Route path="upcoming" element={<Suspense fallback={<LoadingFallback />}><LivescoreUpcomingTab /></Suspense>} />
                <Route path="ai" element={<Suspense fallback={<LoadingFallback />}><LivescoreAITab /></Suspense>} />
              </Route>

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
