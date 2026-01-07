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

// New Modular Match Detail Components
import { MatchDetailLayout } from './components/match-detail/MatchDetailLayout';
import {
  StatsTab,
  EventsTab,
  H2HTab,
  StandingsTab as MatchStandingsTab,
  LineupTab,
  TrendTab,
  AITab,
} from './components/match-detail/tabs';

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

            {/* Match Detail with Nested Routes for Tabs */}
            <Route path="/match/:matchId" element={
              <ErrorBoundary>
                <MatchDetailLayout />
              </ErrorBoundary>
            }>
              {/* Default redirect to stats tab */}
              <Route index element={<Navigate to="stats" replace />} />
              {/* Tab routes */}
              <Route path="ai" element={<AITab />} />
              <Route path="stats" element={<StatsTab />} />
              <Route path="events" element={<EventsTab />} />
              <Route path="h2h" element={<H2HTab />} />
              <Route path="standings" element={<MatchStandingsTab />} />
              <Route path="lineup" element={<LineupTab />} />
              <Route path="trend" element={<TrendTab />} />
            </Route>

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
