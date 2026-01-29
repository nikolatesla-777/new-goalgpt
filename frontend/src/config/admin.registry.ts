/**
 * Admin Menu Registry
 * Single source of truth for admin panel menu structure and routing
 *
 * This registry centralizes:
 * - Menu item definitions (id, label, path, icon)
 * - Component lazy loading configuration
 * - Menu sections and grouping
 * - Feature flags (comingSoon, requiresAdmin)
 *
 * Usage:
 * - AdminLayout.tsx: Renders menu from MENU_SECTIONS
 * - App.tsx: Generates routes from ALL_MENU_ITEMS
 *
 * To add a new menu item:
 * 1. Add entry to ALL_MENU_ITEMS array
 * 2. Set appropriate section: 'general' | 'ai' | 'management'
 * 3. Component lazy loading is handled automatically
 * 4. No need to modify AdminLayout.tsx or App.tsx manually
 */

import { lazy } from 'react';
import type { LazyExoticComponent } from 'react';
import type { IconKey } from '../components/admin/AdminIcons';

// ============================================================================
// TYPES
// ============================================================================

export interface MenuItem {
  /**
   * Unique identifier for tracking/testing
   * Format: kebab-case (e.g., 'telegram-publish', 'daily-lists')
   */
  id: string;

  /**
   * Display label in menu (Turkish)
   */
  label: string;

  /**
   * Route path (must start with /)
   * Examples: '/admin/telegram', '/admin/telegram/daily-lists'
   */
  routePath: string;

  /**
   * Icon key from AdminIcons.tsx
   * Available: 'dashboard', 'telegram', 'sparkles', 'predictions', 'logs', 'bots', 'settings', 'manual', 'livescore'
   */
  iconKey: IconKey;

  /**
   * Lazy-loaded component
   * Auto-imported from './components/admin'
   */
  component: LazyExoticComponent<React.ComponentType<any>>;

  /**
   * Menu section grouping
   * - general: Dashboard, Live score
   * - ai: AI predictions, labs
   * - management: Admin operations (Telegram, lists, trends, etc.)
   */
  section: 'general' | 'ai' | 'management';

  /**
   * Feature flag: Show "Coming Soon" badge
   * Default: false
   */
  comingSoon?: boolean;

  /**
   * Requires admin role (for future ACL)
   * Default: false
   */
  requiresAdmin?: boolean;
}

export interface MenuSection {
  label: string;
  items: MenuItem[];
}

// ============================================================================
// MENU ITEMS REGISTRY
// ============================================================================

/**
 * Complete menu registry
 * Order matters: Items appear in menu in this sequence
 */
