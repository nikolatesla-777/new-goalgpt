import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMatchDiary, getLiveMatches, getMatchedPredictions } from '../api/matches';
import type { Match, Competition } from '../api/matches';
import { LeagueSection } from './LeagueSection';
import { isLiveMatch, isFinishedMatch, MatchState } from '../utils/matchStatus';

interface MatchListProps {
  view: 'diary' | 'live' | 'finished' | 'not_started' | 'ai' | 'favorites';
  date?: string;
  sortBy?: 'league' | 'time';
  // For favorites view - pass favorite matches directly
  favoriteMatches?: Match[];
  // CRITICAL FIX: Pass pre-fetched matches to avoid double fetching
  // When provided, MatchList skips internal fetching and WebSocket connection
  prefetchedMatches?: Match[];
  // Skip internal WebSocket and polling when parent handles it
  skipInternalUpdates?: boolean;
  // CRITICAL FIX: External loading state from parent context
  // When prefetchedMatches is used, parent should pass its loading state
  isLoading?: boolean;
}

export function MatchList({ view, date, sortBy = 'league', favoriteMatches, prefetchedMatches, skipInternalUpdates = false, isLoading: externalLoading }: MatchListProps) {
  // ============================================
  // STEP 1: ALL HOOKS MUST BE CALLED FIRST
  // ============================================
  const [matches, setMatches] = useState<Match[]>([]);
  const [internalLoading, setInternalLoading] = useState(!prefetchedMatches); // Skip loading state if prefetched

  // CRITICAL FIX: Use external loading state if provided, otherwise use internal
  // This ensures parent context's loading state is respected when using prefetchedMatches
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const setLoading = setInternalLoading; // Keep setter for internal use
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const hasLoadedRef = useRef(!!prefetchedMatches); // Already loaded if prefetched
  const isFetchingRef = useRef(false);
  const fetchRef = useRef<() => Promise<void>>(async () => { });
  const debounceTimerRef = useRef<number | null>(null); // Debounce timer for WebSocket + polling coordination

  // Collapsed state for league sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // PERFORMANCE OPTIMIZATION: Progressive loading for instant first paint
  // Show 5 leagues immediately, then auto-load +5 more after 500ms
  const [displayedLeagueCount, setDisplayedLeagueCount] = useState(5); // Show 5 leagues immediately
  const LEAGUES_PER_PAGE = 10; // Load 10 more at a time when user clicks

  // Progressive loading: Reset to 5, then auto-load +5 more
  useEffect(() => {
    setDisplayedLeagueCount(5); // First paint: 5 leagues only

    // Auto-load +5 more after 500ms (progressive enhancement)
    const timer = setTimeout(() => {
      setDisplayedLeagueCount(10);
    }, 500);

    return () => clearTimeout(timer);
  }, [date, view]);

  // CRITICAL FIX: Ensure matches is always an array (never null/undefined)
  // Priority: 1) favorites view → favoriteMatches, 2) prefetchedMatches, 3) internal matches state
  const safeMatches = view === 'favorites' && favoriteMatches
    ? favoriteMatches
    : (prefetchedMatches ? prefetchedMatches : (Array.isArray(matches) ? matches : []));


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
      } else if (view === 'ai') {
        // Fetch matched AI predictions
        const aiData = await getMatchedPredictions(100);

        // CRITICAL FIX: Filter predictions by selected date
        // The API returns all predictions, we need to filter by match_time
        const { getTodayInTurkey } = await import('../utils/dateUtils');
        const selectedDateStr = date || getTodayInTurkey();

        // Parse selected date to get day boundaries (TSI timezone)
        const year = parseInt(selectedDateStr.substring(0, 4));
        const month = parseInt(selectedDateStr.substring(4, 6)) - 1;
        const day = parseInt(selectedDateStr.substring(6, 8));

        // TSI (UTC+3) day boundaries
        const TSI_OFFSET_SECONDS = 3 * 3600;
        const dayStartUTC = new Date(Date.UTC(year, month, day, 0, 0, 0)).getTime() / 1000 - TSI_OFFSET_SECONDS;
        const dayEndUTC = new Date(Date.UTC(year, month, day, 23, 59, 59)).getTime() / 1000 - TSI_OFFSET_SECONDS;

        // Filter predictions by match_time within selected date
        const filteredPredictions = (aiData.predictions || []).filter((p: any) => {
          const matchTime = Number(p.match_time); // Ensure numeric comparison
          return matchTime >= dayStartUTC && matchTime <= dayEndUTC;
        });

        // Map AI predictions to Match objects
        // The API returns predictions with joined match data
        const mappedMatches = filteredPredictions.map((p: any) => {
          // Construct Match object from prediction data
          // We prioritize match data from the join
          return {
            id: p.match_external_id || p.id, // Use match_external_id as the primary ID for the card
            match_time: p.match_time,
            status: p.status ?? p.status_id,
            minute_text: p.minute_text || '',
            home_team_id: p.home_team_id,
            away_team_id: p.away_team_id,
            home_score: p.home_score,
            away_score: p.away_score,
            home_team: {
              id: p.home_team_id,
              name: p.home_team_name,
              logo_url: p.home_team_logo
            },
            away_team: {
              id: p.away_team_id,
              name: p.away_team_name,
              logo_url: p.away_team_logo
            },
            competition_id: p.competition_id,
            competition: {
              id: p.competition_id,
              name: p.league_name,
              logo_url: p.league_logo,
              country_name: p.country_name
            },
            // Add AI specific flag if needed, but MatchCard handles it via context
          } as Match;
        });

        // Wrap in expected response structure
        response = { results: mappedMatches };

      } else {
        // For diary, finished, not_started views - use diary endpoint with date
        const { getTodayInTurkey } = await import('../utils/dateUtils');
        const dateStr = date || getTodayInTurkey();
        
        // CRITICAL FIX: Pass status filter to backend for finished/not_started views
        // This reduces data transfer and ensures correct counts
        let statusParam: string | undefined;
        if (view === 'finished') {
          statusParam = '8'; // END status
        } else if (view === 'not_started') {
          statusParam = '1'; // NOT_STARTED status
        }
        // For 'diary' view, don't pass status (get all matches)
        
        response = await getMatchDiary(dateStr, statusParam);
      }
      
      // Check for error in response even if API call succeeded
      if (response && (response as any).err) {
        throw new Error((response as any).err);
      }

      // Safety check: ensure we have a valid array
      if (response && typeof response === 'object' && 'results' in response) {
        const results = response.results;
        if (Array.isArray(results)) {
          // Filter matches based on view type
          let filteredResults = results;

          // CRITICAL FIX: Backend now filters by status, so frontend filtering is redundant
          // But keep it as a safety check in case backend filter fails
          if (view === 'live') {
            // Live matches already filtered by backend (getLiveMatches endpoint)
            filteredResults = results.filter((match: Match) => {
              const status = match.status ?? 0;
              return isLiveMatch(status);
            });
          } else if (view === 'finished') {
            // Backend filters by status=8, but keep frontend filter as safety check
            filteredResults = results.filter((match: Match) => {
              const status = match.status ?? 0;
              return isFinishedMatch(status);
            });
          } else if (view === 'not_started') {
            // Backend filters by status=1, but keep frontend filter as safety check
            filteredResults = results.filter((match: Match) => {
              const status = match.status ?? 0;
              return status === MatchState.NOT_STARTED;
            });
          }
          // CRITICAL FIX: Only update matches if we have valid data
          // Don't clear matches on polling refresh if response is empty (preserve existing data)
          setMatches(filteredResults);
          setLastUpdate(new Date());
          setError(null);
        } else {
          // Invalid response structure - keep existing matches
          setLastUpdate(new Date());
        }
      } else {
        // Invalid response - keep existing matches
      setLastUpdate(new Date());
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Maçlar yüklenirken bir hata oluştu';
      // CRITICAL FIX: Don't clear matches on error - preserve existing data
      // Only set error state so user knows something went wrong, but don't lose data
      setError(errorMessage);
      // Don't call setMatches([]) - keep existing matches visible
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

  // Toggle section collapse
  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  // Group matches by Country → Competition hierarchy
  // CRITICAL FIX: Preserve country/league info even when sorting by time
  const matchesByCountryAndCompetition = useMemo(() => {
    // CRITICAL FIX: Ensure matches is always an array before processing
    if (!Array.isArray(safeMatches)) {
      return [];
    }

    // Helper to sort matches within a group
    const sortMatchesInGroup = (matchList: Match[]) => {
      return [...matchList].sort((a, b) => {
        const statusA = (a as any).status_id ?? (a as any).status ?? 0;
        const statusB = (b as any).status_id ?? (b as any).status ?? 0;
        const isLiveA = [2, 3, 4, 5, 7].includes(statusA);
        const isLiveB = [2, 3, 4, 5, 7].includes(statusB);

        // For live matches, sort by minute (descending - highest minute first)
        if (isLiveA && isLiveB) {
          const minuteA = a.minute ?? 0;
          const minuteB = b.minute ?? 0;
          if (minuteA !== minuteB) {
            return minuteB - minuteA;
          }
          return a.id.localeCompare(b.id);
        }

        // If only one is live, live matches come first
        if (isLiveA && !isLiveB) return -1;
        if (!isLiveA && isLiveB) return 1;

        // For non-live matches, sort by match_time (ascending - earliest first)
        const timeA = a.match_time || 0;
        const timeB = b.match_time || 0;
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        return a.id.localeCompare(b.id);
      });
    };

    // If sorting by time, group by time slots but preserve country/league info
    if (sortBy === 'time') {
      // Sort all matches by time first
      const sortedByTime = sortMatchesInGroup(safeMatches);

      // Group by hour slots (e.g., "14:00", "15:00")
      const grouped = new Map<string, {
        timeSlot: string;
        matches: Match[];
      }>();

      sortedByTime.forEach((match) => {
        if (!match || typeof match !== 'object' || !match.id) return;

        const matchTime = match.match_time || 0;
        const date = new Date(matchTime * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const timeSlot = `${hours}:00`;

        if (!grouped.has(timeSlot)) {
          grouped.set(timeSlot, { timeSlot, matches: [] });
        }
        grouped.get(timeSlot)!.matches.push(match);
      });

      // Convert to array format for rendering
      // Each entry: [sectionKey, { competition, matches, countryName, isTimeGroup }]
      const result: [string, {
        competition: Competition | null;
        matches: Match[];
        countryName: string | null;
        isTimeGroup: boolean;
        timeSlot?: string;
      }][] = [];

      Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([timeSlot, group]) => {
          result.push([`time_${timeSlot}`, {
            competition: null,
            matches: group.matches,
            countryName: null,
            isTimeGroup: true,
            timeSlot,
          }]);
        });

      return result;
    }

    // Group by Country → Competition (default)
    // Key format: "countryName|competitionId"
    const grouped = new Map<string, {
      competition: Competition | null;
      matches: Match[];
      countryName: string;
    }>();

    safeMatches.forEach((match) => {
      if (!match || typeof match !== 'object' || !match.id) return;

      const comp = match.competition || null;
      const countryName = comp?.country_name || 'Diğer';
      const compId = match.competition_id || 'unknown';
      const groupKey = `${countryName}|${compId}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          competition: comp,
          matches: [],
          countryName,
        });
      }
      grouped.get(groupKey)!.matches.push(match);
    });

    // Sort matches within each group
    grouped.forEach((group) => {
      group.matches = sortMatchesInGroup(group.matches);
    });

    // Sort by country name first, then by competition name
    const sorted = Array.from(grouped.entries()).sort((a, b) => {
      const countryA = a[1].countryName || 'Diğer';
      const countryB = b[1].countryName || 'Diğer';

      // Country comparison first
      const countryCompare = countryA.localeCompare(countryB, 'tr');
      if (countryCompare !== 0) return countryCompare;

      // Then by competition name
      const nameA = a[1].competition?.name || 'Bilinmeyen Lig';
      const nameB = b[1].competition?.name || 'Bilinmeyen Lig';
      return nameA.localeCompare(nameB, 'tr');
    });

    // Add isTimeGroup: false to each entry
    return sorted.map(([key, value]) => [key, { ...value, isTimeGroup: false }] as [string, typeof value & { isTimeGroup: boolean }]);
  }, [safeMatches, sortBy]);

  // CRITICAL: WebSocket connection for real-time updates (with reconnect)
  // CRITICAL FIX: Skip if using prefetched data (parent handles WebSocket)
  useEffect(() => {
    // Skip WebSocket if parent provides prefetched data or skipInternalUpdates is true
    if (prefetchedMatches || skipInternalUpdates) {
      return; // Parent (LivescoreContext) handles WebSocket
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost =
        window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;

      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);

      ws.onopen = () => {
        // WebSocket connected
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // CRITICAL FIX: Listen to all critical events for real-time updates
          // GOAL: Goal scored
          // SCORE_CHANGE: Score updated (includes goal cancellations)
          // MATCH_STATE_CHANGE: Status changed (NOT_STARTED → FIRST_HALF, HALF_TIME → SECOND_HALF, etc.)
          // MINUTE_UPDATE: Match minute updated (real-time minute synchronization)
          if (
            message.type === 'GOAL' ||
            message.type === 'SCORE_CHANGE' ||
            message.type === 'MATCH_STATE_CHANGE' ||
            message.type === 'MINUTE_UPDATE'
          ) {
            // CRITICAL FIX: Debounce WebSocket events to prevent race condition with polling
            // Clear existing debounce timer
            if (debounceTimerRef.current !== null) {
              window.clearTimeout(debounceTimerRef.current);
            }

            // Set new debounce timer (500ms delay)
            debounceTimerRef.current = window.setTimeout(() => {
              fetchRef.current(); // Always call latest fetch
              debounceTimerRef.current = null;
            }, 500); // 500ms debounce to batch rapid WebSocket events
          }
        } catch {
          // Failed to parse WebSocket message
        }
      };

      ws.onerror = () => {
        // WebSocket error
      };

      ws.onclose = () => {
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
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      if (ws) ws.close();
    };
  }, [prefetchedMatches, skipInternalUpdates]);

  useEffect(() => {
    // CRITICAL FIX: Skip fetching and polling if using prefetched data
    if (prefetchedMatches || skipInternalUpdates) {
      // Data comes from parent (LivescoreContext), no need to fetch
      return;
    }

    fetchMatches();

    // CRITICAL FIX: Poll every 15 seconds for real-time score updates (increased from 10s to reduce race condition)
    // If 502 error, retry more frequently (every 5 seconds) to catch backend when it comes back
    // Normal polling: 15 seconds (reduced load on backend and less conflict with WebSocket)
    // WebSocket handles most real-time updates, polling is fallback
    const pollInterval = error && error.includes('502') ? 5000 : 15000;
    const interval = setInterval(() => {
      // CRITICAL FIX: Check if WebSocket debounce is active, if so skip this polling cycle
      // This prevents polling and WebSocket from conflicting
      if (debounceTimerRef.current === null) {
        fetchMatches();
      }
    }, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchMatches, error, prefetchedMatches, skipInternalUpdates]);

  // ============================================
  // STEP 2: GUARD CLAUSES (early returns AFTER all hooks)
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
    // CRITICAL FIX: Show loading state instead of "No matches" while fetching
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '3rem 0' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ marginLeft: '12px', color: '#4b5563' }}>Maçlar yükleniyor...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

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
          <span style={{ marginLeft: '12px', fontSize: '0.875rem', color: '#f59e0b' }}>
            ⚠️ No matches found. Check API response.
          </span>
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
  if (!Array.isArray(matchesByCountryAndCompetition)) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: '#ef4444' }}>
        <p>Render hatası: Gruplandırma başarısız</p>
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

  // View titles
  const viewTitles: Record<string, string> = {
    live: 'Canlı Maçlar',
    finished: 'Biten Maçlar',
    not_started: 'Başlamamış Maçlar',
    ai: 'AI Tahminli Maçlar',
    favorites: 'Favori Maçlarım',
    diary: 'Günün Maçları',
  };

  // CRITICAL: Total Counter
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
          {viewTitles[view]?.toUpperCase() || 'TOPLAM MAÇ'}: {safeMatches.length}
        </span>
        {safeMatches.length > 0 && (
          <span style={{ marginLeft: '12px', fontSize: '0.875rem', color: '#64748b' }}>
            ({matchesByCountryAndCompetition.length} {sortBy === 'time' ? 'saat dilimi' : 'lig'})
          </span>
        )}
      </div>
      {safeMatches.length === 0 && !loading && view !== 'favorites' && (
        <span style={{ fontSize: '0.875rem', color: '#f59e0b' }}>
          Maç bulunamadı
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
          {viewTitles[view] || 'Günün Maçları'}
        </h2>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
        </div>
      </div>

      <div>
        {matchesByCountryAndCompetition.length > 0 ? (
          <>
            {/* PERFORMANCE: Only render first N leagues */}
            {matchesByCountryAndCompetition.slice(0, displayedLeagueCount).map(([sectionKey, groupData]) => {
              // CRITICAL FIX: Validate matches before passing to LeagueSection
              if (!Array.isArray(groupData.matches)) {
                return null;
              }

              const isCollapsed = collapsedSections.has(sectionKey);

              return (
                <LeagueSection
                  key={sectionKey || 'unknown'}
                  competition={groupData.competition}
                  matches={groupData.matches}
                  countryName={(groupData as any).countryName || null}
                  isTimeGroup={(groupData as any).isTimeGroup || false}
                  timeSlot={(groupData as any).timeSlot}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleSection(sectionKey)}
                />
              );
            })}

            {/* PERFORMANCE: Load More button */}
            {displayedLeagueCount < matchesByCountryAndCompetition.length && (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                borderTop: '2px dashed #e5e7eb',
                marginTop: '1rem',
              }}>
                <button
                  onClick={() => setDisplayedLeagueCount(prev => prev + LEAGUES_PER_PAGE)}
                  style={{
                    padding: '12px 32px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Daha Fazla Yükle ({displayedLeagueCount}/{matchesByCountryAndCompetition.length} lig)
                </button>
                <div style={{
                  marginTop: '12px',
                  fontSize: '0.875rem',
                  color: '#6b7280',
                }}>
                  {matchesByCountryAndCompetition.length - displayedLeagueCount} lig daha var
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            {loading ? (
              // CRITICAL FIX: Show loading state instead of "No matches" while fetching
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Maçlar yükleniyor...</p>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : view === 'favorites' ? (
              <>
                <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Henüz favori maçınız yok</p>
                <p style={{ fontSize: '0.875rem' }}>
                  Maç kartlarındaki ⭐ ikonuna tıklayarak maçları favorilere ekleyebilirsiniz
                </p>
              </>
            ) : (
              <p>Maç bulunamadı</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
