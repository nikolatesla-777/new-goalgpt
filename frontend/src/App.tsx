import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MatchDetailPage } from './components/match-detail/MatchDetailPage';
import { TeamCardPage } from './components/team/TeamCardPage';

// Admin Panel Components
import {
  AdminLayout,
  AdminKomutaMerkezi,
  AdminPredictions,
  AdminLogs,
  AdminBots,
  AdminLivescore
} from './components/admin';
import MemberDetail from './components/admin/MemberDetail';

function App() {
  return (
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

          {/* Member Detail */}
          <Route path="/admin/member/:id" element={<MemberDetail />} />
        </Route>

        {/* Match Detail Page - Outside of admin layout */}
        <Route path="/match/:matchId" element={
          <ErrorBoundary>
            <MatchDetailPage />
          </ErrorBoundary>
        } />

        {/* Team Card Page - Outside of admin layout */}
        <Route path="/team/:teamId" element={
          <ErrorBoundary>
            <TeamCardPage />
          </ErrorBoundary>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
