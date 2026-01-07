import type { Match } from '../api/matches';
import { MatchCard } from './MatchCard';
import type { Competition } from '../api/matches';

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
  'Mexico': '🇲🇽',
  'Meksika': '🇲🇽',
  'Japan': '🇯🇵',
  'Japonya': '🇯🇵',
  'South Korea': '🇰🇷',
  'Güney Kore': '🇰🇷',
  'China': '🇨🇳',
  'Çin': '🇨🇳',
  'Australia': '🇦🇺',
  'Avustralya': '🇦🇺',
  'Russia': '🇷🇺',
  'Rusya': '🇷🇺',
  'Ukraine': '🇺🇦',
  'Ukrayna': '🇺🇦',
  'Poland': '🇵🇱',
  'Polonya': '🇵🇱',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'İskoçya': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Galler': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Greece': '🇬🇷',
  'Yunanistan': '🇬🇷',
  'Austria': '🇦🇹',
  'Avusturya': '🇦🇹',
  'Switzerland': '🇨🇭',
  'İsviçre': '🇨🇭',
  'Denmark': '🇩🇰',
  'Danimarka': '🇩🇰',
  'Sweden': '🇸🇪',
  'İsveç': '🇸🇪',
  'Norway': '🇳🇴',
  'Norveç': '🇳🇴',
  'Finland': '🇫🇮',
  'Finlandiya': '🇫🇮',
  'Czech Republic': '🇨🇿',
  'Çek Cumhuriyeti': '🇨🇿',
  'Croatia': '🇭🇷',
  'Hırvatistan': '🇭🇷',
  'Serbia': '🇷🇸',
  'Sırbistan': '🇷🇸',
  'Romania': '🇷🇴',
  'Romanya': '🇷🇴',
  'Bulgaria': '🇧🇬',
  'Bulgaristan': '🇧🇬',
  'Hungary': '🇭🇺',
  'Macaristan': '🇭🇺',
  'Slovakia': '🇸🇰',
  'Slovakya': '🇸🇰',
  'Slovenia': '🇸🇮',
  'Slovenya': '🇸🇮',
  'Israel': '🇮🇱',
  'İsrail': '🇮🇱',
  'Saudi Arabia': '🇸🇦',
  'Suudi Arabistan': '🇸🇦',
  'UAE': '🇦🇪',
  'Birleşik Arap Emirlikleri': '🇦🇪',
  'Qatar': '🇶🇦',
  'Katar': '🇶🇦',
  'Egypt': '🇪🇬',
  'Mısır': '🇪🇬',
  'Morocco': '🇲🇦',
  'Fas': '🇲🇦',
  'Tunisia': '🇹🇳',
  'Tunus': '🇹🇳',
  'Algeria': '🇩🇿',
  'Cezayir': '🇩🇿',
  'South Africa': '🇿🇦',
  'Güney Afrika': '🇿🇦',
  'Nigeria': '🇳🇬',
  'Nijerya': '🇳🇬',
  'Colombia': '🇨🇴',
  'Kolombiya': '🇨🇴',
  'Chile': '🇨🇱',
  'Şili': '🇨🇱',
  'Peru': '🇵🇪',
  'Uruguay': '🇺🇾',
  'Paraguay': '🇵🇾',
  'Ecuador': '🇪🇨',
  'Ekvador': '🇪🇨',
  'Venezuela': '🇻🇪',
  'Bolivia': '🇧🇴',
  'Bolivya': '🇧🇴',
  'India': '🇮🇳',
  'Hindistan': '🇮🇳',
  'Indonesia': '🇮🇩',
  'Endonezya': '🇮🇩',
  'Thailand': '🇹🇭',
  'Tayland': '🇹🇭',
  'Vietnam': '🇻🇳',
  'Malaysia': '🇲🇾',
  'Malezya': '🇲🇾',
  'Singapore': '🇸🇬',
  'Singapur': '🇸🇬',
  'Philippines': '🇵🇭',
  'Filipinler': '🇵🇭',
  'Ireland': '🇮🇪',
  'İrlanda': '🇮🇪',
  'Northern Ireland': '🇬🇧',
  'Kuzey İrlanda': '🇬🇧',
  'Cyprus': '🇨🇾',
  'Kıbrıs': '🇨🇾',
  'Iceland': '🇮🇸',
  'İzlanda': '🇮🇸',
  'Luxembourg': '🇱🇺',
  'Lüksemburg': '🇱🇺',
  'Malta': '🇲🇹',
  'Estonia': '🇪🇪',
  'Estonya': '🇪🇪',
  'Latvia': '🇱🇻',
  'Letonya': '🇱🇻',
  'Lithuania': '🇱🇹',
  'Litvanya': '🇱🇹',
  'Belarus': '🇧🇾',
  'Georgia': '🇬🇪',
  'Gürcistan': '🇬🇪',
  'Armenia': '🇦🇲',
  'Ermenistan': '🇦🇲',
  'Azerbaijan': '🇦🇿',
  'Azerbaycan': '🇦🇿',
  'Kazakhstan': '🇰🇿',
  'Kazakistan': '🇰🇿',
  'Uzbekistan': '🇺🇿',
  'Özbekistan': '🇺🇿',
  'Iran': '🇮🇷',
  'İran': '🇮🇷',
  'Iraq': '🇮🇶',
  'Irak': '🇮🇶',
  'Jordan': '🇯🇴',
  'Ürdün': '🇯🇴',
  'Kuwait': '🇰🇼',
  'Kuveyt': '🇰🇼',
  'Bahrain': '🇧🇭',
  'Bahreyn': '🇧🇭',
  'Oman': '🇴🇲',
  'Umman': '🇴🇲',
  'Lebanon': '🇱🇧',
  'Lübnan': '🇱🇧',
  'Bangladesh': '🇧🇩',
  'Bangladeş': '🇧🇩',
  'Myanmar': '🇲🇲',
  'Nepal': '🇳🇵',
  'Sri Lanka': '🇱🇰',
  'Pakistan': '🇵🇰',
  'Cambodia': '🇰🇭',
  'Kamboçya': '🇰🇭',
  'Laos': '🇱🇦',
  'Mongolia': '🇲🇳',
  'Moğolistan': '🇲🇳',
  'North Korea': '🇰🇵',
  'Kuzey Kore': '🇰🇵',
  'Taiwan': '🇹🇼',
  'Tayvan': '🇹🇼',
  'Hong Kong': '🇭🇰',
  'Macau': '🇲🇴',
  'World': '🌍',
  'Dünya': '🌍',
  'Europe': '🇪🇺',
  'Avrupa': '🇪🇺',
  'International': '🌐',
  'Uluslararası': '🌐',
  'Diğer': '🏳️',
};

