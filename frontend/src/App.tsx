import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MatchDetailPage } from './components/match-detail/MatchDetailPage';

// Admin Panel Components
import {
  AdminLayout,
  AdminDashboard,
  AdminPredictions,
  AdminLogs,
  AdminBots,
  AdminLivescore
} from './components/admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All routes now use AdminLayout with sidebar */}
        <Route element={<AdminLayout />}>
          {/* Livescore is now the homepage */}
          <Route path="/" element={<AdminLivescore />} />

          {/* Admin Panel Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/predictions" element={<AdminPredictions />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/bots" element={<AdminBots />} />
        </Route>

        {/* Match Detail Page - Outside of admin layout */}
        <Route path="/match/:matchId" element={
          <ErrorBoundary>
            <MatchDetailPage />
          </ErrorBoundary>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
