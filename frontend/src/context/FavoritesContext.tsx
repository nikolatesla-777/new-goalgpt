/**
 * Favorites Context
 *
 * Manages user's favorite matches with LocalStorage persistence.
 * Favorites persist across browser sessions.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FavoritesContextValue {
  // Favorite match IDs
  favorites: Set<string>;

  // Actions
  addFavorite: (matchId: string) => void;
  removeFavorite: (matchId: string) => void;
  toggleFavorite: (matchId: string) => void;
  isFavorite: (matchId: string) => boolean;
  clearAllFavorites: () => void;

  // Count
  favoritesCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'goalgpt_favorite_matches';

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Hook for consuming favorites context
 * Must be used within FavoritesProvider
 */
export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load favorites from localStorage
 */
function loadFavoritesFromStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (error) {
    console.warn('[FavoritesContext] Failed to load favorites from localStorage:', error);
  }
  return new Set();
}

/**
 * Save favorites to localStorage
 */
function saveFavoritesToStorage(favorites: Set<string>): void {
  try {
    const array = Array.from(favorites);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
  } catch (error) {
    console.warn('[FavoritesContext] Failed to save favorites to localStorage:', error);
  }
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  // Initialize from localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoritesFromStorage());

  // Save to localStorage whenever favorites change
  useEffect(() => {
    saveFavoritesToStorage(favorites);
  }, [favorites]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const addFavorite = useCallback((matchId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.add(matchId);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((matchId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((matchId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((matchId: string) => {
    return favorites.has(matchId);
  }, [favorites]);

  const clearAllFavorites = useCallback(() => {
    setFavorites(new Set());
  }, []);

  // ============================================================================
  // MEMOIZED VALUES
  // ============================================================================

  const favoritesCount = useMemo(() => favorites.size, [favorites]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: FavoritesContextValue = useMemo(() => ({
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearAllFavorites,
    favoritesCount,
  }), [favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite, clearAllFavorites, favoritesCount]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export default FavoritesContext;
