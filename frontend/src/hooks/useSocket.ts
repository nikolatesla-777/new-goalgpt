/**
 * useSocket Hook
 * 
 * Real-time WebSocket connection for live match updates
 * Connects to backend WebSocket and handles events:
 * - SCORE_CHANGE: Goal scored
 * - DANGER_ALERT: Goal position / dangerous attack
 * - GOAL_CANCELLED: VAR decision
 * - MATCH_STATE_CHANGE: Match status changed
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type AlertType = 'DANGEROUS_ATTACK' | 'SHOT_ATTEMPT' | 'SHOT_SAVED' | 'HIT_POST' | 'PENALTY_SITUATION';

export interface ScoreChangeEvent {
  type: 'SCORE_CHANGE';
  matchId: string;
  homeScore: number;
  awayScore: number;
  timestamp: number;
}

export interface DangerAlertEvent {
  type: 'DANGER_ALERT';
  matchId: string;
  alertType: AlertType;
  team: 'home' | 'away' | 'unknown';
  time: string;
  message: string;
  timestamp: number;
}

export interface GoalCancelledEvent {
  type: 'GOAL_CANCELLED';
  matchId: string;
  homeScore: number;
  awayScore: number;
  previousHomeScore: number;
  previousAwayScore: number;
  timestamp: number;
}

export interface MatchStateChangeEvent {
  type: 'MATCH_STATE_CHANGE';
  matchId: string;
  statusId: number;
  timestamp: number;
}

export type WebSocketEvent = ScoreChangeEvent | DangerAlertEvent | GoalCancelledEvent | MatchStateChangeEvent;

interface UseSocketOptions {
  onScoreChange?: (event: ScoreChangeEvent) => void;
  onDangerAlert?: (event: DangerAlertEvent) => void;
  onGoalCancelled?: (event: GoalCancelledEvent) => void;
  onMatchStateChange?: (event: MatchStateChangeEvent) => void;
  onAnyEvent?: (event: WebSocketEvent) => void;
}

interface UseSocketReturn {
  isConnected: boolean;
  lastEvent: WebSocketEvent | null;
  dangerAlerts: Map<string, DangerAlertEvent>; // matchId -> latest alert
  connect: () => void;
  disconnect: () => void;
}

// Get WebSocket URL from environment or default
const getWsUrl = (): string => {
  // In production, use the same host as the page
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  // Development default
  return import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
};

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    onScoreChange,
    onDangerAlert,
    onGoalCancelled,
    onMatchStateChange,
    onAnyEvent,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [dangerAlerts, setDangerAlerts] = useState<Map<string, DangerAlertEvent>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  // Clear danger alert after 10 seconds (they're time-sensitive)
  const clearDangerAlertTimeout = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const wsEvent = data.data || data; // Handle wrapped or unwrapped format
      
      if (!wsEvent.type) return;

      setLastEvent(wsEvent);
      onAnyEvent?.(wsEvent);

      switch (wsEvent.type) {
        case 'SCORE_CHANGE':
          onScoreChange?.(wsEvent as ScoreChangeEvent);
          // Clear any danger alert for this match (goal happened!)
          setDangerAlerts(prev => {
            const next = new Map(prev);
            next.delete(wsEvent.matchId);
            return next;
          });
          break;

        case 'DANGER_ALERT':
          const dangerEvent = wsEvent as DangerAlertEvent;
          onDangerAlert?.(dangerEvent);
          
          // Store the alert
          setDangerAlerts(prev => {
            const next = new Map(prev);
            next.set(dangerEvent.matchId, dangerEvent);
            return next;
          });
          
          // Auto-clear after 10 seconds
          const existingTimeout = clearDangerAlertTimeout.current.get(dangerEvent.matchId);
          if (existingTimeout) clearTimeout(existingTimeout);
          
          const timeout = setTimeout(() => {
            setDangerAlerts(prev => {
              const next = new Map(prev);
              next.delete(dangerEvent.matchId);
              return next;
            });
            clearDangerAlertTimeout.current.delete(dangerEvent.matchId);
          }, 10000);
          
          clearDangerAlertTimeout.current.set(dangerEvent.matchId, timeout);
          break;

        case 'GOAL_CANCELLED':
          onGoalCancelled?.(wsEvent as GoalCancelledEvent);
          break;

        case 'MATCH_STATE_CHANGE':
          onMatchStateChange?.(wsEvent as MatchStateChangeEvent);
          break;
      }
    } catch (error) {
      console.error('[useSocket] Failed to parse message:', error);
    }
  }, [onScoreChange, onDangerAlert, onGoalCancelled, onMatchStateChange, onAnyEvent]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = getWsUrl();
      console.log('[useSocket] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useSocket] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('[useSocket] Error:', error);
      };

      ws.onclose = (event) => {
        console.log('[useSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[useSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('[useSocket] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[useSocket] Failed to connect:', error);
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    reconnectAttempts.current = maxReconnectAttempts; // Prevent auto-reconnect
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
      // Clear all danger alert timeouts
      clearDangerAlertTimeout.current.forEach(timeout => clearTimeout(timeout));
      clearDangerAlertTimeout.current.clear();
    };
  }, []);

  return {
    isConnected,
    lastEvent,
    dangerAlerts,
    connect,
    disconnect,
  };
}

/**
 * Hook for a specific match - filters events by matchId
 */
export function useMatchSocket(matchId: string, options: UseSocketOptions = {}) {
  const filterByMatchId = useCallback((callback?: (event: any) => void) => {
    if (!callback) return undefined;
    return (event: any) => {
      if (event.matchId === matchId) {
        callback(event);
      }
    };
  }, [matchId]);

  return useSocket({
    onScoreChange: filterByMatchId(options.onScoreChange),
    onDangerAlert: filterByMatchId(options.onDangerAlert),
    onGoalCancelled: filterByMatchId(options.onGoalCancelled),
    onMatchStateChange: filterByMatchId(options.onMatchStateChange),
    onAnyEvent: filterByMatchId(options.onAnyEvent),
  });
}