export const ALL_MENU_ITEMS: MenuItem[] = [
  // -------------------------------------------------------------------------
  // GENERAL SECTION
  // -------------------------------------------------------------------------
  {
    id: 'dashboard',
    label: 'Komuta Merkezi',
    routePath: '/',
    iconKey: 'dashboard',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.AdminKomutaMerkezi }))),
    section: 'general',
  },
  {
    id: 'livescore',
    label: 'Canli Skor',
    routePath: '/livescore',
    iconKey: 'livescore',
    component: lazy(() => import('../components/livescore').then(m => ({ default: m.LivescoreLayout }))),
    section: 'general',
  },

  // -------------------------------------------------------------------------
  // AI SECTION
  // -------------------------------------------------------------------------
  {
    id: 'ai-predictions',
    label: 'Yapay Zeka',
    routePath: '/ai-predictions',
    iconKey: 'sparkles',
    component: lazy(() => import('../components/ai/AIPredictionsPage').then(m => ({ default: m.AIPredictionsPage }))),
    section: 'ai',
  },
  {
    id: 'ai-lab',
    label: 'AI Analiz Lab',
    routePath: '/ai-lab',
    iconKey: 'sparkles',
    component: lazy(() => import('../components/ai-lab').then(m => ({ default: m.AIAnalysisLab }))),
    section: 'ai',
  },
  {
    id: 'predictions-list',
    label: 'Tahmin Listesi',
    routePath: '/admin/predictions',
    iconKey: 'predictions',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.AdminPredictions }))),
    section: 'ai',
  },
  {
    id: 'request-logs',
    label: 'Istek Loglari',
    routePath: '/admin/logs',
    iconKey: 'logs',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.AdminLogs }))),
    section: 'ai',
  },
  {
    id: 'manual-predictions',
    label: 'Manuel Tahmin',
    routePath: '/admin/manual-predictions',
    iconKey: 'manual',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.AdminManualPredictions }))),
    section: 'ai',
  },

  // -------------------------------------------------------------------------
  // MANAGEMENT SECTION (6 Target Items from Audit)
  // -------------------------------------------------------------------------
  {
    id: 'bot-rules',
    label: 'Bot Kurallari',
    routePath: '/admin/bots',
    iconKey: 'bots',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.AdminBots }))),
    section: 'management',
  },
  {
    id: 'telegram-publish',
    label: 'Telegram Yayin',
    routePath: '/admin/telegram',
    iconKey: 'telegram',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.TelegramPublisher }))),
    section: 'management',
    requiresAdmin: true,
  },
  {
    id: 'daily-lists',
    label: 'Gunluk Listeler',
    routePath: '/admin/telegram/daily-lists',
    iconKey: 'telegram',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.TelegramDailyLists }))),
    section: 'management',
    requiresAdmin: true,
  },
  {
    id: 'daily-tips',
    label: 'Gunun Onerileri',
    routePath: '/admin/daily-tips',
    iconKey: 'telegram',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.DailyTipsPage }))),
    section: 'management',
    requiresAdmin: true,
    comingSoon: true, // Feature not implemented yet
  },
  {
    id: 'trends-analysis',
    label: 'Trend Analizi',
    routePath: '/admin/trends-analysis',
    iconKey: 'telegram',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.TrendsAnalysisPage }))),
    section: 'management',
    requiresAdmin: true,
  },
  {
    id: 'league-standings',
    label: 'Puan Durumu',
    routePath: '/admin/league-standings',
    iconKey: 'telegram',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.LeagueStandingsPage }))),
    section: 'management',
    requiresAdmin: true,
  },
  {
    id: 'player-stats',
    label: 'Oyuncu Istatistikleri',
    routePath: '/admin/player-stats',
    iconKey: 'telegram',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.PlayerSearchPage }))),
    section: 'management',
    requiresAdmin: true,
  },
  {
    id: 'settings',
    label: 'Ayarlar',
    routePath: '/admin/settings',
    iconKey: 'settings',
    component: lazy(() => import('../components/admin').then(m => ({ default: m.AdminKomutaMerkezi }))), // Placeholder
    section: 'management',
    requiresAdmin: true,
  },
];

// ============================================================================
// COMPUTED SECTIONS
// ============================================================================

/**
 * Menu sections for sidebar rendering
 * Automatically grouped by section field
 */
export const MENU_SECTIONS: MenuSection[] = [
  {
    label: 'Genel Bakis',
    items: ALL_MENU_ITEMS.filter(item => item.section === 'general'),
  },
  {
    label: 'YAPAY ZEKA',
    items: ALL_MENU_ITEMS.filter(item => item.section === 'ai'),
  },
  {
    label: 'Yonetim',
    items: ALL_MENU_ITEMS.filter(item => item.section === 'management'),
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get menu item by ID
 */
export function getMenuItemById(id: string): MenuItem | undefined {
  return ALL_MENU_ITEMS.find(item => item.id === id);
}

/**
 * Get menu item by route path
 */
export function getMenuItemByPath(path: string): MenuItem | undefined {
  return ALL_MENU_ITEMS.find(item => item.routePath === path);
}

/**
 * Get all menu items for a section
 */
export function getMenuItemsBySection(section: MenuItem['section']): MenuItem[] {
  return ALL_MENU_ITEMS.filter(item => item.section === section);
}
