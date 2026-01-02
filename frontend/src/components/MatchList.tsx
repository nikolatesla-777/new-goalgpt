import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMatchDiary, getLiveMatches } from '../api/matches';
import type { Match, Competition } from '../api/matches';
import { LeagueSection } from './LeagueSection';
import { isLiveMatch, isFinishedMatch, MatchState } from '../utils/matchStatus';

interface MatchListProps {
  view: 'diary' | 'live' | 'finished' | 'not_started';
  date?: string;
  sortBy?: 'league' | 'time';
}

export function MatchList({ view, date, sortBy = 'league' }: MatchListProps) {
  // ============================================
  // STEP 1: ALL HOOKS MUST BE CALLED FIRST
  // ============================================
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const hasLoadedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const fetchRef = useRef<() => Promise<void>>(async () => { });

  // CRITICAL FIX: Ensure matches is always an array (never null/undefined)
  const safeMatches = Array.isArray(matches) ? matches : [];


  const fetchMatches = useCallback(async () => {
    // Prevent overlapping requests (important for WS + polling together)
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setError(null);

      // CRITICAL FIX: Silent Refresh
      // Use Ref instead of 'matches.length' to avoid stale closure flickering
      if (!hasLoadedRef.current) {
        setLoading(true);
      }

      let response;
      if (view === 'live') {
        // Use dedicated live matches endpoint
        response = await getLiveMatches();
      } else {
        // For diary, finished, not_started views - use diary endpoint with date
        const { getTodayInTurkey } = await import('../utils/dateUtils');
        const dateStr = date || getTodayInTurkey();
        response = await getMatchDiary(dateStr);
      }

      // Check for error in response even if API call succeeded
      if (response.err) {
        throw new Error(response.err);
      }

      // Safety check: ensure we have a valid array
      if (response && typeof response === 'object' && 'results' in response) {
        const results = response.results;
        if (Array.isArray(results)) {
          // Filter matches based on view type
          let filteredResults = results;

          if (view === 'live') {
            filteredResults = results.filter((match: Match) => {
              const status = match.status ?? 0;
              return isLiveMatch(status);
            });
          } else if (view === 'finished') {
            filteredResults = results.filter((match: Match) => {
              const status = match.status ?? 0;
              return isFinishedMatch(status);
            });
          } else if (view === 'not_started') {
            filteredResults = results.filter((match: Match) => {
              const status = match.status ?? 0;
              return status === MatchState.NOT_STARTED;
            });
          }
          setMatches(filteredResults);
        } else {
          setMatches([]);
        }
      } else {
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
      // Mark as loaded and turn off spinner
      hasLoadedRef.current = true;
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [view, date]);

  // Keep the latest fetch function available for WS callbacks (avoids stale closures)
  useEffect(() => {
    fetchRef.current = fetchMatches;
  }, [fetchMatches]);

  // Group matches by competition or sort by time - MUST BE CALLED BEFORE ANY EARLY RETURNS
  const matchesByCompetition = useMemo(() => {
    // CRITICAL FIX: Ensure matches is always an array before processing
    if (!Array.isArray(safeMatches)) {
      console.error('❌ [MatchList] safeMatches is not an array:', typeof safeMatches, safeMatches);
      return [];
    }

    console.log('🔄 [MatchList] Grouping matches - total:', safeMatches.length, 'sortBy:', sortBy);

    // If sorting by time, don't group by competition
    if (sortBy === 'time') {
      // Sort all matches by match_time
      const sortedByTime = [...safeMatches].sort((a, b) => {
        const timeA = a.match_time || 0;
        const timeB = b.match_time || 0;
        return timeA - timeB;
      });

      // Return as single "group" with null competition
      return [['__time_sorted__', { competition: null, matches: sortedByTime }]] as [string | null, { competition: Competition | null; matches: Match[] }][];
    }

    // Group by league (default)
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
  }, [safeMatches, sortBy]);

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

          // CRITICAL FIX: Listen to all critical events for real-time updates
          // GOAL: Goal scored
          // SCORE_CHANGE: Score updated (includes goal cancellations)
          // MATCH_STATE_CHANGE: Status changed (NOT_STARTED → FIRST_HALF, HALF_TIME → SECOND_HALF, etc.)
          if (
            message.type === 'GOAL' ||
            message.type === 'SCORE_CHANGE' ||
            message.type === 'MATCH_STATE_CHANGE'
          ) {
            console.log(
              `⚡ Real-time update (${message.type}) for match ${message.matchId} - refreshing matches...`
            );
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

    // CRITICAL FIX: Poll every 10 seconds for real-time score updates
    // If 502 error, retry more frequently (every 3 seconds) to catch backend when it comes back
    // Normal polling: 10 seconds (reduced load on backend)
    const pollInterval = error && error.includes('502') ? 3000 : 10000;
    const interval = setInterval(() => {
      fetchMatches();
    }, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchMatches, error]);

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
    const is502Error = error.includes('HTTP 502') || error.includes('502') || error.includes('HTTP 503') || error.includes('503') || error.includes('HTTP 504') || error.includes('504');
    const isIPError = error.includes('IP is not authorized') || error.includes('IP is not authorized');
    const isRateLimitError = error.includes('Too Many Requests') || error.includes('too many requests') || error.includes('Çok fazla istek');

    return (
      <div style={{
        border: `1px solid ${is502Error ? '#3b82f6' : isIPError ? '#fbbf24' : isRateLimitError ? '#f59e0b' : '#ef4444'}`,
        borderRadius: '8px',
        padding: '1.5rem',
        backgroundColor: is502Error ? '#eff6ff' : isIPError ? '#fef3c7' : isRateLimitError ? '#fef3c7' : '#fee2e2',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flexShrink: 0, fontSize: '24px' }}>
            {is502Error ? '⏳' : isIPError ? '⚠️' : isRateLimitError ? '⏱️' : '❌'}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '4px',
              color: is502Error ? '#1e40af' : isIPError ? '#92400e' : isRateLimitError ? '#92400e' : '#991b1b',
            }}>
              {is502Error ? 'Backend Hazır Değil' : isIPError ? 'IP Yetkilendirme Hatası' : isRateLimitError ? 'Rate Limit Aşıldı' : 'Hata'}
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: is502Error ? '#1e3a8a' : isIPError ? '#78350f' : isRateLimitError ? '#78350f' : '#7f1d1d',
              marginBottom: '12px',
            }}>
              {is502Error ? 'Backend başlatılıyor veya güncelleniyor. Otomatik olarak tekrar denenecek...' : error}
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
          {view === 'live' ? 'Canlı Maçlar' : view === 'finished' ? 'Biten Maçlar' : view === 'not_started' ? 'Başlamamış Maçlar' : 'Günün Maçları'}
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
