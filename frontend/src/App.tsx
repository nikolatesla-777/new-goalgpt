import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlayerCardPage } from './components/player/PlayerCardPage';

// New Modular Competition Detail Components
import { CompetitionDetailLayout } from './components/competition-detail/CompetitionDetailLayout';
import {
  OverviewTab as CompOverviewTab,
  FixturesTab as CompFixturesTab,
  StandingsTab as CompStandingsTab,
} from './components/competition-detail/tabs';

// Admin Panel Components
import {
  AdminLayout,
  AdminKomutaMerkezi,
  AdminPredictions,
  AdminLogs,
  AdminBots,
  AdminBotDetail,
  AdminManualPredictions
} from './components/admin';
import { AIPredictionsPage } from './components/ai/AIPredictionsPage';
import { AIPredictionsProvider } from './context/AIPredictionsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { PredictionToast } from './components/ui/PredictionToast';

// New Livescore Components with Nested Routes
import {
  LivescoreLayout,
  DiaryTab,
  LiveTab,
  FinishedTab,
  NotStartedTab,
  AIMatchesTab,
  FavoritesTab,
} from './components/livescore';

// New Simplified Match Detail Page (single component, no nested routes)
import { MatchDetailPage } from './pages/MatchDetailPage';

// New Modular Team Detail Components
import { TeamDetailLayout } from './components/team-detail/TeamDetailLayout';
import {
  OverviewTab,
  FixturesTab,
  StandingsTab as TeamStandingsTab,
  StageTab,
  PlayersTab,
} from './components/team-detail/tabs';

function App() {
  return (
    <FavoritesProvider>
      <AIPredictionsProvider>
        <BrowserRouter>
          <Routes>
            {/* All routes now use AdminLayout with sidebar */}
            <Route element={<AdminLayout />}>
              {/* Komuta Merkezi (Dashboard) is now the homepage */}
              <Route path="/" element={<AdminKomutaMerkezi />} />

              {/* Livescore with Nested Routes for Tabs */}
              <Route path="/livescore" element={<LivescoreLayout />}>
                {/* Default redirect to diary tab */}
                <Route index element={<Navigate to="diary" replace />} />
                {/* Tab routes */}
                <Route path="diary" element={<DiaryTab />} />
                <Route path="live" element={<LiveTab />} />
                <Route path="finished" element={<FinishedTab />} />
                <Route path="not-started" element={<NotStartedTab />} />
                <Route path="favorites" element={<FavoritesTab />} />
                <Route path="ai" element={<AIMatchesTab />} />
              </Route>

            {/* New Premium AI Page */}
            <Route path="/ai-predictions" element={<AIPredictionsPage />} />

            {/* Admin Panel Routes */}
            <Route path="/admin/predictions" element={<AdminPredictions />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/bots" element={<AdminBots />} />
            <Route path="/admin/bots/:botName" element={<AdminBotDetail />} />
            <Route path="/admin/manual-predictions" element={<AdminManualPredictions />} />

            {/* Match Detail - Single route with query param tabs */}
            <Route
              path="/match/:matchId"
              element={
                <ErrorBoundary>
                  <MatchDetailPage />
                </ErrorBoundary>
              }
            />

            {/* Redirects for old bookmarked URLs (backwards compatibility) */}
            <Route path="/match/:matchId/stats" element={<Navigate to="../?tab=stats" replace />} />
            <Route path="/match/:matchId/events" element={<Navigate to="../?tab=events" replace />} />
            <Route path="/match/:matchId/h2h" element={<Navigate to="../?tab=h2h" replace />} />
            <Route path="/match/:matchId/standings" element={<Navigate to="../?tab=standings" replace />} />
            <Route path="/match/:matchId/lineup" element={<Navigate to="../?tab=lineup" replace />} />
            <Route path="/match/:matchId/trend" element={<Navigate to="../?tab=trend" replace />} />
            <Route path="/match/:matchId/ai" element={<Navigate to="../?tab=ai" replace />} />

            {/* Team Detail with Nested Routes for Tabs */}
            <Route path="/team/:teamId" element={
              <ErrorBoundary>
                <TeamDetailLayout />
              </ErrorBoundary>
            }>
              {/* Default redirect to overview tab */}
              <Route index element={<Navigate to="overview" replace />} />
              {/* Tab routes */}
              <Route path="overview" element={<OverviewTab />} />
              <Route path="fixtures" element={<FixturesTab />} />
              <Route path="standings" element={<TeamStandingsTab />} />
              <Route path="stage" element={<StageTab />} />
              <Route path="players" element={<PlayersTab />} />
            </Route>

            <Route path="/player/:playerId" element={
              <ErrorBoundary>
                <PlayerCardPage />
              </ErrorBoundary>
            } />

            {/* Competition Detail with Nested Routes for Tabs */}
            <Route path="/competition/:id" element={
              <ErrorBoundary>
                <CompetitionDetailLayout />
              </ErrorBoundary>
            }>
              {/* Default redirect to overview tab */}
              <Route index element={<Navigate to="overview" replace />} />
              {/* Tab routes */}
              <Route path="overview" element={<CompOverviewTab />} />
              <Route path="fixtures" element={<CompFixturesTab />} />
              <Route path="standings" element={<CompStandingsTab />} />
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
