/**
 * Match Tab Navigation
 *
 * Tab bar using NavLink for URL-based navigation.
 * Supports nested routes for each tab.
 */

import { NavLink, useParams } from 'react-router-dom';
import {
  Robot,
  ChartBar,
  ListBullets,
  Sword,
  Trophy,
  Users,
  TrendUp,
  type Icon
} from '@phosphor-icons/react';

interface TabConfig {
  id: string;
  path: string;
  label: string;
  Icon: Icon;
}

const tabs: TabConfig[] = [
  { id: 'ai', path: 'ai', label: 'AI TAHMİN', Icon: Robot },
  { id: 'stats', path: 'stats', label: 'İstatistikler', Icon: ChartBar },
  { id: 'events', path: 'events', label: 'Etkinlikler', Icon: ListBullets },
  { id: 'h2h', path: 'h2h', label: 'H2H', Icon: Sword },
  { id: 'standings', path: 'standings', label: 'Puan Durumu', Icon: Trophy },
  { id: 'lineup', path: 'lineup', label: 'Kadro', Icon: Users },
  { id: 'trend', path: 'trend', label: 'Trend', Icon: TrendUp },
];

export function MatchTabNavigation() {
  const { matchId } = useParams<{ matchId: string }>();

  return (
    <div className="bg-gradient-to-b from-white to-gray-50/50 sticky top-[52px] md:top-[60px] z-20 shadow-lg border-b border-gray-200/50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto">
        <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/match/${matchId}/${tab.path}`}
              className={({ isActive }) => `
                flex-shrink-0 min-w-[70px] sm:min-w-[80px] md:min-w-[110px] lg:min-w-[120px] py-2.5 md:py-4 lg:py-5 px-1.5 md:px-3 lg:px-4
                flex flex-col items-center justify-center gap-1 md:gap-2
                transition-all duration-300 relative group
                ${isActive
                  ? 'text-indigo-600 bg-gradient-to-b from-indigo-50/50 to-transparent'
                  : 'text-gray-500 hover:text-indigo-500 hover:bg-indigo-50/30'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className={`relative transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    <tab.Icon
                      size={20}
                      weight={isActive ? "fill" : "regular"}
                      className={`transition-all duration-300 md:w-6 md:h-6 lg:w-7 lg:h-7 ${isActive ? 'drop-shadow-lg' : ''}`}
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-indigo-200/30 rounded-full blur-md -z-10"></div>
                    )}
                  </div>
                  <span className={`text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold tracking-wide transition-colors duration-300 leading-tight text-center ${isActive ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-500'}`}>
                    {tab.label}
                  </span>

                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 md:h-1 lg:h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-t-full mx-1 md:mx-2 lg:mx-3 shadow-lg shadow-indigo-500/50" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MatchTabNavigation;
