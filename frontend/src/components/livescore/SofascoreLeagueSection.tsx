/**
 * SofascoreLeagueSection
 *
 * Collapsible league section for Sofascore-style layout
 * Features:
 * - Country flag + league name header
 * - Collapse/expand functionality
 * - Live match count indicator
 * - Clean dividers between matches
 */

import { useState } from 'react';
import type { Match, Competition } from '../../api/matches';
import { SofascoreMatchRow } from './SofascoreMatchRow';
import { CaretDown } from '@phosphor-icons/react';
import { isLiveMatch } from '../../utils/matchStatus';

// Country to flag emoji mapping
const countryFlags: Record<string, string> = {
    'Turkey': '🇹🇷',
    'Türkiye': '🇹🇷',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'İngiltere': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Spain': '🇪🇸',
    'İspanya': '🇪🇸',
    'Germany': '🇩🇪',
    'Almanya': '🇩🇪',
    'Italy': '🇮🇹',
    'İtalya': '🇮🇹',
    'France': '🇫🇷',
    'Fransa': '🇫🇷',
    'Portugal': '🇵🇹',
    'Portekiz': '🇵🇹',
    'Netherlands': '🇳🇱',
    'Hollanda': '🇳🇱',
    'Belgium': '🇧🇪',
    'Belçika': '🇧🇪',
    'Brazil': '🇧🇷',
    'Brezilya': '🇧🇷',
    'Argentina': '🇦🇷',
    'Arjantin': '🇦🇷',
    'USA': '🇺🇸',
    'ABD': '🇺🇸',
    'United States': '🇺🇸',
    'World': '🌍',
    'Dünya': '🌍',
    'Europe': '🇪🇺',
    'Avrupa': '🇪🇺',
    'International': '🌐',
    'Uluslararası': '🌐',
    'Diğer': '🏳️',
};

function getCountryFlag(countryName: string | null | undefined): string {
    if (!countryName) return '🏳️';
    return countryFlags[countryName] || '🏳️';
}

interface SofascoreLeagueSectionProps {
    competition: Competition | null;
    matches: Match[];
    countryName?: string | null;
    defaultExpanded?: boolean;
}

export function SofascoreLeagueSection({
    competition,
    matches,
    countryName,
    defaultExpanded = true,
}: SofascoreLeagueSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Safety check
    if (!Array.isArray(matches) || matches.length === 0) {
        return null;
    }

    const safeMatches = matches.filter(m => m && typeof m === 'object' && m.id);
    if (safeMatches.length === 0) return null;

    // Count live matches in this section
    const liveCount = safeMatches.filter(m => {
        const status = (m as any).status ?? (m as any).status_id ?? 0;
        return isLiveMatch(status);
    }).length;

    const displayCountry = countryName || competition?.country_name || 'Diğer';
    const displayLeague = competition?.name || 'Bilinmeyen Lig';
    const flag = getCountryFlag(displayCountry);

    return (
        <div style={{
            marginBottom: '8px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
            {/* Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                }}
            >
                {/* Left: Flag + Country + League */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flex: 1,
                    minWidth: 0,
                }}>
                    {/* Flag */}
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{flag}</span>

                    {/* Country + League */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden',
                    }}>
                        <span style={{
                            fontWeight: '600',
                            fontSize: '0.8rem',
                            color: '#374151',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            flexShrink: 0,
                        }}>
                            {displayCountry}
                        </span>
                        <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>•</span>
                        <span style={{
                            fontSize: '0.8rem',
                            color: '#6b7280',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {displayLeague}
                        </span>
                    </div>
                </div>

                {/* Right: Live count + Caret */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                }}>
                    {/* Live Match Count */}
                    {liveCount > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '10px',
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#ef4444',
                                animation: 'livePulse 1.5s ease-in-out infinite',
                            }} />
                            <span style={{
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                color: '#ef4444',
                            }}>
                                {liveCount}
                            </span>
                        </div>
                    )}

                    {/* Caret */}
                    <CaretDown
                        size={16}
                        weight="bold"
                        color="#9ca3af"
                        style={{
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        }}
                    />
                </div>
            </div>

            {/* Matches */}
            {isExpanded && (
                <div>
                    {safeMatches.map((match, index) => (
                        <div
                            key={match.id}
                            style={{
                                borderBottom: index < safeMatches.length - 1 ? '1px solid #f3f4f6' : 'none',
                            }}
                        >
                            <SofascoreMatchRow match={match} />
                        </div>
                    ))}
                </div>
            )}

            {/* CSS Animation */}
            <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}

export default SofascoreLeagueSection;
