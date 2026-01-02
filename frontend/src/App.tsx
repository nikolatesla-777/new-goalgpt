import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MatchDetailPage } from './components/match-detail/MatchDetailPage';
import { TeamCardPage } from './components/team/TeamCardPage';
import { PlayerCardPage } from './components/player/PlayerCardPage';
import { CompetitionDetailPage } from './components/competition/CompetitionDetailPage';

// Admin Panel Components
import {
  AdminLayout,
  AdminKomutaMerkezi,
  AdminPredictions,
  AdminLogs,
  AdminBots,
  AdminLivescore
} from './components/admin';
import { AIPredictionsProvider } from './context/AIPredictionsContext';

function App() {
  return (
    <AIPredictionsProvider>
      <BrowserRouter>
        <Routes>
          {/* All routes now use AdminLayout with sidebar */}
          <Route element={<AdminLayout />}>
            {/* Komuta Merkezi (Dashboard) is now the homepage */}
            <Route path="/" element={<AdminKomutaMerkezi />} />

            {/* Livescore moved to /livescore */}
            <Route path="/livescore" element={<AdminLivescore />} />

            {/* Admin Panel Routes */}
            <Route path="/admin/predictions" element={<AdminPredictions />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/bots" element={<AdminBots />} />

            {/* New Integrated Detail Pages */}
            <Route path="/match/:matchId" element={
              <ErrorBoundary>
                <MatchDetailPage />
              </ErrorBoundary>
            } />

            <Route path="/team/:teamId" element={
              <ErrorBoundary>
                <TeamCardPage />
              </ErrorBoundary>
            } />

            <Route path="/player/:playerId" element={
              <ErrorBoundary>
                <PlayerCardPage />
              </ErrorBoundary>
            } />

            <Route path="/competition/:id" element={
              <ErrorBoundary>
                <CompetitionDetailPage />
              </ErrorBoundary>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AIPredictionsProvider>
  );
}

export default App;
