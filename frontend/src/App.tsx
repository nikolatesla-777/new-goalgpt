import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIPredictionsProvider } from './context/AIPredictionsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { PredictionToast } from './components/ui/PredictionToast';

// React Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// EAGER LOAD: Main layout and registry (needed immediately)
import { AdminLayout } from './components/admin';
import { ALL_MENU_ITEMS } from './config/admin.registry';

// LAZY LOAD: Special components not in registry
const AdminBotDetail = lazy(() => import('./components/admin').then(m => ({ default: m.AdminBotDetail })));

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

// Match Detail
const MatchDetailLayout = lazy(() => import('./components/match-detail/MatchDetailLayout').then(m => ({ default: m.MatchDetailLayout })));
const MatchStatsTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.StatsTab })));
const MatchEventsTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.EventsTab })));
const MatchH2HTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.H2HTab })));
const MatchStandingsTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.StandingsTab })));
const MatchLineupTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.LineupTab })));
const MatchTrendTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.TrendTab })));
const MatchAITab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.AITab })));
const MatchForumTab = lazy(() => import('./components/match-detail/tabs').then(m => ({ default: m.ForumTab })));

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
    <QueryClientProvider client={queryClient}>
      <FavoritesProvider>
        <AIPredictionsProvider>
          <BrowserRouter>
          <Routes>
            {/* All routes now use AdminLayout with sidebar */}
            <Route element={<AdminLayout />}>
              {/* Auto-generated routes from registry */}
              {ALL_MENU_ITEMS.filter(item => item.id !== 'livescore').map((item) => {
                const Component = item.component;
                return (
                  <Route
                    key={item.id}
                    path={item.routePath}
                    element={
                      <Suspense fallback={<LoadingFallback />}>
                        <Component />
                      </Suspense>
                    }
                  />
                );
              })}

              {/* Special: Dynamic bot detail route (not in registry) */}
              <Route path="/admin/bots/:botName" element={<Suspense fallback={<LoadingFallback />}><AdminBotDetail /></Suspense>} />

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

              {/* Match Detail with Nested Routes for Tabs */}
              <Route path="/match/:matchId" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <MatchDetailLayout />
                  </Suspense>
                </ErrorBoundary>
              }>
                {/* Default redirect to stats tab */}
                <Route index element={<Navigate to="stats" replace />} />
                {/* Tab routes */}
                <Route path="stats" element={<Suspense fallback={<LoadingFallback />}><MatchStatsTab /></Suspense>} />
                <Route path="events" element={<Suspense fallback={<LoadingFallback />}><MatchEventsTab /></Suspense>} />
                <Route path="h2h" element={<Suspense fallback={<LoadingFallback />}><MatchH2HTab /></Suspense>} />
                <Route path="standings" element={<Suspense fallback={<LoadingFallback />}><MatchStandingsTab /></Suspense>} />
                <Route path="lineup" element={<Suspense fallback={<LoadingFallback />}><MatchLineupTab /></Suspense>} />
                <Route path="trend" element={<Suspense fallback={<LoadingFallback />}><MatchTrendTab /></Suspense>} />
                <Route path="ai" element={<Suspense fallback={<LoadingFallback />}><MatchAITab /></Suspense>} />
                <Route path="forum" element={<Suspense fallback={<LoadingFallback />}><MatchForumTab /></Suspense>} />
              </Route>

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
    </QueryClientProvider>
  );
}

export default App;
