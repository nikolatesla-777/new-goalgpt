import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRecentMatches, getMatchDiary, getLiveMatches } from '../api/matches';
import type { Match, Competition } from '../api/matches';
import { LeagueSection } from './LeagueSection';
import { isLiveMatch } from '../utils/matchStatus';

interface MatchListProps {
  view: 'recent' | 'diary' | 'live';
  date?: string;
}

export function MatchList({ view, date }: MatchListProps) {
  // ============================================
  // STEP 1: ALL HOOKS MUST BE CALLED FIRST
  // ============================================
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const isFetchingRef = useRef(false);
  const fetchRef = useRef<() => Promise<void>>(async () => {});

  // CRITICAL FIX: Ensure matches is always an array (never null/undefined)
  const safeMatches = Array.isArray(matches) ? matches : [];


  const fetchMatches = useCallback(async () => {
    // Prevent overlapping requests (important for WS + polling together)
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setError(null);
      setLoading(true);
      
      let response;
      if (view === 'recent') {
        // Progressive loading: start with 50, then load more
        response = await getRecentMatches({ limit: 50 });
      } else if (view === 'live') {
        // Use dedicated live matches endpoint
        response = await getLiveMatches();
      } else {
        // For diary view, use the /match/diary endpoint with date parameter
        const dateStr = date || new Date().toISOString().split('T')[0];
        console.log('📅 [MatchList] Fetching diary for date:', dateStr);
        response = await getMatchDiary(dateStr);
        console.log('📦 [MatchList] Diary response received:', {
          hasResults: !!response.results,
          resultsCount: response.results?.length || 0,
          hasErr: !!response.err,
        });
      }

      // Check for error in response even if API call succeeded
      if (response.err) {
        console.error('❌ [MatchList] Response has error:', response.err);
        throw new Error(response.err);
      }
      
      // CRITICAL FIX: Ensure response.results is always an array before setting state
      console.log('🔄 [MatchList] Setting matches - response type:', typeof response);
      console.log('🔄 [MatchList] Setting matches - has results:', !!response?.results);
      console.log('🔄 [MatchList] Setting matches - results is array:', Array.isArray(response?.results));
      console.log('🔄 [MatchList] Setting matches - results count:', response?.results?.length || 0);
      
      // Safety check: ensure we have a valid array
      if (response && typeof response === 'object' && 'results' in response) {
        const results = response.results;
        if (Array.isArray(results)) {
          // Filter for live matches if view is 'live'
          const filteredResults = view === 'live' 
            ? results.filter((match: Match) => {
                const status = match.status_id ?? match.status ?? 0;
                return isLiveMatch(status);
              })
            : results;
          console.log('✅ [MatchList] Setting', filteredResults.length, 'matches' + (view === 'live' ? ' (live)' : ''));
          setMatches(filteredResults);
        } else {
          console.warn('⚠️ [MatchList] results is not an array, type:', typeof results, 'value:', results);
          setMatches([]);
        }
      } else {
        console.error('❌ [MatchList] Invalid response structure:', response);
        setMatches([]);
      }
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      console.error('Error fetching matches:', err);
      const errorMessage = err?.message || 'Maçlar yüklenirken bir hata oluştu';
      setError(errorMessage);
      setMatches([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [view, date]);

  // Keep the latest fetch function available for WS callbacks (avoids stale closures)
  useEffect(() => {
    fetchRef.current = fetchMatches;
  }, [fetchMatches]);

  // Group matches by competition - MUST BE CALLED BEFORE ANY EARLY RETURNS
  const matchesByCompetition = useMemo(() => {
    // CRITICAL FIX: Ensure matches is always an array before processing
    if (!Array.isArray(safeMatches)) {
      console.error('❌ [MatchList] safeMatches is not an array:', typeof safeMatches, safeMatches);
      return [];
    }
    
    console.log('🔄 [MatchList] Grouping matches - total:', safeMatches.length);
    const grouped = new Map<string | null, { competition: Competition | null; matches: Match[] }>();
    
    safeMatches.forEach((match) => {
      // CRITICAL FIX: Validate match object before processing
      if (!match || typeof match !== 'object' || !match.id) {
        console.warn('⚠️ [MatchList] Invalid match object:', match);
        return;
      }
      
      const compId = match.competition_id || null;
      const comp = match.competition || null;
      
      if (!grouped.has(compId)) {
        grouped.set(compId, { competition: comp, matches: [] });
      }
      grouped.get(compId)!.matches.push(match);
    });
    
    // Sort competitions alphabetically by name
    const sorted = Array.from(grouped.entries()).sort((a, b) => {
      const nameA = a[1].competition?.name || 'Bilinmeyen Lig';
      const nameB = b[1].competition?.name || 'Bilinmeyen Lig';
      return nameA.localeCompare(nameB, 'tr');
    });
    
    console.log('✅ [MatchList] Grouped into', sorted.length, 'competitions');
    return sorted;
  }, [safeMatches]);

  // CRITICAL: WebSocket connection for real-time updates (with reconnect)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost =
        window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;

      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);

      ws.onopen = () => {
        console.log('✅ WebSocket connected for real-time updates');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket event received:', message);

          // If it's a goal or score change, immediately refresh matches
          if (message.type === 'GOAL' || message.type === 'SCORE_CHANGE') {
            console.log(`⚽ Goal/Score update for match ${message.matchId} - refreshing matches...`);
            fetchRef.current(); // Always call latest fetch
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, will reconnect...');
        if (reconnectTimer) window.clearTimeout(reconnectTimer);

        // Reconnect after 5 seconds
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    fetchMatches();

    // CRITICAL: Poll every 60 seconds as fallback (WebSocket is primary)
    // WebSocket handles instant updates, polling is fallback only
    const interval = setInterval(() => {
      fetchMatches();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchMatches]);

  // ============================================
  // STEP 2: DEBUG LOGS (after hooks)
  // ============================================
  console.log('🎯 [MatchList] Render - View:', view, 'Date:', date, 'Matches count:', safeMatches.length);
  console.log('🎯 [MatchList] First match sample:', safeMatches[0] ? {
    id: safeMatches[0].id,
    hasHomeTeam: !!safeMatches[0].home_team,
    hasAwayTeam: !!safeMatches[0].away_team,
    homeTeamName: safeMatches[0].home_team?.name,
  } : 'No matches');
  console.log('🎨 [MatchList] Rendering - matchesByCompetition:', matchesByCompetition.length);

  // ============================================
  // STEP 3: GUARD CLAUSES (early returns AFTER all hooks)
  // ============================================
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <span style={{ marginLeft: '12px', color: '#4b5563' }}>Maçlar yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    const isIPError = error.includes('IP is not authorized') || error.includes('IP is not authorized');
    const isRateLimitError = error.includes('Too Many Requests') || error.includes('too many requests') || error.includes('Çok fazla istek');
    
    return (
      <div style={{
        border: `1px solid ${isIPError ? '#fbbf24' : isRateLimitError ? '#f59e0b' : '#ef4444'}`,
        borderRadius: '8px',
        padding: '1.5rem',
        backgroundColor: isIPError ? '#fef3c7' : isRateLimitError ? '#fef3c7' : '#fee2e2',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flexShrink: 0, fontSize: '24px' }}>
            {isIPError ? '⚠️' : isRateLimitError ? '⏱️' : '❌'}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '4px',
              color: isIPError ? '#92400e' : isRateLimitError ? '#92400e' : '#991b1b',
            }}>
              {isIPError ? 'IP Yetkilendirme Hatası' : isRateLimitError ? 'Rate Limit Aşıldı' : 'Hata'}
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: isIPError ? '#78350f' : isRateLimitError ? '#78350f' : '#7f1d1d',
              marginBottom: '12px',
            }}>
              {error}
            </p>
            {isRateLimitError && (
              <div style={{
                marginTop: '12px',
                fontSize: '0.875rem',
                color: '#78350f',
                backgroundColor: '#fde68a',
                padding: '12px',
                borderRadius: '4px',
              }}>
                <p style={{ fontWeight: '500', marginBottom: '8px' }}>Çözüm:</p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginTop: '4px' }}>
                  <li>Birkaç dakika bekleyin (genellikle 1-2 dakika yeterli)</li>
                  <li>Sayfa otomatik olarak yeniden deneyecek</li>
                  <li>Manuel olarak "Tekrar Dene" butonuna tıklayabilirsiniz</li>
                </ul>
              </div>
            )}
            {isIPError && (
              <div style={{
                marginTop: '12px',
                fontSize: '0.875rem',
                color: '#78350f',
                backgroundColor: '#fde68a',
                padding: '12px',
                borderRadius: '4px',
              }}>
                <p style={{ fontWeight: '500', marginBottom: '8px' }}>Mevcut IP Adresiniz:</p>
                <p style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#fcd34d',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'inline-block',
                }}>212.252.119.204</p>
                <p style={{ fontWeight: '500', marginBottom: '4px' }}>Çözüm:</p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginTop: '4px' }}>
                  <li>Yukarıdaki IP adresini TheSports paneline ekleyin</li>
                  <li>IP eklendikten sonra 2-3 dakika bekleyin</li>
                  <li>"Tekrar Dene" butonuna tıklayın</li>
                </ul>
              </div>
            )}
            <button
              onClick={fetchMatches}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                color: 'white',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isIPError ? '#eab308' : isRateLimitError ? '#f59e0b' : '#ef4444',
              }}
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CRITICAL FIX: Safety check before rendering
  if (!Array.isArray(safeMatches)) {
    console.error('❌ [MatchList] CRITICAL: matches is not an array!', typeof safeMatches, safeMatches);
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: '#ef4444' }}>
        <p style={{ marginBottom: '12px' }}>❌ Veri formatı hatası: Maçlar array değil</p>
        <button
          onClick={fetchMatches}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Yenile
        </button>
      </div>
    );
  }

  if (safeMatches.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{
          marginBottom: '1rem',
          padding: '12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
        }}>
          <span style={{ fontWeight: '600', color: '#1e40af', fontSize: '1rem' }}>
            TOTAL MATCHES IN DB: {safeMatches.length}
          </span>
          {!loading && (
            <span style={{ marginLeft: '12px', fontSize: '0.875rem', color: '#f59e0b' }}>
              ⚠️ No matches found. Check API response.
            </span>
          )}
        </div>
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p style={{ color: '#6b7280', marginBottom: '12px' }}>Maç bulunamadı</p>
          <button
            onClick={fetchMatches}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Yenile
          </button>
        </div>
      </div>
    );
  }

  // CRITICAL FIX: Final safety check before rendering
  if (!Array.isArray(matchesByCompetition)) {
    console.error('❌ [MatchList] matchesByCompetition is not an array!');
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: '#ef4444' }}>
        <p>❌ Render hatası: Gruplandırma başarısız</p>
        <button
          onClick={fetchMatches}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '12px',
          }}
        >
          Yenile
        </button>
      </div>
    );
  }

  // ============================================
  // STEP 4: MAIN JSX RENDER
  // ============================================

  // CRITICAL: Total Counter - Defined here after matchesByCompetition is available
  const totalCounter = (
    <div style={{
      marginBottom: '1rem',
      padding: '12px',
      backgroundColor: '#f0f9ff',
      border: '1px solid #bae6fd',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <span style={{ fontWeight: '600', color: '#1e40af', fontSize: '1rem' }}>
          TOTAL MATCHES IN DB: {safeMatches.length}
        </span>
        {safeMatches.length > 0 && (
          <span style={{ marginLeft: '12px', fontSize: '0.875rem', color: '#64748b' }}>
            ({matchesByCompetition.length} competitions)
          </span>
        )}
      </div>
      {safeMatches.length === 0 && !loading && (
        <span style={{ fontSize: '0.875rem', color: '#f59e0b' }}>
          ⚠️ No matches found. Check API response.
        </span>
      )}
    </div>
  );

  return (
    <div style={{ padding: '1rem' }}>
      {totalCounter}
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          {view === 'recent' ? 'Son Maçlar' : view === 'live' ? 'Canlı Maçlar' : 'Günün Maçları'}
        </h2>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
        </div>
      </div>

      <div>
        {matchesByCompetition.length > 0 ? (
          matchesByCompetition.map(([compId, { competition, matches: compMatches }]) => {
            // CRITICAL FIX: Validate compMatches before passing to LeagueSection
            if (!Array.isArray(compMatches)) {
              console.warn('⚠️ [MatchList] compMatches is not an array for competition:', compId);
              return null;
            }
            return (
              <LeagueSection
                key={compId || 'unknown'}
                competition={competition}
                matches={compMatches}
              />
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            <p>Maç bulunamadı (matchesByCompetition is empty)</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Matches count: {safeMatches.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
