-- ============================================
-- Migration 012: Add Lookup Tables for New Enums
-- BASIC DATA - Weather and InjuryType lookups
-- ============================================

-- Weather lookup table (1-13)
CREATE TABLE IF NOT EXISTS lookup_weather (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_tr VARCHAR(50) NOT NULL,
  emoji VARCHAR(10)
);

-- Injury Type lookup table (0-3)
CREATE TABLE IF NOT EXISTS lookup_injury_types (
  id INTEGER PRIMARY KEY,
  name_en VARCHAR(30) NOT NULL,
  name_tr VARCHAR(30) NOT NULL,
  color VARCHAR(10),
  icon VARCHAR(10)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lookup_weather_id ON lookup_weather(id);
CREATE INDEX IF NOT EXISTS idx_lookup_injury_types_id ON lookup_injury_types(id);

-- ==========================================
-- Seed Weather Data
-- ==========================================
INSERT INTO lookup_weather (id, name_en, name_tr, emoji) VALUES
  (1, 'Partially Cloudy', 'Parçalı Bulutlu', '⛅'),
  (2, 'Cloudy', 'Bulutlu', '☁️'),
  (3, 'Partially Cloudy/Rain', 'Parçalı Bulutlu/Yağmur', '🌦️'),
  (4, 'Snow', 'Kar', '❄️'),
  (5, 'Sunny', 'Güneşli', '☀️'),
  (6, 'Overcast Rain/Thunderstorm', 'Kapalı Yağmur/Fırtına', '⛈️'),
  (7, 'Overcast', 'Kapalı', '☁️'),
  (8, 'Mist', 'Puslu', '🌫️'),
  (9, 'Overcast with Rain', 'Kapalı Yağmurlu', '🌧️'),
  (10, 'Cloudy with Rain', 'Bulutlu Yağmurlu', '🌧️'),
  (11, 'Cloudy with Thunderstorms', 'Bulutlu Fırtınalı', '⛈️'),
  (12, 'Local Thunderstorms', 'Yerel Fırtına', '🌩️'),
  (13, 'Fog', 'Sis', '🌫️')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  emoji = EXCLUDED.emoji;

-- ==========================================
-- Seed Injury Type Data
-- ==========================================
INSERT INTO lookup_injury_types (id, name_en, name_tr, color, icon) VALUES
  (0, 'Unknown', 'Bilinmiyor', '#9CA3AF', '❓'),
  (1, 'Injured', 'Sakatlık', '#EF4444', '🏥'),
  (2, 'Suspended', 'Cezalı', '#F59E0B', '🟨'),
  (3, 'Questionable', 'Belirsiz', '#3B82F6', '⚠️')
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_tr = EXCLUDED.name_tr,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon;

-- Done!
SELECT 'Weather and InjuryType lookup tables created and seeded!' as status;