// Get flag for country name
function getCountryFlag(countryName: string | null | undefined): string {
  if (!countryName) return '🏳️';
  return countryFlags[countryName] || '🏳️';
}

interface LeagueSectionProps {
  competition: Competition | null;
  matches: Match[];
  countryName?: string | null;
  isTimeGroup?: boolean;
  timeSlot?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function LeagueSection({
  competition,
  matches,
  countryName,
  isTimeGroup = false,
  timeSlot,
  isCollapsed = false,
  onToggleCollapse,
}: LeagueSectionProps) {
  // CRITICAL FIX: Safety checks
  if (!Array.isArray(matches)) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '1rem' }}>
        <p style={{ color: '#991b1b', margin: 0 }}>Geçersiz maç verisi</p>
      </div>
    );
  }

  const safeMatches = matches.filter(match => match && typeof match === 'object' && match.id);

  if (safeMatches.length === 0) {
    return null; // Don't render empty sections
  }

  // Build section header based on type
  let headerContent: React.ReactNode;
  let flag = '';
  let displayCountry = '';
  let displayLeague = '';

  if (isTimeGroup && timeSlot) {
    // Time-based grouping
    headerContent = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.25rem' }}>🕐</span>
        <span style={{ fontWeight: '600', fontSize: '1rem' }}>{timeSlot}</span>
      </div>
    );
  } else {
    // Country → Competition grouping
    displayCountry = countryName || competition?.country_name || 'Diğer';
    displayLeague = competition?.name || 'Bilinmeyen Lig';
    flag = getCountryFlag(displayCountry);

    headerContent = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.25rem' }}>{flag}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: '600', color: '#374151' }}>{displayCountry}</span>
          <span style={{ color: '#9ca3af' }}>—</span>
          <span style={{ color: '#6b7280' }}>{displayLeague}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* League Header - Clickable for collapse */}
      <div
        onClick={onToggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#f9fafb',
          borderRadius: isCollapsed ? '8px' : '8px 8px 0 0',
          border: '1px solid #e5e7eb',
          borderBottom: isCollapsed ? '1px solid #e5e7eb' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }}
      >
        {/* Left side: Flag + Country + League */}
        {headerContent}

        {/* Right side: Match count + Collapse indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            fontWeight: '500',
          }}>
            {safeMatches.length} maç
          </span>
          <span style={{
            fontSize: '1rem',
            color: '#9ca3af',
            transition: 'transform 0.2s',
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Matches - Collapsible */}
      {!isCollapsed && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {safeMatches.map((match, index) => {
              if (!match || !match.id) return null;

              return (
                <div
                  key={match.id}
                  style={{
                    borderBottom: index < safeMatches.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <MatchCard match={match} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
