import { useState } from 'react';
import { MatchList } from './components/MatchList';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const [view, setView] = useState<'recent' | 'diary' | 'live'>('diary');
  // Default to today's date
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);


  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <header style={{ backgroundColor: 'white', padding: '1rem', borderBottom: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            GoalGPT - Canlı Maç Takibi
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', margin: 0 }}>
            TheSports API - Anlık Güncellemeler
        </p>
      </div>
      </header>

      <nav style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => setView('recent')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  backgroundColor: view === 'recent' ? '#3b82f6' : '#f3f4f6',
                  color: view === 'recent' ? 'white' : '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Son Maçlar
              </button>
              <button
                onClick={() => setView('diary')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  backgroundColor: view === 'diary' ? '#3b82f6' : '#f3f4f6',
                  color: view === 'diary' ? 'white' : '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Günün Maçları
              </button>
              <button
                onClick={() => setView('live')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  backgroundColor: view === 'live' ? '#3b82f6' : '#f3f4f6',
                  color: view === 'live' ? 'white' : '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Canlı Maçlar
              </button>
              {view === 'diary' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    marginLeft: '1rem',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <ErrorBoundary>
          <MatchList view={view} date={view === 'diary' ? selectedDate : undefined} />
        </ErrorBoundary>
      </main>

      <footer style={{ backgroundColor: 'white', borderTop: '1px solid #e5e7eb', marginTop: '3rem', padding: '1rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          <p>Veriler TheSports API'den alınmaktadır. Her 30 saniyede bir otomatik güncellenir.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
