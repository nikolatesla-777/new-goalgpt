/**
 * Match Detail Header
 *
 * Displays the header with back button and competition name.
 * Part of the modular match detail page architecture.
 */

import { useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { useMatchDetail } from './MatchDetailContext';

export function MatchDetailHeader() {
  const navigate = useNavigate();
  const { match } = useMatchDetail();

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3 md:p-4 sticky top-0 z-30 shadow-xl border-b border-slate-700/50 backdrop-blur-sm h-[52px] md:h-[60px] flex items-center">
      <div className="max-w-5xl mx-auto w-full flex items-center gap-2 md:gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 md:p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 bg-white/5 backdrop-blur-sm border border-white/10 flex-shrink-0"
        >
          <CaretLeft size={20} weight="bold" className="md:w-[22px] md:h-[22px]" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm text-gray-300 font-semibold tracking-wide uppercase truncate">
            {match?.competition?.name || 'Lig'}
          </p>
        </div>
      </div>
    </header>
  );
}

export default MatchDetailHeader;
