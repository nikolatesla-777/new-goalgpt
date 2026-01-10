/**
 * Weather Enum
 * 
 * Represents weather conditions for matches (1-13)
 * Used in match.environment.weather field
 */

export enum Weather {
  PARTIALLY_CLOUDY = 1,           // Parçalı bulutlu
  CLOUDY = 2,                     // Bulutlu
  PARTIALLY_CLOUDY_RAIN = 3,      // Parçalı bulutlu/yağmur
  SNOW = 4,                       // Kar
  SUNNY = 5,                      // Güneşli
  OVERCAST_THUNDERSTORM = 6,      // Kapalı yağmur/fırtına
  OVERCAST = 7,                   // Kapalı
  MIST = 8,                       // Puslu
  OVERCAST_RAIN = 9,              // Kapalı yağmurlu
  CLOUDY_RAIN = 10,               // Bulutlu yağmurlu
  CLOUDY_THUNDERSTORM = 11,       // Bulutlu yağmur/fırtına
  LOCAL_THUNDERSTORM = 12,        // Yerel fırtına
  FOG = 13                        // Sis
}

/**
 * Get weather display name
 */
export function getWeatherName(weather: Weather, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<Weather, { en: string; tr: string }> = {
    [Weather.PARTIALLY_CLOUDY]: { en: 'Partially Cloudy', tr: 'Parçalı Bulutlu' },
    [Weather.CLOUDY]: { en: 'Cloudy', tr: 'Bulutlu' },
    [Weather.PARTIALLY_CLOUDY_RAIN]: { en: 'Partially Cloudy/Rain', tr: 'Parçalı Bulutlu/Yağmur' },
    [Weather.SNOW]: { en: 'Snow', tr: 'Kar' },
    [Weather.SUNNY]: { en: 'Sunny', tr: 'Güneşli' },
    [Weather.OVERCAST_THUNDERSTORM]: { en: 'Overcast Rain/Thunderstorm', tr: 'Kapalı Yağmur/Fırtına' },
    [Weather.OVERCAST]: { en: 'Overcast', tr: 'Kapalı' },
    [Weather.MIST]: { en: 'Mist', tr: 'Puslu' },
    [Weather.OVERCAST_RAIN]: { en: 'Overcast with Rain', tr: 'Kapalı Yağmurlu' },
    [Weather.CLOUDY_RAIN]: { en: 'Cloudy with Rain', tr: 'Bulutlu Yağmurlu' },
    [Weather.CLOUDY_THUNDERSTORM]: { en: 'Cloudy with Thunderstorms', tr: 'Bulutlu Fırtınalı' },
    [Weather.LOCAL_THUNDERSTORM]: { en: 'Local Thunderstorms', tr: 'Yerel Fırtına' },
    [Weather.FOG]: { en: 'Fog', tr: 'Sis' }
  };
  return names[weather]?.[lang] || 'Unknown';
}

/**
 * Get weather emoji for UI
 */
export function getWeatherEmoji(weather: Weather): string {
  const emojis: Record<Weather, string> = {
    [Weather.PARTIALLY_CLOUDY]: '⛅',
    [Weather.CLOUDY]: '☁️',
    [Weather.PARTIALLY_CLOUDY_RAIN]: '🌦️',
    [Weather.SNOW]: '❄️',
    [Weather.SUNNY]: '☀️',
    [Weather.OVERCAST_THUNDERSTORM]: '⛈️',
    [Weather.OVERCAST]: '☁️',
    [Weather.MIST]: '🌫️',
    [Weather.OVERCAST_RAIN]: '🌧️',
    [Weather.CLOUDY_RAIN]: '🌧️',
    [Weather.CLOUDY_THUNDERSTORM]: '⛈️',
    [Weather.LOCAL_THUNDERSTORM]: '🌩️',
    [Weather.FOG]: '🌫️'
  };
  return emojis[weather] || '❓';
}

/**
 * Check if weather is rainy
 */
export function isRainyWeather(weather: Weather): boolean {
  return [
    Weather.PARTIALLY_CLOUDY_RAIN,
    Weather.OVERCAST_THUNDERSTORM,
    Weather.OVERCAST_RAIN,
    Weather.CLOUDY_RAIN,
    Weather.CLOUDY_THUNDERSTORM,
    Weather.LOCAL_THUNDERSTORM
  ].includes(weather);
}

/**
 * Check if weather might affect play
 */
export function isBadWeather(weather: Weather): boolean {
  return [
    Weather.SNOW,
    Weather.OVERCAST_THUNDERSTORM,
    Weather.CLOUDY_THUNDERSTORM,
    Weather.LOCAL_THUNDERSTORM,
    Weather.FOG
  ].includes(weather);
}
